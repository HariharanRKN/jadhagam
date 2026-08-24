import type { ChartDataPayload } from "../src/types/chartData.ts";
import {
  buildKundaliShareJson,
  kundaliShareFilename,
} from "../src/lib/kundaliExport.ts";

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function assert(condition: unknown, message: string) {
  if (!condition) fail(message);
}

const chart: ChartDataPayload = {
  meta: {
    name: "Smoke Test",
    gender: "male",
    dob: "1994-05-10",
    tob: "17:00:00",
    place: "Pondicherry, IN",
    ayanamsa: "Lahiri",
    nodes: "mean",
  },
  birth: {
    planetsByRasi: { "6": ["Jupiter"] },
    ascendantRasi: 6,
    ascendantDeg: 6.1952,
  },
  transit: {
    planetsByRasi: {},
    ascendantRasi: 6,
  },
  natalPlanets: [
    {
      planetId: 0,
      planetEn: "Sun",
      planetTa: "சூரியன்",
      rasi: 0,
      rasiTa: "மேஷம்",
      degInSign: 25.8,
      totalLongitude: 25.8,
      nakshatraEn: "Bharani",
      nakshatraTa: "பரணி",
      pada: 4,
    },
  ],
  transitPlanets: [],
  vimsottari: {
    labelsTa: {
      mahadasha: "மஹா தசை",
      bhukti: "புக்தி",
      antara: "அந்தர்தசை",
      sookshma: "சூக்ஷ்ம தசை",
      start: "தொடக்கம்",
      end: "முடிவு",
      planet: "கிரகம்",
      rasi: "ராசி",
      deg: "பாகை",
      totalDegTa: "முழு பாகை",
      nakshatra: "நட்சத்திரம்",
      pada: "பாதம்",
      natalTitle: "ஜனன",
      transitTitle: "கோசார",
      dashaTitle: "விம்சோத்தரி",
    },
    mahadasha: [
      { lord: 5, start: "1979-06-19 21:33:00 PM", end: "1999-06-20 00:36:17 AM" },
    ],
    bhukti: [
      {
        maha: 5,
        lord: 0,
        start: "1994-05-10 17:00:00 PM",
        end: "1995-03-19 12:00:00 PM",
      },
    ],
    antara: [
      {
        maha: 5,
        bhukti: 0,
        lord: 1,
        start: "1994-06-01 00:00:00 AM",
        end: "1994-07-01 00:00:00 AM",
      },
    ],
    sookshma: [
      {
        maha: 5,
        bhukti: 0,
        antara: 1,
        lord: 2,
        start: "1994-06-01 00:00:00 AM",
        end: "1994-06-02 00:00:00 AM",
      },
    ],
  },
};

const json = buildKundaliShareJson(chart);
assert(json.positions[0]?.name === "Lagna", "first position should be Lagna");
assert(json.positions[0]?.rasi === "Libra", "lagna rasi should be Libra");
assert(json.positions[1]?.name === "Sun", "Sun follows Lagna");
assert(json.periods.bhukti[0]?.from === "1994-05-10 17:00:00 PM", "bhukti from date");
assert(json.periods.bhukti[0]?.to === "1995-03-19 12:00:00 PM", "bhukti to date");
assert(json.periods.bhukti[0]?.mahadasha === "Venus", "bhukti mahadasha name");
assert(json.periods.antara[0]?.antara === "Moon", "antara lord name");
assert(json.periods.sookshma[0]?.sookshma === "Mars", "sookshma lord name");
assert(kundaliShareFilename(chart) === "smoke-test-1994-05-10.json", "filename slug");

const serialized = JSON.stringify(json);
assert(serialized.includes('"from"'), "serialized JSON uses from");
assert(serialized.includes('"to"'), "serialized JSON uses to");
assert(!serialized.includes('"start"'), "share JSON should not use start keys");

console.log("ok: kundali share JSON");
