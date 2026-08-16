import type { ChartDataPayload, PlanetRow } from "@/types/chartData";
import { buildAllHouseAnalyses } from "@/lib/prediction/house-analysis";
import type { HouseAnalysis, HouseNumber } from "@/lib/prediction/house-analysis";
import {
  formatMatchedRoles,
  isBaselineNoChallengeNote,
  mp,
  rasiName,
  type MarriageLang,
} from "./marriageLocale";
import {
  currentBhuktiWindow,
  listMarriageBhuktiWindows,
  overlayMoonKocharOnWindows,
  type MarriageBhuktiWindow,
} from "./marriageBhuktiWindows";
import {
  evaluateMoonMarriageKochar,
  type MoonKocharReading,
} from "./marriageMoonKochar";
import type { TransitRasiPlanet, KocharHit } from "./marriageKochar";

type MarriageHouseNumber = 3 | 7 | 11;

type PlanetReference = {
  planetId: number;
  planetEn: string;
  planetTa: string;
};

type MarriageHouseSignal = {
  houseNumber: MarriageHouseNumber;
  signEn: string;
  signTa: string;
  houseLord: PlanetReference;
  structuralScore: number;
  aggregateScore: number;
  positives: string[];
  challenges: string[];
  summary: string;
};

type InfluenceCheck = {
  present: boolean;
  mode: "aspect" | "conjunction" | null;
  notes: string[];
};

type PlanetPlacementReading = {
  planet: PlanetReference;
  houseFromAsc: HouseNumber;
  signEn: string;
  signTa: string;
  dignity: "ucham" | "neecham" | "moolatrikona" | "own_sign" | "ordinary";
  strength: number;
  notes: string[];
  rahuInfluence: InfluenceCheck;
  shaniInfluence: InfluenceCheck;
};

export type PeriodMatchRole =
  | "3rd-lord"
  | "7th-lord"
  | "11th-lord"
  | "shukra"
  | "guru"
  | "3rd-bhava"
  | "7th-bhava"
  | "11th-bhava"
  | "3rd-conjunct"
  | "7th-conjunct"
  | "11th-conjunct";

export type MarriageSequenceRow = {
  maha: number;
  bhukti: number;
  antara: number;
  start: string;
  end: string | null;
  matchedRoles: PeriodMatchRole[];
  dashaScore: number;
  score: number;
  verdict: "strong" | "supportive" | "weak";
  notes: string[];
  kocharScore?: number;
  kocharHits?: KocharHit[];
};

type MarriageFoundation = {
  summary: string;
  seventhLord: PlanetPlacementReading | null;
  shukraKarakathuva: PlanetPlacementReading | null;
  guruKarakathuva: PlanetPlacementReading | null;
  marriageHouses: MarriageHouseSignal[];
  positives: string[];
  challenges: string[];
};

type MarriagePeriodSequence = {
  current: MarriageBhuktiWindow | null;
  upcoming: MarriageBhuktiWindow[];
  windows: MarriageBhuktiWindow[];
  summary: string;
};

export type MarriagePrediction = {
  generatedAt: string;
  overview: {
    marriageStrengthScore: number;
    activationScore: number;
    summary: string;
  };
  foundation: MarriageFoundation;
  moonKochar: MoonKocharReading | null;
  periodSequence: MarriagePeriodSequence;
  reasoning: {
    positives: string[];
    challenges: string[];
  };
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

const UCHAM_RASI: Partial<Record<number, number>> = {
  0: 0,
  1: 1,
  2: 9,
  3: 5,
  4: 3,
  5: 11,
  6: 6,
};

const NEECHAM_RASI: Partial<Record<number, number>> = {
  0: 6,
  1: 7,
  2: 3,
  3: 11,
  4: 9,
  5: 5,
  6: 0,
};

const MOOLATRIKONA_RASI: Partial<Record<number, number>> = {
  0: 4,
  1: 1,
  2: 0,
  3: 5,
  4: 8,
  5: 6,
  6: 10,
};

const OWN_SIGNS: Partial<Record<number, number[]>> = {
  0: [4],
  1: [3],
  2: [0, 7],
  3: [2, 5],
  4: [8, 11],
  5: [1, 6],
  6: [9, 10],
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

function houseFromRasi(ascendantRasi: number, rasi: number): HouseNumber {
  return (((rasi - ascendantRasi + 12) % 12) + 1) as HouseNumber;
}

function rasiForHouse(ascendantRasi: number, houseNumber: HouseNumber): number {
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

function planetRef(row: PlanetRow): PlanetReference {
  return {
    planetId: row.planetId,
    planetEn: row.planetEn,
    planetTa: row.planetTa,
  };
}

function planetLabel(lang: MarriageLang, row: PlanetRow): string {
  return lang === "en" ? row.planetEn : row.planetTa;
}

function houseSignal(house: HouseAnalysis): MarriageHouseSignal {
  return {
    houseNumber: house.houseNumber as MarriageHouseNumber,
    signEn: house.signEn,
    signTa: house.signTa,
    houseLord: house.bhavagam.houseLord,
    structuralScore: house.finalSynthesis.structuralScore,
    aggregateScore: house.finalSynthesis.aggregateScore,
    positives: house.finalSynthesis.positives,
    challenges: house.finalSynthesis.challenges,
    summary: house.finalSynthesis.summary,
  };
}

function dignityState(
  planetId: number,
  rasi: number
): "ucham" | "neecham" | "moolatrikona" | "own_sign" | "ordinary" {
  if (UCHAM_RASI[planetId] === rasi) return "ucham";
  if (NEECHAM_RASI[planetId] === rasi) return "neecham";
  if (MOOLATRIKONA_RASI[planetId] === rasi) return "moolatrikona";
  if (OWN_SIGNS[planetId]?.includes(rasi)) return "own_sign";
  return "ordinary";
}

function dignityStrength(
  dignity: "ucham" | "neecham" | "moolatrikona" | "own_sign" | "ordinary"
): number {
  switch (dignity) {
    case "ucham":
      return 24;
    case "moolatrikona":
      return 20;
    case "own_sign":
      return 16;
    case "neecham":
      return 4;
    default:
      return 10;
  }
}

function influenceCheck(
  chart: ChartDataPayload,
  target: PlanetRow,
  influencerId: 6 | 7,
  lang: MarriageLang
): InfluenceCheck {
  const influencer = chart.natalPlanets.find((planet) => planet.planetId === influencerId);
  if (!influencer) {
    return { present: false, mode: null, notes: [] };
  }
  if (influencer.rasi === target.rasi) {
    return {
      present: true,
      mode: "conjunction",
      notes: [
        mp.conjunctNote(
          lang,
          planetLabel(lang, influencer),
          planetLabel(lang, target)
        ),
      ],
    };
  }
  const influencerHouse = houseFromRasi(chart.birth.ascendantRasi, influencer.rasi);
  const targetHouse = houseFromRasi(chart.birth.ascendantRasi, target.rasi);
  if (grahaDrishtiTargets(influencerId, influencerHouse).includes(targetHouse)) {
    return {
      present: true,
      mode: "aspect",
      notes: [
        mp.aspectNote(
          lang,
          planetLabel(lang, influencer),
          planetLabel(lang, target)
        ),
      ],
    };
  }
  return { present: false, mode: null, notes: [] };
}

function buildPlacementReading(
  chart: ChartDataPayload,
  row: PlanetRow | null,
  roleLabel: string,
  lang: MarriageLang
): PlanetPlacementReading | null {
  if (!row) return null;
  const houseFromAsc = houseFromRasi(chart.birth.ascendantRasi, row.rasi);
  const dignity = dignityState(row.planetId, row.rasi);
  const rahuInfluence = influenceCheck(chart, row, 7, lang);
  const shaniInfluence = influenceCheck(chart, row, 6, lang);
  let strength = 48 + dignityStrength(dignity);
  const signDisplay = rasiName(lang, row.rasi);
  const notes = [mp.placementOpen(lang, roleLabel, signDisplay, houseFromAsc)];
  if (dignity !== "ordinary") {
    notes.push(mp.dignityLine(lang, roleLabel, dignity));
  }
  if (houseFromAsc === 7) {
    strength += 8;
    notes.push(mp.seventhHouse(lang, roleLabel));
  }
  if (houseFromAsc === 6 || houseFromAsc === 8 || houseFromAsc === 12) {
    strength -= 8;
    notes.push(mp.dusthana(lang, roleLabel));
  }
  if (rahuInfluence.present) {
    strength -= 10;
    notes.push(...rahuInfluence.notes);
  }
  if (shaniInfluence.present) {
    strength -= 8;
    notes.push(...shaniInfluence.notes);
  }
  return {
    planet: planetRef(row),
    houseFromAsc,
    signEn: rasiName("en", row.rasi),
    signTa: rasiName("ta", row.rasi),
    dignity,
    strength: clampScore(strength),
    notes,
    rahuInfluence,
    shaniInfluence,
  };
}


export function buildMarriagePrediction(
  chart: ChartDataPayload,
  lang: MarriageLang = "en",
  asOfIso?: string,
  transitsByDate?: Map<string, TransitRasiPlanet[]>
): MarriagePrediction {
  const houseBundle = buildAllHouseAnalyses(chart, lang);
  const marriageHouses = ([3, 7, 11] as const).map((houseNumber) =>
    houseSignal(houseBundle.houses[houseNumber - 1])
  );
  const lordMap: Record<MarriageHouseNumber, number> = {
    3: SIGN_LORD[rasiForHouse(chart.birth.ascendantRasi, 3)],
    7: SIGN_LORD[rasiForHouse(chart.birth.ascendantRasi, 7)],
    11: SIGN_LORD[rasiForHouse(chart.birth.ascendantRasi, 11)],
  };

  const seventhLordRow = chart.natalPlanets.find((planet) => planet.planetId === lordMap[7]) ?? null;
  const shukraRow = chart.natalPlanets.find((planet) => planet.planetId === 5) ?? null;
  const guruRow = chart.natalPlanets.find((planet) => planet.planetId === 4) ?? null;

  const seventhLordLabel = lang === "en" ? "7th lord" : "7ஆம் அதிபதி";
  const shukraLabel = lang === "en" ? "Shukra" : "சுக்கிரன்";
  const guruLabel = lang === "en" ? "Guru" : "குரு";

  const seventhLord = buildPlacementReading(chart, seventhLordRow, seventhLordLabel, lang);
  const shukraKarakathuva = buildPlacementReading(chart, shukraRow, shukraLabel, lang);
  const guruKarakathuva = buildPlacementReading(chart, guruRow, guruLabel, lang);

  const currentIso = (
    asOfIso ??
    chart.transit.computedAt ??
    new Date().toISOString()
  ).slice(0, 10);
  const windows = overlayMoonKocharOnWindows(
    listMarriageBhuktiWindows(chart, lang),
    chart.natalPlanets,
    transitsByDate ?? new Map(),
    lang
  );
  const current = currentBhuktiWindow(windows, currentIso);
  const upcoming = windows.filter((row) => row.start.slice(0, 10) > currentIso);
  const periodSequence: MarriagePeriodSequence = {
    current,
    upcoming,
    windows,
    summary: current
      ? mp.periodSummaryCurrent(
          lang,
          current.verdict,
          current.score,
          formatMatchedRoles(lang, current.matchedRoles)
        )
      : mp.periodSummaryNone(lang),
  };
  const currentTransits = current
    ? transitsByDate?.get(current.start.slice(0, 10))
    : undefined;
  const moonKochar = currentTransits?.length
    ? evaluateMoonMarriageKochar(chart.natalPlanets, currentTransits, lang)
    : null;

  const houseAverage =
    marriageHouses.reduce((sum, house) => sum + house.aggregateScore, 0) / marriageHouses.length;
  const foundationScore = clampScore(
    houseAverage * 0.45 +
      (seventhLord?.strength ?? 0) * 0.3 +
      (shukraKarakathuva?.strength ?? 0) * 0.15 +
      (guruKarakathuva?.strength ?? 0) * 0.1
  );
  const activationScore = clampScore(current?.score ?? 0);

  const positives = [
    ...marriageHouses.flatMap((house) =>
      house.positives.map((item) => mp.housePositive(lang, house.houseNumber, item))
    ),
  ];
  const challenges = [
    ...marriageHouses.flatMap((house) =>
      house.challenges
        .filter((item) => !isBaselineNoChallengeNote(item))
        .map((item) => mp.houseChallenge(lang, house.houseNumber, item))
    ),
  ];

  if (seventhLord && !seventhLord.rahuInfluence.present && !seventhLord.shaniInfluence.present) {
    positives.push(mp.pos7thNoRahuShani(lang));
  }
  if (seventhLord?.rahuInfluence.present) challenges.push(mp.chRahu7th(lang));
  if (seventhLord?.shaniInfluence.present) challenges.push(mp.chShani7th(lang));
  if (shukraKarakathuva?.rahuInfluence.present) challenges.push(mp.chRahuShukra(lang));
  if (shukraKarakathuva?.shaniInfluence.present) challenges.push(mp.chShaniShukra(lang));

  const foundationSummaryParts = [mp.foundationOpen(lang)];
  if (seventhLord) {
    const pName = lang === "en" ? seventhLord.planet.planetEn : seventhLord.planet.planetTa;
    const sign = lang === "en" ? seventhLord.signEn : seventhLord.signTa;
    foundationSummaryParts.push(
      mp.foundation7th(lang, pName, sign, seventhLord.houseFromAsc)
    );
  }
  if (shukraKarakathuva) {
    const sign = lang === "en" ? shukraKarakathuva.signEn : shukraKarakathuva.signTa;
    foundationSummaryParts.push(
      mp.foundationShukra(lang, sign, shukraKarakathuva.houseFromAsc)
    );
  }
  if (seventhLord?.rahuInfluence.present || seventhLord?.shaniInfluence.present) {
    foundationSummaryParts.push(mp.foundation7thPressure(lang));
  }
  if (shukraKarakathuva?.rahuInfluence.present || shukraKarakathuva?.shaniInfluence.present) {
    foundationSummaryParts.push(mp.foundationShukraPressure(lang));
  }

  const overviewSummary = [
    mp.overviewStrength(lang, foundationScore),
    mp.overviewActivation(lang, activationScore),
    periodSequence.summary,
  ].join(" ");

  return {
    generatedAt: houseBundle.generatedAt,
    overview: {
      marriageStrengthScore: foundationScore,
      activationScore,
      summary: overviewSummary,
    },
    foundation: {
      summary: foundationSummaryParts.join(" "),
      seventhLord,
      shukraKarakathuva,
      guruKarakathuva,
      marriageHouses,
      positives: positives.slice(0, 8),
      challenges: challenges.slice(0, 8),
    },
    moonKochar,
    periodSequence,
    reasoning: {
      positives: positives.slice(0, 10),
      challenges: challenges.slice(0, 10),
    },
  };
}
