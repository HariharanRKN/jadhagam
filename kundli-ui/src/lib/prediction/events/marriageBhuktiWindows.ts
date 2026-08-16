import type { BhuktiRow, ChartDataPayload } from "@/types/chartData";
import { collectMarriageBhavaReadings } from "./marriageBhava";
import {
  formatMatchedRoles,
  mp,
  type MarriageLang,
} from "./marriageLocale";
import type { PeriodMatchRole } from "./marriage";
import {
  evaluateMoonMarriageKochar,
  mixDashaWithMoonKochar,
} from "./marriageMoonKochar";
import type { TransitRasiPlanet } from "./marriageKochar";
import type { KocharHit } from "./marriageKochar";
import { isoDateKey } from "@/lib/isoDate";

const SIGN_LORD: Record<number, number> = {
  0: 2,
  1: 5,
  2: 3,
  3: 1,
  4: 0,
  5: 3,
  6: 5,
  7: 2,
  8: 4,
  9: 6,
  10: 6,
  11: 4,
};

const MARRIAGE_HOUSE_ROLES: PeriodMatchRole[] = [
  "3rd-lord",
  "7th-lord",
  "11th-lord",
  "3rd-bhava",
  "7th-bhava",
  "11th-bhava",
  "3rd-conjunct",
  "7th-conjunct",
  "11th-conjunct",
];

export const MARRIAGE_ADULT_AGE_YEARS = 22;
export const MARRIAGE_MAX_AGE_YEARS = 40;
export const KOCHAR_SLICE_MONTHS = 6;
export const KOCHAR_NEAR_TOP_POINTS = 5;

export type DateSlice = {
  start: string;
  end: string | null;
};

export type MarriageBhuktiWindow = {
  maha: number;
  bhukti: number;
  start: string;
  end: string | null;
  bhuktiStart: string;
  bhuktiEnd: string | null;
  matchedRoles: PeriodMatchRole[];
  dashaScore: number;
  score: number;
  verdict: "strong" | "supportive" | "weak";
  notes: string[];
  dashaNotes: string[];
  kocharScore?: number;
  kocharHits?: KocharHit[];
  kocharApplied: boolean;
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

function addYearsIso(isoDate: string, years: number): string {
  const [year, month, day] = isoDateKey(isoDate).split("-").map(Number);
  return `${year + years}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function daysInMonth(year: number, month: number): number {
  const lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return month === 2 && leap ? 29 : lengths[month - 1] ?? 30;
}

export function addMonthsIso(isoDate: string, months: number): string {
  const [year, month, day] = isoDateKey(isoDate).split("-").map(Number);
  const total = year * 12 + (month - 1) + months;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12) + 1;
  const nextDay = Math.min(day, daysInMonth(nextYear, nextMonth));
  return `${nextYear}-${pad2(nextMonth)}-${pad2(nextDay)}`;
}

export function listSixMonthSlices(start: string, end: string | null): DateSlice[] {
  const from = isoDateKey(start);
  const until = end ? isoDateKey(end) : "";
  if (!from) return [];
  if (!until || until <= from) return [{ start: from, end: end ? until : null }];
  if (addMonthsIso(from, KOCHAR_SLICE_MONTHS) >= until) {
    return [{ start: from, end: until }];
  }
  const slices: DateSlice[] = [];
  let cursor = from;
  while (cursor < until) {
    const next = addMonthsIso(cursor, KOCHAR_SLICE_MONTHS);
    slices.push({ start: cursor, end: next < until ? next : until });
    cursor = next;
  }
  return slices;
}

export function collectMarriageKocharSampleDates(windows: MarriageBhuktiWindow[]): string[] {
  const dates = new Set<string>();
  for (const row of windows) {
    const periodStart = isoDateKey(row.bhuktiStart ?? row.start);
    const periodEnd = row.bhuktiEnd ?? row.end;
    for (const slice of listSixMonthSlices(periodStart, periodEnd)) {
      if (slice.start) dates.add(slice.start);
    }
  }
  return Array.from(dates).sort();
}

export function selectNearTopByScore<T>(
  items: T[],
  getScore: (item: T) => number,
  band = KOCHAR_NEAR_TOP_POINTS
): T[] {
  if (!items.length) return [];
  const max = Math.max(...items.map(getScore));
  return items.filter((item) => getScore(item) >= max - band);
}

function sourceKey(row: MarriageBhuktiWindow): string {
  return `${row.maha}-${row.bhukti}-${isoDateKey(row.bhuktiStart ?? row.start)}`;
}

function dashaBaseWindow(row: MarriageBhuktiWindow): MarriageBhuktiWindow {
  const dashaNotes = row.dashaNotes ?? row.notes;
  return {
    ...row,
    score: row.dashaScore ?? row.score,
    verdict: row.dashaScore >= 65 ? "strong" : row.dashaScore >= 35 ? "supportive" : "weak",
    notes: dashaNotes,
    dashaNotes,
    kocharApplied: false,
    kocharScore: undefined,
    kocharHits: undefined,
  };
}

function kocharRank(slice: MarriageBhuktiWindow): number {
  return slice.kocharScore ?? -1;
}

export function narrowSlicesByKochar(
  original: MarriageBhuktiWindow,
  scoredSlices: MarriageBhuktiWindow[]
): MarriageBhuktiWindow[] {
  const withSky = scoredSlices.filter((slice) => slice.kocharApplied);
  const pool = withSky.length ? withSky : scoredSlices;
  const fallback = [
    {
      ...original,
      bhuktiStart: original.bhuktiStart ?? original.start,
      bhuktiEnd: original.bhuktiEnd ?? original.end,
    },
  ];
  if (!pool.length) return fallback;
  const winners = selectNearTopByScore(pool, kocharRank);
  if (!winners.length) return fallback;
  const restoreFullPeriod = (row: MarriageBhuktiWindow): MarriageBhuktiWindow => ({
    ...row,
    start: original.bhuktiStart ?? original.start,
    end: original.bhuktiEnd ?? original.end,
    bhuktiStart: original.bhuktiStart ?? original.start,
    bhuktiEnd: original.bhuktiEnd ?? original.end,
  });
  const firstRank = kocharRank(pool[0]);
  const everySliceTied = pool.every((slice) => kocharRank(slice) === firstRank);
  if (everySliceTied) {
    return [restoreFullPeriod(winners[0])];
  }
  return [...winners].sort((a, b) => a.start.localeCompare(b.start, "en", { numeric: true }));
}

function rasiForHouse(ascendantRasi: number, houseNumber: 3 | 7 | 11): number {
  return (ascendantRasi + houseNumber - 1) % 12;
}

function roleWeight(role: PeriodMatchRole): number {
  switch (role) {
    case "7th-lord":
      return 4;
    case "shukra":
    case "guru":
    case "7th-bhava":
      return 3;
    case "11th-lord":
    case "3rd-lord":
    case "11th-bhava":
    case "3rd-bhava":
    case "7th-conjunct":
      return 2;
    case "3rd-conjunct":
    case "11th-conjunct":
      return 1;
  }
}

function intersectsMarriageHouses(roles: PeriodMatchRole[]): boolean {
  return roles.some((role) => MARRIAGE_HOUSE_ROLES.includes(role));
}

function scoreDashaRoles(lang: MarriageLang, roleList: PeriodMatchRole[]) {
  let score = roleList.reduce((sum, role) => sum + roleWeight(role), 0) * 8;
  if (roleList.includes("7th-lord") && roleList.includes("shukra")) score += 14;
  if (roleList.includes("7th-lord") && roleList.includes("guru")) score += 12;
  if (roleList.includes("shukra") && roleList.includes("guru")) score += 10;
  if (roleList.includes("7th-lord") && roleList.includes("7th-bhava")) score += 12;
  if (roleList.includes("7th-bhava") && roleList.includes("7th-conjunct")) score += 8;
  if (
    roleList.includes("3rd-lord") &&
    roleList.includes("7th-lord") &&
    roleList.includes("11th-lord")
  ) {
    score += 12;
  }
  score = clampScore(score);
  const verdict: MarriageBhuktiWindow["verdict"] =
    score >= 65 ? "strong" : score >= 35 ? "supportive" : "weak";
  const notes: string[] = [];
  if (roleList.includes("7th-lord")) notes.push(mp.periodNote7th(lang));
  if (roleList.includes("shukra")) notes.push(mp.periodNoteShukra(lang));
  if (roleList.includes("guru")) notes.push(mp.periodNoteGuru(lang));
  if (roleList.includes("3rd-lord") || roleList.includes("11th-lord")) {
    notes.push(mp.periodNoteHouseLords(lang));
  }
  if (roleList.includes("7th-bhava") || roleList.includes("7th-conjunct")) {
    notes.push(mp.periodNote7thBhava(lang));
  }
  if (
    roleList.includes("3rd-bhava") ||
    roleList.includes("11th-bhava") ||
    roleList.includes("3rd-conjunct") ||
    roleList.includes("11th-conjunct")
  ) {
    notes.push(mp.periodNoteHouseBhava(lang));
  }
  return { score, verdict, notes };
}

function planetRef(
  row: { planetId: number; planetEn: string; planetTa: string } | undefined
) {
  if (!row) return null;
  return { planetId: row.planetId, planetEn: row.planetEn, planetTa: row.planetTa };
}

export function marriageAdultFromIso(dob: string, adultAge = MARRIAGE_ADULT_AGE_YEARS): string {
  return addYearsIso(dob || "1970-01-01", adultAge);
}

export function marriageMaxAgeIso(dob: string, maxAge = MARRIAGE_MAX_AGE_YEARS): string {
  return addYearsIso(dob || "1970-01-01", maxAge);
}

export function listMarriageBhuktiWindows(
  chart: ChartDataPayload,
  lang: MarriageLang = "en",
  adultAge = MARRIAGE_ADULT_AGE_YEARS,
  maxAge = MARRIAGE_MAX_AGE_YEARS
): MarriageBhuktiWindow[] {
  const lordMap = {
    3: SIGN_LORD[rasiForHouse(chart.birth.ascendantRasi, 3)],
    7: SIGN_LORD[rasiForHouse(chart.birth.ascendantRasi, 7)],
    11: SIGN_LORD[rasiForHouse(chart.birth.ascendantRasi, 11)],
  } as const;

  const roleByPlanetId = new Map<number, PeriodMatchRole[]>();
  const addRole = (planetId: number, role: PeriodMatchRole) => {
    const current = roleByPlanetId.get(planetId) ?? [];
    if (!current.includes(role)) current.push(role);
    roleByPlanetId.set(planetId, current);
  };

  addRole(lordMap[3], "3rd-lord");
  addRole(lordMap[7], "7th-lord");
  addRole(lordMap[11], "11th-lord");

  const shukra = planetRef(chart.natalPlanets.find((planet) => planet.planetId === 5));
  const guru = planetRef(chart.natalPlanets.find((planet) => planet.planetId === 4));
  if (shukra) addRole(shukra.planetId, "shukra");
  if (guru) addRole(guru.planetId, "guru");

  for (const reading of collectMarriageBhavaReadings(chart)) {
    const occupantRole =
      reading.houseNumber === 3
        ? "3rd-bhava"
        : reading.houseNumber === 7
          ? "7th-bhava"
          : "11th-bhava";
    const conjunctRole =
      reading.houseNumber === 3
        ? "3rd-conjunct"
        : reading.houseNumber === 7
          ? "7th-conjunct"
          : "11th-conjunct";
    for (const occupant of reading.occupants) addRole(occupant.planetId, occupantRole);
    for (const conjunct of reading.conjuncts) addRole(conjunct.planetId, conjunctRole);
  }

  const adultFrom = marriageAdultFromIso(chart.meta.dob, adultAge);
  const adultUntil = marriageMaxAgeIso(chart.meta.dob, maxAge);

  return (chart.vimsottari.bhukti as BhuktiRow[])
    .filter((row) => {
      const start = isoDateKey(row.start);
      return start >= adultFrom && start <= adultUntil;
    })
    .map((row): MarriageBhuktiWindow | null => {
      const matchedRoles = new Set<PeriodMatchRole>();
      for (const lord of [row.maha, row.lord]) {
        for (const role of roleByPlanetId.get(lord) ?? []) matchedRoles.add(role);
      }
      const roleList = Array.from(matchedRoles);
      if (!intersectsMarriageHouses(roleList)) return null;
      const scored = scoreDashaRoles(lang, roleList);
      return {
        maha: row.maha,
        bhukti: row.lord,
        start: row.start,
        end: row.end,
        bhuktiStart: row.start,
        bhuktiEnd: row.end,
        matchedRoles: roleList,
        dashaScore: scored.score,
        score: scored.score,
        verdict: scored.verdict,
        notes: scored.notes,
        dashaNotes: scored.notes,
        kocharApplied: false,
      };
    })
    .filter((row): row is MarriageBhuktiWindow => row !== null);
}

export function applyMoonKocharToBhuktiWindow(
  row: MarriageBhuktiWindow,
  natalPlanets: ChartDataPayload["natalPlanets"],
  transitPlanets: TransitRasiPlanet[],
  lang: MarriageLang = "en"
): MarriageBhuktiWindow {
  const base = dashaBaseWindow(row);
  const kochar = evaluateMoonMarriageKochar(natalPlanets, transitPlanets, lang);
  const mixed = mixDashaWithMoonKochar(base, kochar);
  return { ...mixed, dashaNotes: base.dashaNotes, kocharApplied: true };
}

function snapshotsByIsoDate(
  snapshotsByDate: Map<string, TransitRasiPlanet[]>
): Map<string, TransitRasiPlanet[]> {
  const normalized = new Map<string, TransitRasiPlanet[]>();
  for (const [key, planets] of snapshotsByDate) {
    const dateKey = isoDateKey(key);
    if (dateKey && planets?.length) normalized.set(dateKey, planets);
  }
  return normalized;
}

export function scoreMoonKocharSlices(
  row: MarriageBhuktiWindow,
  natalPlanets: ChartDataPayload["natalPlanets"],
  snapshotsByDate: Map<string, TransitRasiPlanet[]>,
  lang: MarriageLang = "en"
): { base: MarriageBhuktiWindow; scoredSlices: MarriageBhuktiWindow[] } {
  const byDate = snapshotsByIsoDate(snapshotsByDate);
  const periodStart = isoDateKey(row.bhuktiStart ?? row.start);
  const periodEnd = row.bhuktiEnd ?? row.end;
  const base = {
    ...dashaBaseWindow(row),
    bhuktiStart: periodStart,
    bhuktiEnd: periodEnd,
    start: periodStart,
    end: periodEnd,
  };
  const scoredSlices = listSixMonthSlices(periodStart, periodEnd).map((slice) => {
    const sliceRow: MarriageBhuktiWindow = {
      ...base,
      start: slice.start,
      end: slice.end,
    };
    const transitPlanets = byDate.get(slice.start);
    if (!transitPlanets?.length) return sliceRow;
    return applyMoonKocharToBhuktiWindow(sliceRow, natalPlanets, transitPlanets, lang);
  });
  return { base, scoredSlices };
}

export function overlayMoonKocharOnWindows(
  windows: MarriageBhuktiWindow[],
  natalPlanets: ChartDataPayload["natalPlanets"],
  snapshotsByDate: Map<string, TransitRasiPlanet[]>,
  lang: MarriageLang = "en"
): MarriageBhuktiWindow[] {
  return windows.flatMap((row) => {
    const { base, scoredSlices } = scoreMoonKocharSlices(
      row,
      natalPlanets,
      snapshotsByDate,
      lang
    );
    return narrowSlicesByKochar(base, scoredSlices);
  });
}

export function currentBhuktiWindow(
  windows: MarriageBhuktiWindow[],
  asOfIso: string
): MarriageBhuktiWindow | null {
  const asOf = isoDateKey(asOfIso);
  const annotated = windows.map((row) => ({
    row,
    key: sourceKey(row),
    sourceStart: isoDateKey(row.bhuktiStart ?? row.start),
    sliceStart: isoDateKey(row.start),
    sliceEnd: row.end ? isoDateKey(row.end) : "9999-12-31",
  }));
  const runningKey = [...annotated]
    .filter((item) => item.sourceStart <= asOf)
    .sort((a, b) => a.sourceStart.localeCompare(b.sourceStart, "en", { numeric: true }))
    .at(-1)?.key;
  if (!runningKey) return null;
  const ofSource = annotated.filter((item) => item.key === runningKey);
  const containing = ofSource.filter(
    (item) => item.sliceStart <= asOf && asOf < item.sliceEnd
  );
  const pick = containing.length ? containing : ofSource;
  return (
    [...pick].sort((a, b) => {
      const scoreDelta = (b.row.kocharScore ?? -1) - (a.row.kocharScore ?? -1);
      if (scoreDelta) return scoreDelta;
      return a.sliceStart.localeCompare(b.sliceStart, "en", { numeric: true });
    })[0]?.row ?? null
  );
}

export function formatBhuktiRoles(lang: MarriageLang, roles: PeriodMatchRole[]): string {
  return formatMatchedRoles(lang, roles);
}
