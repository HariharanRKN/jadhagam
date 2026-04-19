import type { ChartDataPayload } from "@/types/chartData";

export type HouseNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type InfluenceRole = "support" | "challenge" | "mixed";

export type DignityState =
  | "ucham"
  | "neecham"
  | "moolatrikona"
  | "own_sign"
  | "ordinary";

export type PlanetReference = {
  planetId: number;
  planetEn: string;
  planetTa: string;
};

export type HouseOccupantAnalysis = PlanetReference & {
  dignity: DignityState;
  role: InfluenceRole;
  strength: number;
  notes: string[];
};

export type HouseAspectAnalysis = PlanetReference & {
  aspectType: "graha_drishti";
  role: InfluenceRole;
  strength: number;
  notes: string[];
};

export type HouseLordStrength = PlanetReference & {
  signRasi: number;
  signEn: string;
  signTa: string;
  houseFromAsc: HouseNumber;
  dignity: DignityState;
  strength: number;
  notes: string[];
};

export type HouseKarakaStrength = PlanetReference & {
  area: string;
  signRasi: number;
  signEn: string;
  signTa: string;
  houseFromAsc: HouseNumber;
  dignity: DignityState;
  strength: number;
  notes: string[];
};

export type HouseActivation = {
  mahaLord: PlanetReference | null;
  bhuktiLord: PlanetReference | null;
  antaraLord: PlanetReference | null;
  activatedBy: string[];
  score: number;
};

export type HouseAnalysis = {
  houseNumber: HouseNumber;
  signRasi: number;
  signEn: string;
  signTa: string;
  bhavagam: {
    houseLabel: string;
    coreMeanings: string[];
    houseLord: PlanetReference;
    houseLordStrength: HouseLordStrength | null;
    occupants: HouseOccupantAnalysis[];
    aspectsToHouse: HouseAspectAnalysis[];
    bhavagamStrength: number;
  };
  karakam: {
    karakas: Array<{
      planet: PlanetReference;
      area: string;
    }>;
    karakaAthibathi: HouseKarakaStrength[];
    totalKarakaStrength: number;
  };
  finalSynthesis: {
    structuralScore: number;
    activationScore: number;
    aggregateScore: number;
    positives: string[];
    challenges: string[];
    summary: string;
  };
};

export type HouseAnalysisBundle = {
  generatedAt: string;
  ascendantRasi: number;
  houses: HouseAnalysis[];
};

export type HouseAnalysisInput = ChartDataPayload;
