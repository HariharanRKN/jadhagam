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

type GuruKocharReading = {
  transitHouseFromAsc: HouseNumber;
  looksAtSeventhHouse: boolean;
  looksAtEleventhHouse: boolean;
  favorable: boolean;
  notes: string[];
};

type PeriodMatchRole =
  | "3rd-lord"
  | "7th-lord"
  | "11th-lord"
  | "shukra"
  | "guru";

type MarriageSequenceRow = {
  maha: number;
  bhukti: number;
  antara: number;
  start: string;
  end: string | null;
  matchedRoles: PeriodMatchRole[];
  score: number;
  verdict: "strong" | "supportive" | "weak";
  notes: string[];
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
  marriagePlanetSet: Array<{
    role: PeriodMatchRole;
    planet: PlanetReference;
  }>;
  current: MarriageSequenceRow | null;
  upcoming: MarriageSequenceRow[];
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
  guruKochar: GuruKocharReading | null;
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

function latestStartedRow<T extends { start: string }>(rows: T[], currentIso: string): T | null {
  return (
    [...rows]
      .filter((row) => row.start.slice(0, 10) <= currentIso)
      .sort((a, b) => a.start.localeCompare(b.start, "en", { numeric: true }))
      .at(-1) ?? null
  );
}

function roleWeight(role: PeriodMatchRole): number {
  switch (role) {
    case "7th-lord":
      return 4;
    case "shukra":
      return 3;
    case "guru":
      return 3;
    case "11th-lord":
      return 2;
    case "3rd-lord":
      return 2;
  }
}

function buildMarriageSequence(
  chart: ChartDataPayload,
  lordMap: Record<MarriageHouseNumber, number>,
  lang: MarriageLang
): MarriagePeriodSequence {
  const marriagePlanetSet: MarriagePeriodSequence["marriagePlanetSet"] = [
    {
      role: "3rd-lord",
      planet: planetRef(
        chart.natalPlanets.find((planet) => planet.planetId === lordMap[3])!
      ),
    },
    {
      role: "7th-lord",
      planet: planetRef(
        chart.natalPlanets.find((planet) => planet.planetId === lordMap[7])!
      ),
    },
    {
      role: "11th-lord",
      planet: planetRef(
        chart.natalPlanets.find((planet) => planet.planetId === lordMap[11])!
      ),
    },
    {
      role: "shukra",
      planet: planetRef(chart.natalPlanets.find((planet) => planet.planetId === 5)!),
    },
    {
      role: "guru",
      planet: planetRef(chart.natalPlanets.find((planet) => planet.planetId === 4)!),
    },
  ];

  const roleByPlanetId = new Map<number, PeriodMatchRole[]>();
  for (const entry of marriagePlanetSet) {
    const current = roleByPlanetId.get(entry.planet.planetId) ?? [];
    current.push(entry.role);
    roleByPlanetId.set(entry.planet.planetId, current);
  }

  const sequenceRows = chart.vimsottari.antara.map((row): MarriageSequenceRow => {
    const matchedRoles = new Set<PeriodMatchRole>();
    for (const lord of [row.maha, row.bhukti, row.lord]) {
      const roles = roleByPlanetId.get(lord) ?? [];
      for (const role of roles) matchedRoles.add(role);
    }
    const roleList = Array.from(matchedRoles);
    let score = roleList.reduce((sum, role) => sum + roleWeight(role), 0) * 8;
    if (roleList.includes("7th-lord") && roleList.includes("shukra")) score += 14;
    if (roleList.includes("7th-lord") && roleList.includes("guru")) score += 12;
    if (roleList.includes("shukra") && roleList.includes("guru")) score += 10;
    if (
      roleList.includes("3rd-lord") &&
      roleList.includes("7th-lord") &&
      roleList.includes("11th-lord")
    ) {
      score += 12;
    }
    score = clampScore(score);
    const verdict =
      score >= 65 ? "strong" : score >= 35 ? "supportive" : "weak";
    const notes: string[] = [];
    if (roleList.includes("7th-lord")) notes.push(mp.periodNote7th(lang));
    if (roleList.includes("shukra")) notes.push(mp.periodNoteShukra(lang));
    if (roleList.includes("guru")) notes.push(mp.periodNoteGuru(lang));
    if (
      roleList.includes("3rd-lord") ||
      roleList.includes("11th-lord")
    ) {
      notes.push(mp.periodNoteHouseLords(lang));
    }
    return {
      maha: row.maha,
      bhukti: row.bhukti,
      antara: row.lord,
      start: row.start,
      end: row.end,
      matchedRoles: roleList,
      score,
      verdict,
      notes,
    };
  });

  const currentIso = (chart.transit.computedAt ?? new Date().toISOString()).slice(0, 10);
  const current = latestStartedRow(sequenceRows, currentIso);
  const upcoming = sequenceRows
    .filter((row) => row.start.slice(0, 10) > currentIso)
    .sort((a, b) => b.score - a.score || a.start.localeCompare(b.start))
    .slice(0, 6);

  const summary = current
    ? mp.periodSummaryCurrent(
        lang,
        current.verdict,
        current.score,
        formatMatchedRoles(lang, current.matchedRoles)
      )
    : mp.periodSummaryNone(lang);

  return {
    marriagePlanetSet,
    current,
    upcoming,
    summary,
  };
}

function buildGuruKochar(chart: ChartDataPayload, lang: MarriageLang): GuruKocharReading | null {
  const guru = chart.transitPlanets.find((planet) => planet.planetId === 4);
  if (!guru) return null;
  const transitHouseFromAsc = houseFromRasi(chart.birth.ascendantRasi, guru.rasi);
  const targets = grahaDrishtiTargets(4, transitHouseFromAsc);
  const looksAtSeventhHouse = targets.includes(7) || transitHouseFromAsc === 7;
  const looksAtEleventhHouse = targets.includes(11) || transitHouseFromAsc === 11;
  const favorable = looksAtSeventhHouse || looksAtEleventhHouse;
  const notes = [mp.guruKocharIn(lang, rasiName(lang, guru.rasi), transitHouseFromAsc)];
  if (looksAtSeventhHouse) notes.push(mp.guruLooks7(lang));
  if (looksAtEleventhHouse) notes.push(mp.guruLooks11(lang));
  if (!favorable) notes.push(mp.guruNotSupporting(lang));
  return {
    transitHouseFromAsc,
    looksAtSeventhHouse,
    looksAtEleventhHouse,
    favorable,
    notes,
  };
}

export function buildMarriagePrediction(
  chart: ChartDataPayload,
  lang: MarriageLang = "en"
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
  const guruKochar = buildGuruKochar(chart, lang);
  const periodSequence = buildMarriageSequence(chart, lordMap, lang);

  const houseAverage =
    marriageHouses.reduce((sum, house) => sum + house.aggregateScore, 0) / marriageHouses.length;
  const foundationScore = clampScore(
    houseAverage * 0.45 +
      (seventhLord?.strength ?? 0) * 0.3 +
      (shukraKarakathuva?.strength ?? 0) * 0.15 +
      (guruKarakathuva?.strength ?? 0) * 0.1
  );
  const activationScore = clampScore(
    (periodSequence.current?.score ?? 0) * 0.7 + (guruKochar?.favorable ? 24 : 0)
  );

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
  if (guruKochar?.favorable) {
    positives.push(mp.posGuruKochar(lang));
  } else if (guruKochar) {
    challenges.push(mp.chGuruKochar(lang));
  }

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
    guruKochar?.favorable ? mp.overviewGuruYes(lang) : mp.overviewGuruNo(lang),
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
    guruKochar,
    periodSequence,
    reasoning: {
      positives: positives.slice(0, 10),
      challenges: challenges.slice(0, 10),
    },
  };
}
