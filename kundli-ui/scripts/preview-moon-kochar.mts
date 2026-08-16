import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ChartDataPayload } from "../src/types/chartData.ts";
import {
  applyMoonKocharToBhuktiWindow,
  listMarriageBhuktiWindows,
} from "../src/lib/prediction/events/marriageBhuktiWindows.ts";
import { evaluateMoonMarriageKochar } from "../src/lib/prediction/events/marriageMoonKochar.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(root, "..");
const PLANETS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];
const RASI = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
];

const chart = JSON.parse(
  readFileSync(join(root, "public/chart-data.json"), "utf8")
) as ChartDataPayload;

const windows = listMarriageBhuktiWindows(chart, "en");
const dates = Array.from(new Set(windows.map((row) => row.start.slice(0, 10))));

const py = spawnSync(
  "python3",
  [join(repoRoot, "scripts/positions_for_dates.py"), join(repoRoot, "data/planet_positions.sqlite")],
  { input: JSON.stringify(dates), encoding: "utf8" }
);
if (py.status !== 0) {
  console.error(py.stderr || py.stdout);
  process.exit(py.status ?? 1);
}

const payload = JSON.parse(py.stdout) as {
  missing: string[];
  snapshots: Array<{
    dateIst: string;
    positions: Record<string, { planetId: number; rasi: number }> | null;
  }>;
};
const byDate = new Map(payload.snapshots.map((item) => [item.dateIst, item.positions]));

const scored = windows.map((row) => {
  const positions = byDate.get(row.start.slice(0, 10));
  if (!positions) return row;
  const transitPlanets = Object.values(positions).map((planet) => ({
    planetId: planet.planetId,
    rasi: planet.rasi,
  }));
  return applyMoonKocharToBhuktiWindow(row, chart.natalPlanets, transitPlanets, "en");
});

const moon = chart.natalPlanets.find((p) => p.planetId === 1);
const lagna = chart.birth.ascendantRasi;
const asOf = "2026-08-16";
const current = [...scored]
  .filter((row) => row.start.slice(0, 10) <= asOf)
  .at(-1);

function planet(id: number) {
  return PLANETS[id] ?? String(id);
}

console.log("=== Default kundli (new logic preview) ===");
console.log(
  JSON.stringify(
    {
      dob: chart.meta.dob,
      place: chart.meta.place,
      lagna: `${RASI[lagna]} (${lagna})`,
      moon: moon ? `${RASI[moon.rasi]} (${moon.rasi})` : null,
      housesFromMoon: moon
        ? {
            3: RASI[(moon.rasi + 2) % 12],
            7: RASI[(moon.rasi + 6) % 12],
            11: RASI[(moon.rasi + 10) % 12],
          }
        : null,
      adultFrom: "2016-05-10",
      adultUntil: "2034-05-10",
      snapshotCoverage: "1960-01-01 .. 2026-04-03",
      missingDates: payload.missing,
      windowCount: scored.length,
      withKochar: scored.filter((row) => row.kocharApplied).length,
      currentBhukti: current
        ? `${planet(current.maha)}/${planet(current.bhukti)} ${current.start.slice(0, 10)}`
        : null,
    },
    null,
    2
  )
);

console.log("\nstart | end | dasha/bhukti | dasha | kochar | mixed | verdict | 3-7-11 roles | kochar notes");
for (const row of scored) {
  const notes = (row.kocharHits ?? [])
    .filter((hit) => hit.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((hit) => `${hit.weight}:${hit.note.replace(/\.+$/, "")}`)
    .join(" · ");
  const mark = current && current.start === row.start && current.maha === row.maha && current.bhukti === row.bhukti ? "*" : " ";
  console.log(
    [
      mark,
      row.start.slice(0, 10),
      (row.end ?? "—").slice(0, 10),
      `${planet(row.maha)}/${planet(row.bhukti)}`,
      row.dashaScore.toFixed(1),
      row.kocharApplied ? String(row.kocharScore) : "no-sky",
      row.score.toFixed(1),
      row.verdict,
      row.matchedRoles.join(","),
      notes || (row.kocharApplied ? "no Guru/Venus link to 3/7/11 from Moon" : "after DB coverage"),
    ].join(" | ")
  );
}

if (current?.kocharApplied && current.kocharHits) {
  const positions = byDate.get(current.start.slice(0, 10));
  if (positions && moon) {
    const reading = evaluateMoonMarriageKochar(
      chart.natalPlanets,
      Object.values(positions).map((p) => ({ planetId: p.planetId, rasi: p.rasi })),
      "en"
    );
    console.log("\n=== Current bhukti moon kochar detail ===");
    console.log({
      guruRasi: RASI[positions.jupiter.rasi],
      venusRasi: RASI[positions.venus.rasi],
      guruHouseFromMoon: ((positions.jupiter.rasi - moon.rasi + 12) % 12) + 1,
      venusHouseFromMoon: ((positions.venus.rasi - moon.rasi + 12) % 12) + 1,
      kocharScore: reading.score,
      guruLinked: reading.guruLinked,
      shukraLinked: reading.shukraLinked,
      hits: reading.hits.map((h) => `${h.weight} ${h.note}`),
    });
  }
}
