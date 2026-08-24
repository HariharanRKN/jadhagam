import type { ChartDataPayload, PlanetRow } from "../types/chartData.ts";
import { natalRowsWithLagna, RASI_EN } from "./natalLagna.ts";
import { compareDashaStart, lordEnglish } from "./tamilDasha.ts";

export type KundaliSharePosition = {
  id: number;
  name: string;
  nameTa: string;
  rasiId: number;
  rasi: string;
  rasiTa: string;
  degInSign: number;
  totalLongitude: number;
  nakshatra: string;
  nakshatraTa: string;
  pada: number;
};

export type KundaliSharePeriod = {
  mahadasha: string;
  bhukti?: string;
  antara?: string;
  sookshma?: string;
  from: string;
  to: string | null;
};

export type KundaliShareJson = {
  meta: {
    name?: string;
    gender?: string;
    dob: string;
    tob: string;
    place: string;
    ayanamsa: string;
    nodes: string;
  };
  positions: KundaliSharePosition[];
  periods: {
    mahadasha: Array<{ lord: string; from: string; to: string | null }>;
    bhukti: KundaliSharePeriod[];
    antara: KundaliSharePeriod[];
    sookshma: KundaliSharePeriod[];
  };
};

function positionFromRow(row: PlanetRow): KundaliSharePosition {
  return {
    id: row.planetId,
    name: row.planetEn,
    nameTa: row.planetTa,
    rasiId: row.rasi,
    rasi: RASI_EN[row.rasi] ?? String(row.rasi),
    rasiTa: row.rasiTa,
    degInSign: row.degInSign,
    totalLongitude: row.totalLongitude,
    nakshatra: row.nakshatraEn ?? row.nakshatraTa,
    nakshatraTa: row.nakshatraTa,
    pada: row.pada,
  };
}

export function buildKundaliShareJson(chart: ChartDataPayload): KundaliShareJson {
  const positions = natalRowsWithLagna(
    chart.natalPlanets,
    chart.natalLagna,
    chart.birth
  ).map(positionFromRow);

  const mahadasha = [...chart.vimsottari.mahadasha]
    .sort((a, b) => compareDashaStart(a.start, b.start))
    .map((row) => ({
      lord: lordEnglish(row.lord),
      from: row.start,
      to: row.end,
    }));

  const bhukti = [...chart.vimsottari.bhukti]
    .sort((a, b) => compareDashaStart(a.start, b.start))
    .map((row) => ({
      mahadasha: lordEnglish(row.maha),
      bhukti: lordEnglish(row.lord),
      from: row.start,
      to: row.end,
    }));

  const antara = [...chart.vimsottari.antara]
    .sort((a, b) => compareDashaStart(a.start, b.start))
    .map((row) => ({
      mahadasha: lordEnglish(row.maha),
      bhukti: lordEnglish(row.bhukti),
      antara: lordEnglish(row.lord),
      from: row.start,
      to: row.end,
    }));

  const sookshma = [...chart.vimsottari.sookshma]
    .sort((a, b) => compareDashaStart(a.start, b.start))
    .map((row) => ({
      mahadasha: lordEnglish(row.maha),
      bhukti: lordEnglish(row.bhukti),
      antara: lordEnglish(row.antara),
      sookshma: lordEnglish(row.lord),
      from: row.start,
      to: row.end,
    }));

  const meta: KundaliShareJson["meta"] = {
    dob: chart.meta.dob,
    tob: chart.meta.tob,
    place: chart.meta.place,
    ayanamsa: chart.meta.ayanamsa,
    nodes: chart.meta.nodes,
  };
  if (chart.meta.name) meta.name = chart.meta.name;
  if (chart.meta.gender) meta.gender = chart.meta.gender;

  return {
    meta,
    positions,
    periods: { mahadasha, bhukti, antara, sookshma },
  };
}

export function kundaliShareFilename(chart: ChartDataPayload): string {
  const raw = (chart.meta.name || "kundali").trim().toLowerCase();
  const slug = raw.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "kundali";
  const dob = chart.meta.dob || "chart";
  return `${slug}-${dob}.json`;
}

export function stringifyKundaliShareJson(chart: ChartDataPayload): string {
  return `${JSON.stringify(buildKundaliShareJson(chart), null, 2)}\n`;
}
