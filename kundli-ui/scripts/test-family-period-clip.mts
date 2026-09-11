import {
  ANTARA_CLIP_MAX_DAYS,
  buildFamilyPeriodSummary,
  clampIsoToRange,
  clipDatedRows,
  familyPeriodPresets,
  inclusiveDaySpan,
  orderedIsoRange,
  shouldShowAntara,
} from "../src/lib/family/periodClip.ts";

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function assert(condition: unknown, message: string) {
  if (!condition) fail(message);
}

assert(orderedIsoRange("2026-06-30", "2026-01-01").start === "2026-01-01", "range swaps");
assert(inclusiveDaySpan("2026-01-01", "2026-01-01") === 1, "single day span");
assert(shouldShowAntara("2026-01-01", "2026-03-31"), "90-day window shows antara");
assert(!shouldShowAntara("2026-01-01", "2026-06-30"), "long window hides antara");
assert(ANTARA_CLIP_MAX_DAYS === 90, "antara cap");

const clipped = clipDatedRows(
  [
    { lord: 6, start: "2025-11-01", end: "2028-02-01" },
    { lord: 4, start: "2024-01-01", end: "2025-10-31" },
  ],
  "2026-01-01",
  "2026-06-30",
  "2026-04-01"
);
assert(clipped.length === 1, "only overlapping dasha remains");
assert(clipped[0].clipStart === "2026-01-01", "clip start is period start");
assert(clipped[0].clipEnd === "2026-06-30", "clip end is period end");
assert(clipped[0].continuesOutside === true, "marks continuation");
assert(clipped[0].containsFocus === true, "focus inside clip");
assert(clampIsoToRange("2025-12-01", "2026-01-01", "2026-06-30") === "2026-01-01", "clamp focus");

const presets = familyPeriodPresets("2026-09-11");
assert(presets.thisMonth.from === "2026-09-01", "month start");
assert(presets.thisMonth.to === "2026-09-30", "month end");
assert(presets.thisYear.from === "2026-01-01" && presets.thisYear.to === "2026-12-31", "year");
assert(presets.nextSixMonths.from === "2026-09-11", "six months from today");

const summary = buildFamilyPeriodSummary([
  { name: "Amma", mahaLords: [6], bhuktiLords: [6], houses: [10, 11] },
  { name: "Appa", mahaLords: [4], bhuktiLords: [6], houses: [2, 11] },
  { name: "Child", mahaLords: [4], bhuktiLords: [5], houses: [5] },
]);
assert(summary.memberCount === 3, "member count");
assert(summary.sharedBhukti[0]?.lordId === 6, "shared saturn bhukti");
assert(summary.sharedBhukti[0]?.names.join(",") === "Amma,Appa", "shared bhukti names");
assert(summary.sharedMaha[0]?.lordId === 4, "shared guru maha");
assert(summary.sharedHouses.includes(11), "shared 11th");

console.log("ok");
