export type SkyPlanet = {
  planetId: number;
  planetEn: string;
  rasi: number;
  degInSign: number;
  totalLongitude: number;
};

export type SkyDay = {
  dateIst: string;
  positions: Record<string, SkyPlanet>;
};

export type SkyRangeResponse = {
  start: string;
  end: string;
  days: SkyDay[];
  missingCount: number;
  partial: boolean;
  coverageStart: string | null;
  coverageEnd: string | null;
  source: "sqlite" | "mixed" | "live";
};
