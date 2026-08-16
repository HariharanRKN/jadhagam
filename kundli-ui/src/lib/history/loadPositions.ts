import { join } from "node:path";
import type { TransitRasiPlanet } from "@/lib/prediction/events/marriageKochar";
import { runPython } from "@/lib/runPython";

const IS_PROD = process.env.NODE_ENV === "production";

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

function runHistoryPython(args: string[], input?: string) {
  return runPython({
    args: [pythonBin(), ...args],
    cwd: repoRoot(),
    input,
    timeoutMs: 60_000,
  });
}

function planetsFromPositions(
  positions: Record<string, { planetId: number; rasi: number }>
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

export async function loadTransitPlanetsByDate(
  dates: string[]
): Promise<Map<string, TransitRasiPlanet[]>> {
  const unique = Array.from(new Set(dates.filter(Boolean)));
  const byDate = new Map<string, TransitRasiPlanet[]>();
  if (!unique.length) return byDate;

  const batch = await runHistoryPython(
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
          positions: Record<string, { planetId: number; rasi: number }> | null;
        }>;
      };
      for (const snapshot of payload.snapshots ?? []) {
        if (!snapshot.positions) continue;
        byDate.set(snapshot.dateIst, planetsFromPositions(snapshot.positions));
      }
      missing = payload.missing ?? unique.filter((date) => !byDate.has(date));
    } catch {
      missing = unique;
    }
  }

  for (const date of missing) {
    const result = await runHistoryPython([
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
        positions?: Record<string, { planetId: number; rasi: number }>;
      };
      if (!json.positions) continue;
      byDate.set(json.dateIst ?? date, planetsFromPositions(json.positions));
    } catch {
      continue;
    }
  }

  return byDate;
}
