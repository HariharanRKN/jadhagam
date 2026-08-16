import type { HouseNumber } from "@/lib/prediction/house-analysis";
import type { PlanetRow } from "@/types/chartData";
import { mp, rasiName, type MarriageLang } from "./marriageLocale";

export type GuruKocharReading = {
  transitHouseFromAsc: HouseNumber;
  looksAtSeventhHouse: boolean;
  looksAtEleventhHouse: boolean;
  favorable: boolean;
  notes: string[];
};

export type TransitRasiPlanet = {
  planetId: number;
  rasi: number;
};

export type KocharRole =
  | "guru"
  | "shukra"
  | "7th-lord"
  | "11th-lord"
  | "shani"
  | "rahu";

export type KocharHitKind = "support" | "confirm" | "caution";

export type KocharHit = {
  planetId: number;
  role: KocharRole;
  mode: "occupy" | "aspect" | "natal-conjunct" | "natal-aspect";
  target: string;
  weight: number;
  kind: KocharHitKind;
  note: string;
};

export type MarriageKocharReading = {
  score: number;
  favorable: boolean;
  delayRisk: boolean;
  hits: KocharHit[];
  notes: string[];
  guru: GuruKocharReading | null;
};

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

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

function houseFromRasi(ascendantRasi: number, rasi: number): HouseNumber {
  return (((rasi - ascendantRasi + 12) % 12) + 1) as HouseNumber;
}

function rasiForHouse(ascendantRasi: number, houseNumber: number): number {
  return (ascendantRasi + houseNumber - 1) % 12;
}

function grahaDrishtiTargets(planetId: number, houseNumber: HouseNumber): HouseNumber[] {
  const offsets = new Set<number>([7]);
  if (planetId === 2) {
    offsets.add(4);
    offsets.add(8);
  }
  if (planetId === 4) {
    offsets.add(5);
    offsets.add(9);
  }
  if (planetId === 6) {
    offsets.add(3);
    offsets.add(10);
  }
  return Array.from(offsets).map(
    (offset) => (((houseNumber + offset - 2) % 12) + 1) as HouseNumber
  );
}

function findPlanet(
  planets: TransitRasiPlanet[],
  planetId: number
): TransitRasiPlanet | null {
  return planets.find((planet) => planet.planetId === planetId) ?? null;
}

function influenceHouse(
  planetId: number,
  fromHouse: HouseNumber,
  targetHouse: number
): "occupy" | "aspect" | null {
  if (fromHouse === targetHouse) return "occupy";
  if (grahaDrishtiTargets(planetId, fromHouse).includes(targetHouse as HouseNumber)) {
    return "aspect";
  }
  return null;
}

function influenceNatalRasi(
  planetId: number,
  fromHouse: HouseNumber,
  natalHouse: HouseNumber
): "natal-conjunct" | "natal-aspect" | null {
  if (fromHouse === natalHouse) return "natal-conjunct";
  if (grahaDrishtiTargets(planetId, fromHouse).includes(natalHouse)) {
    return "natal-aspect";
  }
  return null;
}

function roleLabel(lang: MarriageLang, role: KocharRole): string {
  return mp.kocharRole(lang, role);
}

function dusthana(house: number): boolean {
  return house === 6 || house === 8 || house === 12;
}

function houseWeight(house: number): number {
  if (house === 7) return 10;
  if (house === 11) return 8;
  if (house === 2) return 6;
  if (house === 1) return 5;
  if (house === 5) return 4;
  return 3;
}

function collectHouseHits(
  lang: MarriageLang,
  planet: TransitRasiPlanet,
  role: KocharRole,
  fromHouse: HouseNumber,
  houses: number[],
  kind: KocharHitKind
): KocharHit[] {
  const hits: KocharHit[] = [];
  const label = roleLabel(lang, role);
  for (const house of houses) {
    const mode = influenceHouse(planet.planetId, fromHouse, house);
    if (!mode) continue;
    hits.push({
      planetId: planet.planetId,
      role,
      mode,
      target: `house-${house}`,
      weight: kind === "caution" ? Math.min(4, houseWeight(house) / 2) : houseWeight(house),
      kind,
      note: mp.kocharHouseHit(lang, label, mode, house),
    });
  }
  return hits;
}

function collectNatalHits(
  lang: MarriageLang,
  planet: TransitRasiPlanet,
  role: KocharRole,
  fromHouse: HouseNumber,
  natalHouse: HouseNumber,
  natalLabel: string,
  kind: KocharHitKind
): KocharHit[] {
  const mode = influenceNatalRasi(planet.planetId, fromHouse, natalHouse);
  if (!mode) return [];
  const label = roleLabel(lang, role);
  return [
    {
      planetId: planet.planetId,
      role,
      mode,
      target: natalLabel,
      weight: kind === "caution" ? 3 : mode === "natal-conjunct" ? 8 : 6,
      kind,
      note: mp.kocharNatalHit(lang, label, mode, natalLabel),
    },
  ];
}

export function evaluateMarriageKochar(
  ascendantRasi: number,
  natalPlanets: Array<Pick<PlanetRow, "planetId" | "rasi">>,
  transitPlanets: TransitRasiPlanet[],
  lang: MarriageLang = "en"
): MarriageKocharReading {
  const seventhLordId = SIGN_LORD[rasiForHouse(ascendantRasi, 7)];
  const eleventhLordId = SIGN_LORD[rasiForHouse(ascendantRasi, 11)];
  const natalSeventh = findPlanet(natalPlanets, seventhLordId);
  const natalShukra = findPlanet(natalPlanets, 5);
  const natalGuru = findPlanet(natalPlanets, 4);

  const transitGuru = findPlanet(transitPlanets, 4);
  const transitShukra = findPlanet(transitPlanets, 5);
  const transitSeventh = findPlanet(transitPlanets, seventhLordId);
  const transitEleventh = findPlanet(transitPlanets, eleventhLordId);
  const transitShani = findPlanet(transitPlanets, 6);
  const transitRahu = findPlanet(transitPlanets, 7);

  const hits: KocharHit[] = [];

  if (transitGuru) {
    const house = houseFromRasi(ascendantRasi, transitGuru.rasi);
    hits.push(
      ...collectHouseHits(lang, transitGuru, "guru", house, [2, 5, 7, 11], "support")
    );
    if (natalSeventh) {
      hits.push(
        ...collectNatalHits(
          lang,
          transitGuru,
          "guru",
          house,
          houseFromRasi(ascendantRasi, natalSeventh.rasi),
          lang === "en" ? "natal 7th lord" : "ஜனன 7ஆம் அதிபதி",
          "support"
        )
      );
    }
    if (natalShukra) {
      hits.push(
        ...collectNatalHits(
          lang,
          transitGuru,
          "guru",
          house,
          houseFromRasi(ascendantRasi, natalShukra.rasi),
          lang === "en" ? "natal Shukra" : "ஜனன சுக்கிரன்",
          "support"
        )
      );
    }
    if (dusthana(house)) {
      hits.push({
        planetId: 4,
        role: "guru",
        mode: "occupy",
        target: `house-${house}`,
        weight: -6,
        kind: "caution",
        note: mp.kocharDusthana(lang, roleLabel(lang, "guru"), house),
      });
    }
  }

  if (transitShukra) {
    const house = houseFromRasi(ascendantRasi, transitShukra.rasi);
    hits.push(
      ...collectHouseHits(lang, transitShukra, "shukra", house, [1, 2, 7, 11], "support")
    );
    if (natalSeventh) {
      hits.push(
        ...collectNatalHits(
          lang,
          transitShukra,
          "shukra",
          house,
          houseFromRasi(ascendantRasi, natalSeventh.rasi),
          lang === "en" ? "natal 7th lord" : "ஜனன 7ஆம் அதிபதி",
          "support"
        )
      );
    }
    if (natalGuru) {
      hits.push(
        ...collectNatalHits(
          lang,
          transitShukra,
          "shukra",
          house,
          houseFromRasi(ascendantRasi, natalGuru.rasi),
          lang === "en" ? "natal Guru" : "ஜனன குரு",
          "support"
        )
      );
    }
    if (dusthana(house)) {
      hits.push({
        planetId: 5,
        role: "shukra",
        mode: "occupy",
        target: `house-${house}`,
        weight: -6,
        kind: "caution",
        note: mp.kocharDusthana(lang, roleLabel(lang, "shukra"), house),
      });
    }
  }

  if (transitSeventh) {
    const house = houseFromRasi(ascendantRasi, transitSeventh.rasi);
    hits.push(
      ...collectHouseHits(
        lang,
        transitSeventh,
        "7th-lord",
        house,
        [1, 7, 11],
        "support"
      )
    );
    if (natalShukra) {
      hits.push(
        ...collectNatalHits(
          lang,
          transitSeventh,
          "7th-lord",
          house,
          houseFromRasi(ascendantRasi, natalShukra.rasi),
          lang === "en" ? "natal Shukra" : "ஜனன சுக்கிரன்",
          "support"
        )
      );
    }
    if (dusthana(house)) {
      hits.push({
        planetId: seventhLordId,
        role: "7th-lord",
        mode: "occupy",
        target: `house-${house}`,
        weight: -5,
        kind: "caution",
        note: mp.kocharDusthana(lang, roleLabel(lang, "7th-lord"), house),
      });
    }
  }

  if (transitEleventh && transitEleventh.planetId !== transitSeventh?.planetId) {
    const house = houseFromRasi(ascendantRasi, transitEleventh.rasi);
    hits.push(
      ...collectHouseHits(
        lang,
        transitEleventh,
        "11th-lord",
        house,
        [7, 11],
        "support"
      )
    );
  }

  if (transitShani) {
    const house = houseFromRasi(ascendantRasi, transitShani.rasi);
    hits.push(
      ...collectHouseHits(lang, transitShani, "shani", house, [7], "confirm")
    );
    if (natalSeventh) {
      hits.push(
        ...collectNatalHits(
          lang,
          transitShani,
          "shani",
          house,
          houseFromRasi(ascendantRasi, natalSeventh.rasi),
          lang === "en" ? "natal 7th lord" : "ஜனன 7ஆம் அதிபதி",
          "confirm"
        )
      );
    }
  }

  if (transitRahu) {
    const house = houseFromRasi(ascendantRasi, transitRahu.rasi);
    if (house === 7 || (natalShukra && transitRahu.rasi === natalShukra.rasi)) {
      hits.push({
        planetId: 7,
        role: "rahu",
        mode: house === 7 ? "occupy" : "natal-conjunct",
        target: house === 7 ? "house-7" : "natal-shukra",
        weight: 4,
        kind: "caution",
        note: mp.kocharRahuMixed(lang, house === 7 ? 7 : houseFromRasi(ascendantRasi, natalShukra!.rasi)),
      });
    }
  }

  const supportRoles = new Set(
    hits.filter((hit) => hit.kind === "support" && hit.weight > 0).map((hit) => hit.role)
  );
  const guruSupport = supportRoles.has("guru");
  const shukraSupport = supportRoles.has("shukra");
  const seventhSupport = supportRoles.has("7th-lord");
  const shaniOnSeventh = hits.some(
    (hit) => hit.role === "shani" && hit.target === "house-7" && hit.weight > 0
  );

  if (guruSupport && shukraSupport) {
    hits.push({
      planetId: 4,
      role: "guru",
      mode: "aspect",
      target: "combo-guru-shukra",
      weight: 10,
      kind: "support",
      note: mp.kocharCombo(lang, "guru-shukra"),
    });
  }
  if (guruSupport && seventhSupport) {
    hits.push({
      planetId: 4,
      role: "guru",
      mode: "aspect",
      target: "combo-guru-7th",
      weight: 10,
      kind: "support",
      note: mp.kocharCombo(lang, "guru-7th"),
    });
  }
  if (shukraSupport && seventhSupport) {
    hits.push({
      planetId: 5,
      role: "shukra",
      mode: "aspect",
      target: "combo-shukra-7th",
      weight: 8,
      kind: "support",
      note: mp.kocharCombo(lang, "shukra-7th"),
    });
  }
  if (guruSupport && shaniOnSeventh) {
    hits.push({
      planetId: 6,
      role: "shani",
      mode: "aspect",
      target: "combo-double-transit",
      weight: 12,
      kind: "confirm",
      note: mp.kocharCombo(lang, "guru-shani"),
    });
  }

  const delayRisk = shaniOnSeventh && !guruSupport && !shukraSupport && !seventhSupport;
  if (delayRisk) {
    hits.push({
      planetId: 6,
      role: "shani",
      mode: "occupy",
      target: "house-7",
      weight: -4,
      kind: "caution",
      note: mp.kocharShaniDelay(lang),
    });
  }

  const rawScore = hits.reduce((sum, hit) => sum + hit.weight, 0);
  const score = clampScore(rawScore);
  const favorable = guruSupport || shukraSupport || seventhSupport;

  const guruHouse = transitGuru
    ? houseFromRasi(ascendantRasi, transitGuru.rasi)
    : null;
  const guruLooks7 = transitGuru
    ? Boolean(influenceHouse(4, guruHouse!, 7))
    : false;
  const guruLooks11 = transitGuru
    ? Boolean(influenceHouse(4, guruHouse!, 11))
    : false;
  const guru: GuruKocharReading | null = transitGuru && guruHouse
    ? {
        transitHouseFromAsc: guruHouse,
        looksAtSeventhHouse: guruLooks7,
        looksAtEleventhHouse: guruLooks11,
        favorable: guruLooks7 || guruLooks11,
        notes: [
          mp.guruKocharIn(lang, rasiName(lang, transitGuru.rasi), guruHouse),
          ...(guruLooks7 ? [mp.guruLooks7(lang)] : []),
          ...(guruLooks11 ? [mp.guruLooks11(lang)] : []),
          ...(!guruLooks7 && !guruLooks11 ? [mp.guruNotSupporting(lang)] : []),
        ],
      }
    : null;

  const notes = [
    ...(guru ? guru.notes : []),
    ...hits
      .filter((hit) => hit.kind !== "support" || hit.target.startsWith("combo-") || hit.target.startsWith("natal") || hit.target.startsWith("house-"))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 8)
      .map((hit) => hit.note),
  ];
  const uniqueNotes = Array.from(new Set(notes));

  return {
    score,
    favorable,
    delayRisk,
    hits,
    notes: uniqueNotes,
    guru,
  };
}

export function applyKocharToMarriageRow<
  T extends {
    dashaScore?: number;
    score: number;
    verdict: "strong" | "supportive" | "weak";
    notes: string[];
  },
>(row: T, kochar: MarriageKocharReading): T & {
  dashaScore: number;
  kocharScore: number;
  kocharHits: KocharHit[];
} {
  const dashaScore = row.dashaScore ?? row.score;
  const kocharScore = Math.max(0, Math.min(22, kochar.score));
  const score = clampScore(
    dashaScore + (kochar.favorable ? kocharScore : Math.min(6, kocharScore))
  );
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
