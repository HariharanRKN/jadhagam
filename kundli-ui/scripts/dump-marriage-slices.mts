import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  listMarriageBhuktiWindows,
  narrowSlicesByKochar,
  scoreMoonKocharSlices,
  type MarriageBhuktiWindow,
} from "../src/lib/prediction/events/marriageBhuktiWindows.ts";
import type { ChartDataPayload } from "../src/types/chartData.ts";
import type { TransitRasiPlanet } from "../src/lib/prediction/events/marriageKochar.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function run(cmd: string, args: string[], input?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: root });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(stderr || stdout || `exit ${code}`));
      else resolve(stdout);
    });
    if (input) child.stdin.write(input);
    child.stdin.end();
  });
}

function lastJson(stdout: string): unknown {
  const lines = stdout.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line.startsWith("{") && !line.startsWith("[")) continue;
    try {
      return JSON.parse(line);
    } catch {
      continue;
    }
  }
  throw new Error("No JSON in command output");
}

async function loadChart(source: string): Promise<ChartDataPayload> {
  if (source.endsWith(".json")) {
    return JSON.parse(await readFile(source, "utf8")) as ChartDataPayload;
  }
  const python = process.env.HOROSCOPE_PYTHON ?? "python3";
  const stdout = await run(python, [join(root, "horoscope.py"), "--stdin-ui"], source);
  return lastJson(stdout) as ChartDataPayload;
}

async function loadTransits(dates: string[]): Promise<Map<string, TransitRasiPlanet[]>> {
  const python = process.env.HOROSCOPE_PYTHON ?? "python3";
  const stdout = await run(
    python,
    [join(root, "scripts/positions_for_dates.py"), join(root, "data/planet_positions.sqlite")],
    JSON.stringify(dates)
  );
  const payload = JSON.parse(stdout) as {
    snapshots?: Array<{
      dateIst: string;
      positions: Record<string, { planetId: number; rasi: number }> | null;
    }>;
  };
  const map = new Map<string, TransitRasiPlanet[]>();
  for (const snapshot of payload.snapshots ?? []) {
    if (!snapshot.positions) continue;
    map.set(
      snapshot.dateIst,
      Object.values(snapshot.positions).map((planet) => ({
        planetId: planet.planetId,
        rasi: planet.rasi,
      }))
    );
  }
  return map;
}

function fmt(row: MarriageBhuktiWindow): string {
  const sky = row.kocharApplied ? String(row.kocharScore ?? 0) : "no-sky";
  return `${row.start} .. ${row.end}  kochar=${sky}  mixed=${row.score}`;
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: dump-marriage-slices.mts <chart.json | birth.json>");
    process.exit(1);
  }
  const raw = arg.endsWith(".json") ? await readFile(arg, "utf8") : arg;
  const parsed = JSON.parse(raw) as ChartDataPayload | { birth: unknown; place: unknown };
  const chart =
    "vimsottari" in parsed
      ? (parsed as ChartDataPayload)
      : await loadChart(raw);
  const windows = listMarriageBhuktiWindows(chart, "en");
  const dates = [
    ...new Set(
      windows.flatMap((row) =>
        scoreMoonKocharSlices(row, chart.natalPlanets, new Map()).scoredSlices.map(
          (slice) => slice.start
        )
      )
    ),
  ];
  const transits = await loadTransits(dates);
  const focus = windows.filter((row) => {
    const start = row.start;
    return start >= "1979" && start <= "1986" || (row.end ?? "").startsWith("198");
  });
  const rows = focus.length ? focus : windows;
  for (const row of rows) {
    const { base, scoredSlices } = scoreMoonKocharSlices(
      row,
      chart.natalPlanets,
      transits
    );
    const narrowed = narrowSlicesByKochar(base, scoredSlices);
    console.log(
      `\nBhukti maha=${row.maha} bhukti=${row.bhukti} ${row.start} .. ${row.end}`
    );
    console.log("  slices:");
    for (const slice of scoredSlices) console.log("   ", fmt(slice));
    console.log("  shown:");
    for (const slice of narrowed) console.log("   ", fmt(slice));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
