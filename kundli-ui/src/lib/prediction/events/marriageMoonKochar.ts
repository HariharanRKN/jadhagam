import type { PlanetRow } from "@/types/chartData";
import { mp, type MarriageLang } from "./marriageLocale";
import type { HouseNumber } from "@/lib/prediction/house-analysis";
import type { KocharHit, KocharHitKind, KocharRole, TransitRasiPlanet } from "./marriageKochar";

export const MOON_MARRIAGE_HOUSES = [7, 3, 11] as const;
export type MoonMarriageHouse = (typeof MOON_MARRIAGE_HOUSES)[number];

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

const PLANET_EN = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];
const PLANET_TA = [
  "சூரியன்",
  "சந்திரன்",
  "செவ்வாய்",
  "புதன்",
  "குரு",
  "சுக்கிரன்",
  "சனி",
  "ராகு",
  "கேது",
];

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

function houseFromRasi(lagnaRasi: number, rasi: number): HouseNumber {
  return (((rasi - lagnaRasi + 12) % 12) + 1) as HouseNumber;
}

function rasiForHouse(lagnaRasi: number, houseNumber: number): number {
  return (lagnaRasi + houseNumber - 1) % 12;
}

function grahaDrishtiTargets(planetId: number, fromHouse: HouseNumber): HouseNumber[] {
  const offsets = new Set<number>([7]);
  if (planetId === 4) {
    offsets.add(5);
    offsets.add(9);
  }
  return Array.from(offsets).map(
    (offset) => (((fromHouse + offset - 2) % 12) + 1) as HouseNumber
  );
}

function findPlanet(
  planets: Array<Pick<PlanetRow, "planetId" | "rasi">>,
  planetId: number
): Pick<PlanetRow, "planetId" | "rasi"> | null {
  return planets.find((planet) => planet.planetId === planetId) ?? null;
}

function planetName(lang: MarriageLang, planetId: number): string {
  return lang === "en" ? PLANET_EN[planetId] ?? String(planetId) : PLANET_TA[planetId] ?? String(planetId);
}

function houseFactor(house: MoonMarriageHouse): number {
  return house === 7 ? 1 : 0.72;
}

/** Guru is the clock (year-scale); Venus confirms (month-scale). */
function hitWeight(
  role: "guru" | "shukra",
  mode: "occupy" | "aspect" | "natal-conjunct",
  house: MoonMarriageHouse
): number {
  const base =
    role === "guru"
      ? mode === "occupy"
        ? 42
        : mode === "aspect"
          ? 30
          : 24
      : mode === "occupy"
        ? 16
        : mode === "aspect"
          ? 11
          : 9;
  return Math.round(base * houseFactor(house) * 10) / 10;
}

function influenceHouse(
  planetId: number,
  fromHouse: HouseNumber,
  targetHouse: MoonMarriageHouse
): "occupy" | "aspect" | null {
  if (fromHouse === targetHouse) return "occupy";
  if (grahaDrishtiTargets(planetId, fromHouse).includes(targetHouse as HouseNumber)) {
    return "aspect";
  }
  return null;
}

export type MoonKocharReading = {
  moonRasi: number | null;
  score: number;
  favorable: boolean;
  guruLinked: boolean;
  shukraLinked: boolean;
  hits: KocharHit[];
  notes: string[];
};

export function evaluateMoonMarriageKochar(
  natalPlanets: Array<Pick<PlanetRow, "planetId" | "rasi">>,
  transitPlanets: TransitRasiPlanet[],
  lang: MarriageLang = "en"
): MoonKocharReading {
  const natalMoon = findPlanet(natalPlanets, 1);
  const transitGuru = findPlanet(transitPlanets, 4);
  const transitShukra = findPlanet(transitPlanets, 5);
  if (!natalMoon) {
    return {
      moonRasi: null,
      score: 0,
      favorable: false,
      guruLinked: false,
      shukraLinked: false,
      hits: [],
      notes: [],
    };
  }

  const moonRasi = natalMoon.rasi;
  const hits: KocharHit[] = [];
  const linkedRoles = new Set<"guru" | "shukra">();

  const natalLordByHouse = new Map<MoonMarriageHouse, number>();
  for (const house of MOON_MARRIAGE_HOUSES) {
    natalLordByHouse.set(house, SIGN_LORD[rasiForHouse(moonRasi, house)]);
  }

  function collectPlanet(
    transit: Pick<PlanetRow, "planetId" | "rasi">,
    role: "guru" | "shukra"
  ) {
    const fromHouse = houseFromRasi(moonRasi, transit.rasi);
    const occupied = new Set<MoonMarriageHouse>();
    const label = role === "guru" ? (lang === "en" ? "Guru" : "குரு") : lang === "en" ? "Venus" : "சுக்கிரன்";

    for (const house of MOON_MARRIAGE_HOUSES) {
      const mode = influenceHouse(transit.planetId, fromHouse, house);
      if (!mode) continue;
      if (mode === "occupy") occupied.add(house);
      linkedRoles.add(role);
      hits.push({
        planetId: transit.planetId,
        role: role as KocharRole,
        mode,
        target: `moon-house-${house}`,
        weight: hitWeight(role, mode, house),
        kind: "support" as KocharHitKind,
        note: mp.kocharFromMoonHouse(lang, label, mode, house),
      });
    }

    for (const house of MOON_MARRIAGE_HOUSES) {
      if (occupied.has(house)) continue;
      const lordId = natalLordByHouse.get(house);
      if (lordId == null) continue;
      const natalLord = findPlanet(natalPlanets, lordId);
      if (!natalLord || natalLord.rasi !== transit.rasi) continue;
      linkedRoles.add(role);
      hits.push({
        planetId: transit.planetId,
        role: role as KocharRole,
        mode: "natal-conjunct",
        target: `moon-lord-${house}`,
        weight: hitWeight(role, "natal-conjunct", house),
        kind: "support",
        note: mp.kocharFromMoonLordConjunct(lang, label, house, planetName(lang, lordId)),
      });
    }
  }

  if (transitGuru) collectPlanet(transitGuru, "guru");
  if (transitShukra) collectPlanet(transitShukra, "shukra");

  const guruLinked = linkedRoles.has("guru");
  const shukraLinked = linkedRoles.has("shukra");

  if (transitGuru && transitShukra && transitGuru.rasi === transitShukra.rasi) {
    const togetherHouse = houseFromRasi(moonRasi, transitGuru.rasi);
    if (MOON_MARRIAGE_HOUSES.includes(togetherHouse as MoonMarriageHouse)) {
      hits.push({
        planetId: 4,
        role: "guru",
        mode: "natal-conjunct",
        target: `together-moon-house-${togetherHouse}`,
        weight: 8,
        kind: "support",
        note: mp.kocharGuruVenusTogetherFromMoon(lang, togetherHouse),
      });
    }
  }

  if (guruLinked && shukraLinked) {
    hits.push({
      planetId: 4,
      role: "guru",
      mode: "aspect",
      target: "combo-guru-shukra-moon",
      weight: 12,
      kind: "support",
      note: mp.kocharGuruVenusBothLinked(lang),
    });
  }

  const score = clampScore(hits.reduce((sum, hit) => sum + hit.weight, 0));
  const notes = hits
    .slice()
    .sort((a, b) => b.weight - a.weight)
    .map((hit) => hit.note);

  return {
    moonRasi,
    score,
    favorable: guruLinked || shukraLinked,
    guruLinked,
    shukraLinked,
    hits,
    notes,
  };
}

export function mixDashaWithMoonKochar<
  T extends {
    dashaScore?: number;
    score: number;
    verdict: "strong" | "supportive" | "weak";
    notes: string[];
  },
>(row: T, kochar: MoonKocharReading): T & {
  dashaScore: number;
  kocharScore: number;
  kocharHits: KocharHit[];
} {
  const dashaScore = row.dashaScore ?? row.score;
  const kocharScore = kochar.score;
  const score = clampScore(dashaScore * 0.7 + kocharScore * 0.3);
  const verdict: T["verdict"] =
    score >= 65 ? "strong" : score >= 35 ? "supportive" : "weak";
  const kocharNotes = kochar.hits
    .filter((hit) => hit.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4)
    .map((hit) => hit.note);
  return {
    ...row,
    dashaScore,
    score,
    verdict,
    notes: Array.from(new Set([...row.notes, ...kocharNotes])),
    kocharScore,
    kocharHits: kochar.hits,
  };
}
