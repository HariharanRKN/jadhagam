export interface PlanetRow {
  planetId: number;
  planetEn: string;
  planetTa: string;
  rasi: number;
  rasiTa: string;
  degInSign: number;
  totalLongitude: number;
  nakshatraTa: string;
  pada: number;
}

export interface MahadashaRow {
  lord: number;
  start: string;
  end: string | null;
}

export interface BhuktiRow {
  maha: number;
  lord: number;
  start: string;
  end: string | null;
}

export interface AntaraRow {
  maha: number;
  bhukti: number;
  lord: number;
  start: string;
  end: string | null;
}

export interface SookshmaRow {
  maha: number;
  bhukti: number;
  antara: number;
  lord: number;
  start: string;
  end: string | null;
}

export interface VimsottariLabelsTa {
  mahadasha: string;
  bhukti: string;
  antara: string;
  sookshma: string;
  start: string;
  end: string;
  planet: string;
  rasi: string;
  deg: string;
  totalDegTa: string;
  nakshatra: string;
  pada: string;
  natalTitle: string;
  transitTitle: string;
  dashaTitle: string;
}

export interface ChartDataPayload {
  meta: {
    dob: string;
    tob: string;
    place: string;
    ayanamsa: string;
    nodes: string;
    name?: string;
    gender?: string;
  };
  birth: {
    planetsByRasi: Record<string, string[]>;
    ascendantRasi: number;
    ascendantDeg: number;
  };
  transit: {
    planetsByRasi: Record<string, string[]>;
    ascendantRasi: number;
    computedAt?: string;
  };
  natalPlanets: PlanetRow[];
  transitPlanets: PlanetRow[];
  vimsottari: {
    labelsTa: VimsottariLabelsTa;
    mahadasha: MahadashaRow[];
    bhukti: BhuktiRow[];
    antara: AntaraRow[];
    sookshma: SookshmaRow[];
  };
}
