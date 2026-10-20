import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { placementTone, naturalRelation, relateLords } from "../src/lib/antara/lordRelations.ts";
import {
  grahaDrishtiHouses,
  houseFromNatalMoon,
  moonSignReadout,
  saturnFromNatalMoon,
} from "../src/lib/antara/moonHouses.ts";
import { durationSegments } from "../src/lib/antara/duration.ts";
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

for (const house of [1, 4, 5, 7, 9, 10]) {
  assert(placementTone(0, house - 1) === "supportive", `house ${house} is supportive`);
}
for (const house of [2, 6, 8, 12]) {
  assert(placementTone(0, house - 1) === "friction", `house ${house} is friction`);
}
for (const house of [3, 11]) {
  assert(placementTone(0, house - 1) === "neutral", `house ${house} is neutral`);
}
assert(placementTone(3, 3) === "supportive", "same sign is kendra and trikona");
assert(placementTone(11, 0) === "friction", "the next sign is the 2nd, and the reverse is the 12th");

assert(naturalRelation(0, 1) === "friend", "Sun sees the Moon as a friend");
assert(naturalRelation(0, 6) === "enemy", "Sun sees Saturn as an enemy");
assert(naturalRelation(0, 3) === "neutral", "Sun sees Mercury as neutral");
assert(naturalRelation(3, 0) === "friend", "Mercury sees the Sun as a friend");
assert(naturalRelation(7, 5) === "friend", "Rahu sees Venus as a friend");
assert(naturalRelation(8, 3) === "enemy", "Ketu sees Mercury as an enemy");
assert(naturalRelation(4, 4) === "same", "a planet with itself is the same planet");

const pairs = relateLords([
  { role: "maha", planetId: 6, rasi: 10 },
  { role: "bhukti", planetId: 4, rasi: 6 },
  { role: "antara", planetId: 0, rasi: 0 },
]);
assert(pairs.length === 3, "three lords make three pairs");
assert(pairs[0].placement === "supportive", "Aquarius to Libra is the 9th, a trikona");
assert(pairs[0].houseOfRightFromLeft === 9 && pairs[0].houseOfLeftFromRight === 5, "9th and 5th are mutual");

const oneMonth = durationSegments({ years: 0, months: 1, days: 14 });
assert(oneMonth.length === 2 && oneMonth[0].count === 1 && oneMonth[0].unit === "month", "one month is singular");
assert(oneMonth[1].count === 14 && oneMonth[1].unit === "day", "fourteen days stay plural");
const oneDay = durationSegments({ years: 0, months: 0, days: 1 });
assert(oneDay.length === 1 && oneDay[0].unit === "day" && oneDay[0].count === 1, "a single day is singular");

const bundled = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../src/data/defaultChart.json"), "utf8")
) as { natalPlanets: Array<{ planetEn: string; degInSign: number; nakshatraEn?: string }> };
const bundledRahu = bundled.natalPlanets.find((planet) => planet.planetEn === "Rahu");
const bundledKetu = bundled.natalPlanets.find((planet) => planet.planetEn === "Ketu");
assert(bundledRahu && bundledRahu.degInSign > 0 && bundledRahu.degInSign < 1, "mean Rahu is not snapped to 0.0°");
assert(bundledKetu && bundledKetu.degInSign > 0, "mean Ketu keeps the same offset");
assert(bundledRahu?.nakshatraEn === "Vishakha", "English nakshatra is stored for Rahu");

console.log("ok: antara sign changes, moon houses, history coverage");
