import { DatabaseSync } from "node:sqlite";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  grahaDrishtiHouses,
  houseFromNatalMoon,
  moonSignReadout,
  saturnFromNatalMoon,
} from "../src/lib/antara/moonHouses.ts";
import {
  detectSignChanges,
  markerShowsRetro,
  type PlanetDay,
} from "../src/lib/antara/signChanges.ts";

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function assert(condition: unknown, message: string) {
  if (!condition) fail(message);
}

assert(houseFromNatalMoon(3, 3) === 1, "janma rasi is house 1");
assert(houseFromNatalMoon(3, 7) === 5, "Scorpio is the 5th from Cancer");
assert(houseFromNatalMoon(11, 0) === 2, "Aries is the 2nd from Pisces");
assert(houseFromNatalMoon(0, 11) === 12, "Pisces is the 12th from Aries");
assert(houseFromNatalMoon(0, 1) === 2, "next sign is house 2");

assert(saturnFromNatalMoon(0, 11) === "sade_sati", "12th from Moon is Sade Sati");
assert(saturnFromNatalMoon(0, 0) === "sade_sati", "Moon sign is Sade Sati");
assert(saturnFromNatalMoon(0, 1) === "sade_sati", "2nd from Moon is Sade Sati");
assert(saturnFromNatalMoon(0, 7) === "ashtama_sani", "8th from Moon is Ashtama Sani");
assert(saturnFromNatalMoon(0, 3) === "ardhashtama_sani", "4th from Moon is Ardhashtama Sani");
assert(saturnFromNatalMoon(0, 4) === null, "5th from Moon is not a Saturn special");

const jupiterAspects = grahaDrishtiHouses(4, 7);
assert(jupiterAspects.includes(1), "Jupiter in the 7th aspects natal Moon");
assert(jupiterAspects.includes(7) === false, "Jupiter does not aspect its own house");

const moon = moonSignReadout(
  [
    { date: "2024-10-01", rasi: 3 },
    { date: "2024-10-02", rasi: 3 },
    { date: "2024-10-03", rasi: 4 },
  ],
  "2024-10-02"
);
assert(moon.rasi === 3, "moon readout uses the sign on the selected date");
assert(moon.nextChangeDate === "2024-10-03", "moon readout reports the next sign change");

const series: PlanetDay[] = [
  { date: "2024-10-01", planetId: 4, rasi: 1, longitude: 59 },
  { date: "2024-10-02", planetId: 4, rasi: 2, longitude: 60.4 },
  { date: "2024-10-03", planetId: 4, rasi: 2, longitude: 60.1 },
  { date: "2024-10-04", planetId: 4, rasi: 1, longitude: 59.5 },
  { date: "2024-10-05", planetId: 4, rasi: 2, longitude: 60.2 },
  { date: "2024-10-01", planetId: 1, rasi: 0, longitude: 10 },
  { date: "2024-10-02", planetId: 1, rasi: 1, longitude: 22 },
  { date: "2024-10-01", planetId: 7, rasi: 1, longitude: 31 },
  { date: "2024-10-02", planetId: 7, rasi: 0, longitude: 29.5 },
];

const changes = detectSignChanges(series);
assert(
  changes.every((change) => change.planetId !== 1),
  "Moon sign changes are not slider markers"
);
const guru = changes.filter((change) => change.planetId === 4);
assert(guru.length === 3, "guru forward, retro, and re-entry are separate markers");
assert(guru[0].direction === "forward" && guru[0].reentry === false, "first crossing is forward");
assert(guru[1].direction === "retro" && guru[1].date === "2024-10-04", "backward crossing is retro");
assert(markerShowsRetro(guru[1]), "Guru retrograde marker is labelled R");
assert(guru[2].reentry === true && guru[2].direction === "forward", "return after retro is a re-entry");
assert(guru[2].toRasi === 2, "re-entry lands back in the sign that was left");

const rahu = changes.find((change) => change.planetId === 7);
assert(rahu?.direction === "retro", "Rahu sign change follows its backward motion");
assert(rahu ? !markerShowsRetro(rahu) : false, "node crossings are not Guru/Sani R badges");

const dbPath = join(dirname(fileURLToPath(import.meta.url)), "../../data/planet_positions.sqlite");
const db = new DatabaseSync(dbPath);
const coverage = db.prepare("SELECT value FROM metadata WHERE key = 'coverage_end_ist'").get() as {
  value: string;
};
const count = db.prepare("SELECT COUNT(*) AS n FROM planet_positions").get() as { n: number };
const ends = db.prepare("SELECT date_ist FROM planet_positions ORDER BY date_ist DESC LIMIT 1").get() as {
  date_ist: string;
};
db.close();
assert(coverage.value >= "2080-12-31", `coverage end ${coverage.value} reaches 2080`);
assert(ends.date_ist >= "2080-12-31", "last row reaches 2080-12-31");
assert(count.n >= 44000, `row count ${count.n} covers 1960-2080`);

console.log("ok: antara sign changes, moon houses, history coverage");
