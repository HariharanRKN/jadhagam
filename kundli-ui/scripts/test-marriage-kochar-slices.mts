import {
  addMonthsIso,
  collectMarriageKocharSampleDates,
  currentBhuktiWindow,
  listSixMonthSlices,
  narrowSlicesByKochar,
  selectNearTopByScore,
  type MarriageBhuktiWindow,
} from "../src/lib/prediction/events/marriageBhuktiWindows.ts";

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function assertEqual<T>(actual: T, expected: T, label: string) {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  if (left !== right) fail(`${label}: ${left} !== ${right}`);
}

function windowStub(
  partial: Partial<MarriageBhuktiWindow> & Pick<MarriageBhuktiWindow, "start" | "end">
): MarriageBhuktiWindow {
  return {
    maha: 4,
    bhukti: 5,
    bhuktiStart: "2020-01-01",
    bhuktiEnd: "2021-07-01",
    matchedRoles: ["7th-lord"],
    dashaScore: 50,
    score: 50,
    verdict: "supportive",
    notes: [],
    dashaNotes: [],
    kocharApplied: true,
    kocharScore: 0,
    kocharHits: [],
    ...partial,
  };
}

assertEqual(addMonthsIso("2020-01-31", 6), "2020-07-31", "Jan 31 + 6 months");
assertEqual(addMonthsIso("2020-08-31", 6), "2021-02-28", "Aug 31 + 6 months non-leap");
assertEqual(addMonthsIso("2019-08-31", 6), "2020-02-29", "Aug 31 + 6 months leap");

assertEqual(
  listSixMonthSlices("2020-01-01", "2020-05-01"),
  [{ start: "2020-01-01", end: "2020-05-01" }],
  "period shorter than 6 months stays one slice"
);
assertEqual(
  listSixMonthSlices("2020-01-01", "2020-07-01"),
  [{ start: "2020-01-01", end: "2020-07-01" }],
  "exactly 6 months stays one slice"
);
assertEqual(
  listSixMonthSlices("2020-01-01", "2021-07-01"),
  [
    { start: "2020-01-01", end: "2020-07-01" },
    { start: "2020-07-01", end: "2021-01-01" },
    { start: "2021-01-01", end: "2021-07-01" },
  ],
  "18-month period splits into three 6-month slices"
);

assertEqual(
  selectNearTopByScore(
    [
      { name: "a", score: 42 },
      { name: "b", score: 30 },
      { name: "c", score: 38 },
    ],
    (item) => item.score
  ).map((item) => item.name),
  ["a", "c"],
  "keeps scores within 5 points of the top"
);

const original = windowStub({
  start: "2020-01-01",
  end: "2021-07-01",
  bhuktiStart: "2020-01-01",
  bhuktiEnd: "2021-07-01",
});
const slices = [
  windowStub({ start: "2020-01-01", end: "2020-07-01", kocharScore: 20 }),
  windowStub({ start: "2020-07-01", end: "2021-01-01", kocharScore: 44 }),
  windowStub({ start: "2021-01-01", end: "2021-07-01", kocharScore: 21 }),
];
const uniquePeak = narrowSlicesByKochar(original, slices);
assertEqual(uniquePeak.length, 1, "unique peak keeps one slice");
assertEqual(uniquePeak[0].start, "2020-07-01", "unique peak uses winning slice start");
assertEqual(uniquePeak[0].end, "2021-01-01", "unique peak uses winning slice end");

const closeSlices = [
  windowStub({ start: "2020-01-01", end: "2020-07-01", kocharScore: 40 }),
  windowStub({ start: "2020-07-01", end: "2021-01-01", kocharScore: 44 }),
  windowStub({ start: "2021-01-01", end: "2021-07-01", kocharScore: 21 }),
];
const close = narrowSlicesByKochar(original, closeSlices);
assertEqual(
  close.map((row) => row.start),
  ["2020-01-01", "2020-07-01"],
  "near-top slices are all shown"
);

const tied = [
  windowStub({ start: "2020-01-01", end: "2020-07-01", kocharScore: 10 }),
  windowStub({ start: "2020-07-01", end: "2021-01-01", kocharScore: 10 }),
  windowStub({ start: "2021-01-01", end: "2021-07-01", kocharScore: 10 }),
];
const tiedResult = narrowSlicesByKochar(original, tied);
assertEqual(tiedResult.length, 1, "identical scores collapse to the full bhukti");
assertEqual(tiedResult[0].start, "2020-01-01", "tied result keeps bhukti start");
assertEqual(tiedResult[0].end, "2021-07-01", "tied result keeps bhukti end");

const sampleDates = collectMarriageKocharSampleDates([original]);
assertEqual(
  sampleDates,
  ["2020-01-01", "2020-07-01", "2021-01-01"],
  "sample dates are each 6-month slice start"
);

const current = currentBhuktiWindow(
  [
    windowStub({
      start: "2020-07-01",
      end: "2021-01-01",
      bhuktiStart: "2020-01-01",
      bhuktiEnd: "2021-07-01",
      kocharScore: 44,
    }),
  ],
  "2020-03-01"
);
if (!current || current.start !== "2020-07-01") {
  fail("current period stays on the running bhukti even when the peak slice is later");
}

console.log("ok: marriage kochar 6-month slice selection");
