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

export type MarriageBhuktiWindow = {
  maha: number;
  bhukti: number;
  start: string;
  end: string | null;
  matchedRoles: PeriodMatchRole[];
  dashaScore: number;
  score: number;
  verdict: "strong" | "supportive" | "weak";
  notes: string[];
  kocharScore?: number;
  kocharHits?: KocharHit[];
  kocharApplied: boolean;
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

function addYearsIso(isoDate: string, years: number): string {
  const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number);
  return `${year + years}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
      const start = row.start.slice(0, 10);
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
        matchedRoles: roleList,
        dashaScore: scored.score,
        score: scored.score,
        verdict: scored.verdict,
        notes: scored.notes,
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
  const kochar = evaluateMoonMarriageKochar(natalPlanets, transitPlanets, lang);
  const mixed = mixDashaWithMoonKochar(row, kochar);
  return { ...mixed, kocharApplied: true };
}

export function overlayMoonKocharOnWindows(
  windows: MarriageBhuktiWindow[],
  natalPlanets: ChartDataPayload["natalPlanets"],
  snapshotsByDate: Map<string, TransitRasiPlanet[]>,
  lang: MarriageLang = "en"
): MarriageBhuktiWindow[] {
  return windows.map((row) => {
    const transitPlanets = snapshotsByDate.get(row.start.slice(0, 10));
    if (!transitPlanets?.length) return row;
    return applyMoonKocharToBhuktiWindow(row, natalPlanets, transitPlanets, lang);
  });
}

export function currentBhuktiWindow(
  windows: MarriageBhuktiWindow[],
  asOfIso: string
): MarriageBhuktiWindow | null {
  const asOf = asOfIso.slice(0, 10);
  return (
    [...windows]
      .filter((row) => row.start.slice(0, 10) <= asOf)
      .sort((a, b) => a.start.localeCompare(b.start, "en", { numeric: true }))
      .at(-1) ?? null
  );
}

export function formatBhuktiRoles(lang: MarriageLang, roles: PeriodMatchRole[]): string {
  return formatMatchedRoles(lang, roles);
}
