import { spawn } from "node:child_process";
import { join } from "node:path";
import { isoDateKey } from "@/lib/isoDate";
import type { TransitRasiPlanet } from "@/lib/prediction/events/marriageKochar";

const IS_PROD = process.env.NODE_ENV === "production";

export type HistoryPlanetPosition = {
  planetId: number;
  planetEn: string;
  rasi: number;
  degInSign?: number;
  totalLongitude?: number;
};

export type HistorySnapshot = {
  dateIst: string;
  timestampIst: string;
  timestampUtc?: string;
  positions: Record<string, HistoryPlanetPosition>;
};

function repoRoot() {
  return IS_PROD ? "/app" : join(process.cwd(), "..");
}

function pythonBin() {
  return process.env.HISTORY_DB_PYTHON ?? process.env.HOROSCOPE_PYTHON ?? "python3";
}

function dbPath() {
  return (
    process.env.HISTORY_DB_PATH ??
    (IS_PROD
      ? "/app/data/planet_positions.sqlite"
      : join(repoRoot(), "data/planet_positions.sqlite"))
  );
}

function historyScript() {
  return (
    process.env.HISTORY_DB_SCRIPT ??
    (IS_PROD
      ? "/app/scripts/history_db.py"
      : join(repoRoot(), "scripts/history_db.py"))
  );
}

function batchScript() {
  return IS_PROD
    ? "/app/scripts/positions_for_dates.py"
    : join(repoRoot(), "scripts/positions_for_dates.py");
}

function runPython(
  args: string[],
  input?: string
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(pythonBin(), args, {
      cwd: repoRoot(),
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("close", (code) =>
      resolve({ ok: code === 0, stdout, stderr })
    );
    child.on("error", (err) =>
      resolve({ ok: false, stdout, stderr: String(err) })
    );
    if (input) child.stdin?.write(input);
    child.stdin?.end();
  });
}

function planetsFromPositions(
  positions: Record<string, { planetId: number; rasi: number; planetEn?: string }>
): TransitRasiPlanet[] {
  return Object.values(positions).map((planet) => ({
    planetId: planet.planetId,
    rasi: planet.rasi,
  }));
}

function parseLastJsonObject(stdout: string): unknown {
  const lines = stdout.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line.startsWith("{")) continue;
    try {
      return JSON.parse(line) as unknown;
    } catch {
      continue;
    }
  }
  throw new Error("No JSON object found in history command output");
}

function snapshotFromPositions(
  requestedDate: string,
  dateIst: string | undefined,
  positions: Record<string, HistoryPlanetPosition>,
  timestampIst?: string,
  timestampUtc?: string
): HistorySnapshot {
  const key = isoDateKey(requestedDate) || isoDateKey(dateIst);
  return {
    dateIst: key,
    timestampIst: timestampIst || `${key}T12:00:00+05:30`,
    timestampUtc,
    positions,
  };
}

function rememberSnapshot(
  map: Map<string, HistorySnapshot>,
  requestedDate: string,
  snapshot: HistorySnapshot
) {
  const keys = [isoDateKey(requestedDate), isoDateKey(snapshot.dateIst)].filter(
    Boolean
  );
  for (const key of keys) map.set(key, { ...snapshot, dateIst: key });
}

export async function loadPositionSnapshots(
  dates: string[]
): Promise<Map<string, HistorySnapshot>> {
  const unique = Array.from(
    new Set(dates.map((date) => isoDateKey(date)).filter(Boolean))
  );
  const byDate = new Map<string, HistorySnapshot>();
  if (!unique.length) return byDate;

  const batch = await runPython(
    [batchScript(), dbPath()],
    JSON.stringify(unique)
  );
  let missing = unique;
  if (batch.ok) {
    try {
      const payload = JSON.parse(batch.stdout) as {
        missing?: string[];
        snapshots?: Array<{
          dateIst: string;
          timestampIst?: string;
          timestampUtc?: string;
          positions: Record<string, HistoryPlanetPosition> | null;
        }>;
      };
      const found = new Set<string>();
      for (const snapshot of payload.snapshots ?? []) {
        if (!snapshot.positions) continue;
        const requested =
          unique.find((date) => isoDateKey(date) === isoDateKey(snapshot.dateIst)) ??
          snapshot.dateIst;
        rememberSnapshot(
          byDate,
          requested,
          snapshotFromPositions(
            requested,
            snapshot.dateIst,
            snapshot.positions,
            snapshot.timestampIst,
            snapshot.timestampUtc
          )
        );
        found.add(isoDateKey(snapshot.dateIst));
      }
      missing =
        payload.missing?.map(isoDateKey).filter((date) => !byDate.has(date)) ??
        unique.filter((date) => !found.has(date) && !byDate.has(date));
    } catch {
      missing = unique.filter((date) => !byDate.has(date));
    }
  }

  for (const date of missing) {
    const result = await runPython([
      historyScript(),
      "--db",
      dbPath(),
      "position-on-date",
      "--date",
      date,
    ]);
    if (!result.ok) continue;
    try {
      const json = parseLastJsonObject(result.stdout) as {
        dateIst?: string;
        timestampIst?: string;
        timestampUtc?: string;
        positions?: Record<string, HistoryPlanetPosition>;
      };
      if (!json.positions) continue;
      rememberSnapshot(
        byDate,
        date,
        snapshotFromPositions(
          date,
          json.dateIst,
          json.positions,
          json.timestampIst,
          json.timestampUtc
        )
      );
    } catch {
      continue;
    }
  }

  return byDate;
}

export async function loadTransitPlanetsByDate(
  dates: string[]
): Promise<Map<string, TransitRasiPlanet[]>> {
  const snapshots = await loadPositionSnapshots(dates);
  const byDate = new Map<string, TransitRasiPlanet[]>();
  for (const [date, snapshot] of snapshots) {
    byDate.set(date, planetsFromPositions(snapshot.positions));
  }
  return byDate;
}

export function historySnapshotsList(
  snapshots: Map<string, HistorySnapshot>,
  dates: string[]
): HistorySnapshot[] {
  const seen = new Set<string>();
  const list: HistorySnapshot[] = [];
  for (const date of dates) {
    const key = isoDateKey(date);
    if (!key || seen.has(key)) continue;
    const snapshot = snapshots.get(key);
    if (!snapshot) continue;
    seen.add(key);
    list.push(snapshot);
  }
  return list;
}
