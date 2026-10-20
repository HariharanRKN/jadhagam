import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { addIsoDays, daysBetween } from "@/lib/antara/period";
import type { SkyDay, SkyPlanet, SkyRangeResponse } from "@/lib/antara/sky";
import { isoDateKey } from "@/lib/isoDate";
import { runPython } from "@/lib/runPython";

const IS_PROD = process.env.NODE_ENV === "production";

/** One Python process can fill a long dasha; larger gaps return the focus day only. */
const LIVE_FILL_MAX_DAYS = 8000;

const PLANETS: Array<{ id: number; key: string; en: string }> = [
  { id: 0, key: "sun", en: "Sun" },
  { id: 1, key: "moon", en: "Moon" },
  { id: 2, key: "mars", en: "Mars" },
  { id: 3, key: "mercury", en: "Mercury" },
  { id: 4, key: "jupiter", en: "Jupiter" },
  { id: 5, key: "venus", en: "Venus" },
  { id: 6, key: "saturn", en: "Saturn" },
  { id: 7, key: "rahu", en: "Rahu" },
  { id: 8, key: "ketu", en: "Ketu" },
];

function repoRoot() {
  return IS_PROD ? "/app" : join(process.cwd(), "..");
}

export function historyDbPath() {
  return (
    process.env.HISTORY_DB_PATH ??
    (IS_PROD
      ? "/app/data/planet_positions.sqlite"
      : join(repoRoot(), "data/planet_positions.sqlite"))
  );
}

function pythonBin() {
  return process.env.HISTORY_DB_PYTHON ?? process.env.HOROSCOPE_PYTHON ?? "python3";
}

function batchScript() {
  return IS_PROD
    ? "/app/scripts/positions_for_dates.py"
    : join(repoRoot(), "scripts/positions_for_dates.py");
}

type SqlRow = Record<string, number | string>;

function rowToDay(row: SqlRow): SkyDay {
  const positions: Record<string, SkyPlanet> = {};
  for (const planet of PLANETS) {
    positions[planet.key] = {
      planetId: planet.id,
      planetEn: planet.en,
      rasi: Number(row[`${planet.key}_rasi`]),
      degInSign: Number(row[`${planet.key}_deg`]),
      totalLongitude: Number(row[`${planet.key}_long`]),
    };
  }
  return { dateIst: String(row.date_ist), positions };
}

function openDb(path: string): DatabaseSync {
  return new DatabaseSync(path);
}

export function readSqliteRange(dbPath: string, start: string, end: string): SkyDay[] {
  const db = openDb(dbPath);
  try {
    const rows = db
      .prepare(
        `SELECT * FROM planet_positions WHERE date_ist >= ? AND date_ist <= ? ORDER BY date_ist`
      )
      .all(start, end) as SqlRow[];
    return rows.map(rowToDay);
  } finally {
    db.close();
  }
}

export function readCoverage(dbPath: string): { start: string | null; end: string | null } {
  const db = openDb(dbPath);
  try {
    const rows = db.prepare(`SELECT key, value FROM metadata`).all() as Array<{
      key: string;
      value: string;
    }>;
    const map = new Map(rows.map((row) => [row.key, row.value]));
    return {
      start: map.get("coverage_start_ist") ?? null,
      end: map.get("coverage_end_ist") ?? null,
    };
  } catch {
    return { start: null, end: null };
  } finally {
    db.close();
  }
}

function missingDates(start: string, end: string, have: Set<string>): string[] {
  const missing: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    if (!have.has(cursor)) missing.push(cursor);
    if (missing.length > LIVE_FILL_MAX_DAYS) return missing;
    cursor = addIsoDays(cursor, 1);
  }
  return missing;
}

function asPlanet(value: unknown): SkyPlanet | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.planetId !== "number" || typeof row.rasi !== "number") return null;
  return {
    planetId: row.planetId,
    planetEn: typeof row.planetEn === "string" ? row.planetEn : String(row.planetId),
    rasi: row.rasi,
    degInSign: Number(row.degInSign ?? 0),
    totalLongitude: Number(row.totalLongitude ?? row.rasi * 30),
  };
}

async function liveDays(dates: string[]): Promise<SkyDay[]> {
  if (!dates.length) return [];
  const result = await runPython({
    args: [pythonBin(), batchScript(), historyDbPath()],
    cwd: repoRoot(),
    input: JSON.stringify(dates),
    timeoutMs: 120_000,
  });
  if (!result.ok) return [];
  try {
    const payload = JSON.parse(result.stdout) as {
      snapshots?: Array<{ dateIst?: string; positions?: Record<string, unknown> | null }>;
    };
    const days: SkyDay[] = [];
    for (const snapshot of payload.snapshots ?? []) {
      if (!snapshot.positions || !snapshot.dateIst) continue;
      const positions: Record<string, SkyPlanet> = {};
      for (const [key, value] of Object.entries(snapshot.positions)) {
        const planet = asPlanet(value);
        if (planet) positions[key] = planet;
      }
      if (Object.keys(positions).length) {
        days.push({ dateIst: isoDateKey(snapshot.dateIst), positions });
      }
    }
    return days;
  } catch {
    return [];
  }
}

export async function loadSkyRange(
  startRaw: string,
  endRaw: string,
  focusRaw?: string | null
): Promise<SkyRangeResponse> {
  let start = isoDateKey(startRaw);
  let end = isoDateKey(endRaw);
  if (end < start) [start, end] = [end, start];
  const focus = focusRaw ? isoDateKey(focusRaw) : "";
  const dbPath = historyDbPath();
  let coverage = { start: null as string | null, end: null as string | null };
  let days: SkyDay[] = [];
  try {
    coverage = readCoverage(dbPath);
    days = readSqliteRange(dbPath, start, end);
  } catch {
    days = [];
  }

  const span = daysBetween(start, end) + 1;
  const have = new Set(days.map((day) => day.dateIst));
  const missing = have.size === span ? [] : missingDates(start, end, have);
  let partial = false;
  let source: SkyRangeResponse["source"] = days.length ? "sqlite" : "live";

  let fill = missing;
  if (missing.length > LIVE_FILL_MAX_DAYS) {
    partial = true;
    fill =
      focus && focus >= start && focus <= end && !have.has(focus) ? [focus] : [];
  }
  if (fill.length) {
    const live = await liveDays(fill);
    if (live.length) source = days.length ? "mixed" : "live";
    const byDate = new Map(days.map((day) => [day.dateIst, day]));
    for (const day of live) byDate.set(day.dateIst, day);
    days = [...byDate.values()].sort((a, b) => a.dateIst.localeCompare(b.dateIst));
  }

  const stillMissing = missing.filter((date) => !days.some((day) => day.dateIst === date));
  return {
    start,
    end,
    days,
    missingCount: stillMissing.length,
    partial: partial || stillMissing.length > 0,
    coverageStart: coverage.start,
    coverageEnd: coverage.end,
    source,
  };
}
