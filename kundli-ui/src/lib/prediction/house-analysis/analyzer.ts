import type { AntaraRow, BhuktiRow, ChartDataPayload, MahadashaRow, PlanetRow } from "@/types/chartData";
import {
  HOUSE_CORE_MEANINGS,
  HOUSE_KARAKAS,
  MOOLATRIKONA_RASI,
  NEECHAM_RASI,
  OWN_SIGNS,
  PLANET_NAMES_EN,
  PLANET_NAMES_TA,
  RASI_NAMES_EN,
  RASI_NAMES_TA,
  SIGN_LORD,
  UCHAM_RASI,
} from "./constants";
import type {
  DignityState,
  HouseActivation,
  HouseAnalysis,
  HouseAnalysisBundle,
  HouseAnalysisInput,
  HouseAspectAnalysis,
  HouseKarakaStrength,
  HouseLordStrength,
  HouseNumber,
  HouseOccupantAnalysis,
  InfluenceRole,
  PlanetReference,
} from "./types";
import { ha, type AnalyzerLang, dignityPhrase, houseDisplayLabel, rasiLabelForLang } from "./locale";

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

function planetRef(planetId: number): PlanetReference {
  return {
    planetId,
    planetEn: PLANET_NAMES_EN[planetId] ?? String(planetId),
    planetTa: PLANET_NAMES_TA[planetId] ?? String(planetId),
  };
}

function planetRefFromRow(row: PlanetRow): PlanetReference {
  return {
    planetId: row.planetId,
    planetEn: row.planetEn,
    planetTa: row.planetTa,
  };
}

function dignityState(planetId: number, rasi: number): DignityState {
  if (UCHAM_RASI[planetId] === rasi) return "ucham";
  if (NEECHAM_RASI[planetId] === rasi) return "neecham";
  if (MOOLATRIKONA_RASI[planetId] === rasi) return "moolatrikona";
  if (OWN_SIGNS[planetId]?.includes(rasi)) return "own_sign";
  return "ordinary";
}

function dignityStrength(state: DignityState): number {
  switch (state) {
    case "ucham":
      return 18;
    case "moolatrikona":
      return 15;
    case "own_sign":
      return 12;
    case "neecham":
      return 2;
    default:
      return 8;
  }
}

function naturalInfluenceRole(planetId: number): InfluenceRole {
  if (planetId === 4 || planetId === 5 || planetId === 1) return "support";
  if (planetId === 3) return "mixed";
  return "challenge";
}

function influenceBaseStrength(planetId: number, dignity: DignityState): number {
  const base =
    naturalInfluenceRole(planetId) === "support"
      ? 8
      : naturalInfluenceRole(planetId) === "mixed"
        ? 6
        : 7;
  if (dignity === "ucham") return base + 3;
  if (dignity === "moolatrikona") return base + 2;
  if (dignity === "own_sign") return base + 1.5;
  if (dignity === "neecham") return Math.max(2, base - 2.5);
  return base;
}

function housePlacementStrength(houseNumber: HouseNumber): number {
  if ([1, 4, 5, 7, 9, 10].includes(houseNumber)) return 11;
  if ([2, 3, 11].includes(houseNumber)) return 9;
  if ([6, 8, 12].includes(houseNumber)) return 6;
  return 8;
}

function buildHouseLordStrength(
  chart: ChartDataPayload,
  houseNumber: HouseNumber,
  lang: AnalyzerLang
): HouseLordStrength | null {
  const signRasi = rasiForHouse(chart.birth.ascendantRasi, houseNumber);
  const lordPlanetId = SIGN_LORD[signRasi];
  const row = chart.natalPlanets.find((planet) => planet.planetId === lordPlanetId);
  if (!row) return null;
  const lordHouse = houseFromRasi(chart.birth.ascendantRasi, row.rasi);
  const dignity = dignityState(row.planetId, row.rasi);
  const rasiName = rasiLabelForLang(lang, row.rasi);
  const notes = ha.lordBhavagamLine(lang, row.planetTa, houseNumber, rasiName, lordHouse);
  if (dignity === "ucham") notes.push(ha.lordDignityNote(lang, "ucham"));
  if (dignity === "neecham") notes.push(ha.lordDignityNote(lang, "neecham"));
  if (dignity === "moolatrikona") notes.push(ha.lordDignityNote(lang, "moolatrikona"));
  if (dignity === "own_sign") notes.push(ha.lordDignityNote(lang, "own_sign"));

  return {
    ...planetRefFromRow(row),
    signRasi: row.rasi,
    signEn: RASI_NAMES_EN[row.rasi],
    signTa: RASI_NAMES_TA[row.rasi],
    houseFromAsc: lordHouse,
    dignity,
    strength: clampScore(dignityStrength(dignity) * 4 + housePlacementStrength(lordHouse) * 3),
    notes,
  };
}

function buildOccupants(
  chart: ChartDataPayload,
  houseNumber: HouseNumber,
  lang: AnalyzerLang
): HouseOccupantAnalysis[] {
  return chart.natalPlanets
    .filter((planet) => houseFromRasi(chart.birth.ascendantRasi, planet.rasi) === houseNumber)
    .map((planet) => {
      const dignity = dignityState(planet.planetId, planet.rasi);
      const role = naturalInfluenceRole(planet.planetId);
      const notes = [ha.occupantBase(lang, planet.planetTa)];
      if (role === "support") notes.push(ha.occupantRoleSupport(lang));
      if (role === "challenge") notes.push(ha.occupantRoleChallenge(lang));
      if (role === "mixed") notes.push(ha.occupantRoleMixed(lang));
      if (dignity !== "ordinary") notes.push(dignityPhrase(lang, dignity));
      return {
        ...planetRefFromRow(planet),
        dignity,
        role,
        strength: clampScore(influenceBaseStrength(planet.planetId, dignity) * 8),
        notes,
      };
    });
}

function buildAspectors(
  chart: ChartDataPayload,
  houseNumber: HouseNumber,
  lang: AnalyzerLang
): HouseAspectAnalysis[] {
  return chart.natalPlanets
    .filter((planet) =>
      grahaDrishtiTargets(
        planet.planetId,
        houseFromRasi(chart.birth.ascendantRasi, planet.rasi)
      ).includes(houseNumber)
    )
    .map((planet) => {
      const dignity = dignityState(planet.planetId, planet.rasi);
      const role = naturalInfluenceRole(planet.planetId);
      const sourceHouse = houseFromRasi(chart.birth.ascendantRasi, planet.rasi);
      const notes = [ha.aspectFromHouse(lang, planet.planetTa, sourceHouse)];
      if (role === "support") notes.push(ha.aspectSupport(lang));
      if (role === "challenge") notes.push(ha.aspectChallenge(lang));
      if (role === "mixed") notes.push(ha.aspectMixed(lang));
      return {
        ...planetRefFromRow(planet),
        aspectType: "graha_drishti",
        role,
        strength: clampScore((influenceBaseStrength(planet.planetId, dignity) + 1) * 7),
        notes,
      };
    });
}

function activeRow<T extends { start: string; end: string | null }>(
  rows: T[],
  currentIso: string
): T | null {
  return (
    rows.find((row) => row.start.slice(0, 10) <= currentIso && (row.end == null || row.end.slice(0, 10) > currentIso)) ??
    null
  );
}

function buildActivation(
  chart: ChartDataPayload,
  houseNumber: HouseNumber,
  lang: AnalyzerLang
): HouseActivation {
  const currentIso = (chart.transit.computedAt ?? new Date().toISOString()).slice(0, 10);
  const maha = activeRow(chart.vimsottari.mahadasha as Array<MahadashaRow & { end: string | null }>, currentIso);
  const bhukti = activeRow(chart.vimsottari.bhukti as Array<BhuktiRow & { end: string | null }>, currentIso);
  const antara = activeRow(chart.vimsottari.antara as Array<AntaraRow & { end: string | null }>, currentIso);
  const houseRasi = rasiForHouse(chart.birth.ascendantRasi, houseNumber);
  const houseLord = SIGN_LORD[houseRasi];
  const occupants = chart.natalPlanets.filter(
    (planet) => houseFromRasi(chart.birth.ascendantRasi, planet.rasi) === houseNumber
  );
  const activatedBy: string[] = [];
  let score = 0;

  for (const [label, row] of [
    ["mahadasha", maha],
    ["bhukti", bhukti],
    ["antara", antara],
  ] as const) {
    if (!row) continue;
    if (row.lord === houseLord) {
      activatedBy.push(ha.dashaLordIsBhavagamLord(lang, label));
      score += label === "mahadasha" ? 25 : label === "bhukti" ? 18 : 10;
    }
    if (occupants.some((planet) => planet.planetId === row.lord)) {
      activatedBy.push(ha.dashaLordOccupiesHouse(lang, label));
      score += label === "mahadasha" ? 22 : label === "bhukti" ? 16 : 9;
    }
  }

  const transitOccupants = chart.transitPlanets.filter(
    (planet) => houseFromRasi(chart.birth.ascendantRasi, planet.rasi) === houseNumber
  );
  if (transitOccupants.length) {
    activatedBy.push(
      ha.transitActivation(
        lang,
        transitOccupants.map((planet) => planet.planetTa).join(", ")
      )
    );
    score += Math.min(20, transitOccupants.length * 6);
  }

  return {
    mahaLord: maha ? planetRef(maha.lord) : null,
    bhuktiLord: bhukti ? planetRef(bhukti.lord) : null,
    antaraLord: antara ? planetRef(antara.lord) : null,
    activatedBy,
    score: clampScore(score),
  };
}

function buildKarakas(
  chart: ChartDataPayload,
  houseNumber: HouseNumber,
  lang: AnalyzerLang
): {
  karakas: HouseAnalysis["karakam"]["karakas"];
  karakaAthibathi: HouseKarakaStrength[];
  totalKarakaStrength: number;
} {
  const karakas = HOUSE_KARAKAS[houseNumber].map((entry) => ({
    planet: planetRef(entry.planetId),
    area: entry.area,
  }));
  const karakaAthibathi = HOUSE_KARAKAS[houseNumber]
    .map((entry): HouseKarakaStrength | null => {
      const row = chart.natalPlanets.find((planet) => planet.planetId === entry.planetId);
      if (!row) return null;
      const houseFromAsc = houseFromRasi(chart.birth.ascendantRasi, row.rasi);
      const dignity = dignityState(row.planetId, row.rasi);
      const notes = [
        ha.karakaSupportLine(lang, row.planetTa, entry.area),
        ha.karakaPlacementLine(
          lang,
          row.planetTa,
          rasiLabelForLang(lang, row.rasi),
          houseFromAsc
        ),
      ];
      if (dignity !== "ordinary") notes.push(ha.karakaDignity(lang, dignity));
      return {
        ...planetRefFromRow(row),
        area: entry.area,
        signRasi: row.rasi,
        signEn: RASI_NAMES_EN[row.rasi],
        signTa: RASI_NAMES_TA[row.rasi],
        houseFromAsc,
        dignity,
        strength: clampScore(dignityStrength(dignity) * 4 + housePlacementStrength(houseFromAsc) * 2.5),
        notes,
      };
    })
    .filter((value): value is HouseKarakaStrength => value !== null);

  const totalKarakaStrength =
    karakaAthibathi.length === 0
      ? 0
      : clampScore(
          karakaAthibathi.reduce((sum, karaka) => sum + karaka.strength, 0) /
            karakaAthibathi.length
        );

  return { karakas, karakaAthibathi, totalKarakaStrength };
}

function summarize(
  houseNumber: HouseNumber,
  signDisplay: string,
  houseLordStrength: HouseLordStrength | null,
  occupants: HouseOccupantAnalysis[],
  aspectsToHouse: HouseAspectAnalysis[],
  activation: HouseActivation,
  lang: AnalyzerLang
): {
  positives: string[];
  challenges: string[];
  summary: string;
} {
  const positives: string[] = [];
  const challenges: string[] = [];

  if (houseLordStrength && houseLordStrength.strength >= 60) {
    positives.push(ha.lordStrengthPositive(lang));
  }
  if (houseLordStrength?.dignity === "ucham" || houseLordStrength?.dignity === "moolatrikona") {
    positives.push(ha.lordDignityPositive(lang, houseLordStrength.dignity));
  }

  for (const occupant of occupants) {
    if (occupant.role === "support") positives.push(ha.occupantSupportInner(lang, occupant.planetTa));
    if (occupant.role === "challenge") challenges.push(ha.occupantPressure(lang, occupant.planetTa));
    if (occupant.role === "mixed") challenges.push(ha.occupantMixed(lang, occupant.planetTa));
  }

  for (const aspect of aspectsToHouse) {
    if (aspect.role === "support") positives.push(ha.aspectSupportive(lang, aspect.planetTa));
    if (aspect.role === "challenge") challenges.push(ha.aspectPressure(lang, aspect.planetTa));
  }

  if (activation.activatedBy.length) {
    positives.push(ha.timingActivatesHouse(lang, houseNumber));
  }

  if (!positives.length) positives.push(ha.fallbackPositive(lang));
  if (!challenges.length) challenges.push(ha.fallbackChallenge(lang));

  const summaryParts = [ha.summaryHead(lang, houseNumber, signDisplay)];
  if (houseLordStrength) {
    summaryParts.push(ha.summaryLord(lang, houseLordStrength.planetTa, houseLordStrength.houseFromAsc));
  }
  if (occupants.length) {
    summaryParts.push(
      ha.summaryOccupants(
        lang,
        occupants.map((occupant) => occupant.planetTa).join(", ")
      )
    );
  }
  if (aspectsToHouse.length) {
    summaryParts.push(
      ha.summaryAspects(
        lang,
        aspectsToHouse.map((aspect) => aspect.planetTa).join(", ")
      )
    );
  }
  if (activation.activatedBy.length) {
    summaryParts.push(ha.summaryActivation(lang));
  }

  return {
    positives: positives.slice(0, 3),
    challenges: challenges.slice(0, 3),
    summary: summaryParts.join(" "),
  };
}

export function buildHouseAnalysis(
  chart: HouseAnalysisInput,
  houseNumber: HouseNumber,
  lang: AnalyzerLang = "en"
): HouseAnalysis {
  const signRasi = rasiForHouse(chart.birth.ascendantRasi, houseNumber);
  const signEn = RASI_NAMES_EN[signRasi];
  const signTa = RASI_NAMES_TA[signRasi];
  const signDisplay = lang === "ta" ? signTa : signEn;
  const houseLord = planetRef(SIGN_LORD[signRasi]);
  const houseLordStrength = buildHouseLordStrength(chart, houseNumber, lang);
  const occupants = buildOccupants(chart, houseNumber, lang);
  const aspectsToHouse = buildAspectors(chart, houseNumber, lang);
  const karakam = buildKarakas(chart, houseNumber, lang);
  const activation = buildActivation(chart, houseNumber, lang);

  const occupantAverage =
    occupants.length === 0
      ? 0
      : occupants.reduce((sum, occupant) => sum + occupant.strength, 0) / occupants.length;
  const aspectAverage =
    aspectsToHouse.length === 0
      ? 0
      : aspectsToHouse.reduce((sum, aspect) => sum + aspect.strength, 0) / aspectsToHouse.length;

  const supportiveOccupants = occupants.filter((occupant) => occupant.role === "support").length;
  const challengingOccupants = occupants.filter((occupant) => occupant.role === "challenge").length;
  const supportiveAspects = aspectsToHouse.filter((aspect) => aspect.role === "support").length;
  const challengingAspects = aspectsToHouse.filter((aspect) => aspect.role === "challenge").length;

  const bhavagamStrength = clampScore(
    30 +
      (houseLordStrength?.strength ?? 40) * 0.35 +
      occupantAverage * 0.18 +
      aspectAverage * 0.12 +
      supportiveOccupants * 4 +
      supportiveAspects * 3 -
      challengingOccupants * 5 -
      challengingAspects * 4
  );

  const structuralScore = clampScore(bhavagamStrength * 0.7 + karakam.totalKarakaStrength * 0.3);
  const aggregateScore = clampScore(structuralScore * 0.75 + activation.score * 0.25);
  const synthesis = summarize(
    houseNumber,
    signDisplay,
    houseLordStrength,
    occupants,
    aspectsToHouse,
    activation,
    lang
  );

  return {
    houseNumber,
    signRasi,
    signEn,
    signTa,
    bhavagam: {
      houseLabel: houseDisplayLabel(lang, houseNumber),
      coreMeanings: HOUSE_CORE_MEANINGS[houseNumber],
      houseLord,
      houseLordStrength,
      occupants,
      aspectsToHouse,
      bhavagamStrength,
    },
    karakam,
    finalSynthesis: {
      structuralScore,
      activationScore: activation.score,
      aggregateScore,
      positives: synthesis.positives,
      challenges: synthesis.challenges,
      summary: synthesis.summary,
    },
  };
}

export function buildAllHouseAnalyses(
  chart: HouseAnalysisInput,
  lang: AnalyzerLang = "en"
): HouseAnalysisBundle {
  const houses = Array.from({ length: 12 }, (_, index) =>
    buildHouseAnalysis(chart, (index + 1) as HouseNumber, lang)
  );
  return {
    generatedAt: chart.transit.computedAt ?? new Date().toISOString(),
    ascendantRasi: chart.birth.ascendantRasi,
    houses,
  };
}
