/**
 * South Indian Rasi chart: fixed cell positions (0-based rasi index, matching PyJHora / horoscope.py).
 */
export type RasiCell = { rasi: number; row: number; col: number };

export const RASI_GRID: RasiCell[] = [
  { rasi: 11, row: 1, col: 1 },
  { rasi: 0, row: 1, col: 2 },
  { rasi: 1, row: 1, col: 3 },
  { rasi: 2, row: 1, col: 4 },
  { rasi: 10, row: 2, col: 1 },
  { rasi: 3, row: 2, col: 4 },
  { rasi: 9, row: 3, col: 1 },
  { rasi: 4, row: 3, col: 4 },
  { rasi: 8, row: 4, col: 1 },
  { rasi: 7, row: 4, col: 2 },
  { rasi: 6, row: 4, col: 3 },
  { rasi: 5, row: 4, col: 4 },
];

export const RASI_TAMIL: Record<number, string> = {
  0: "மேஷம்",
  1: "ரிஷபம்",
  2: "மிதுனம்",
  3: "கடகம்",
  4: "சிம்மம்",
  5: "கன்னி",
  6: "துலாம்",
  7: "விருச்சிகம்",
  8: "தனுசு",
  9: "மகரம்",
  10: "கும்பம்",
  11: "மீனம்",
};

export const PLANET_TAMIL: Record<string, string> = {
  Sun: "சூ",
  Moon: "சந்",
  Mars: "செ",
  Mercury: "பு",
  Jupiter: "குரு",
  Venus: "சுக்",
  Saturn: "சனி",
  Rahu: "ரா",
  Ketu: "கே",
};

/** Normalize JSON string keys to numeric rasi indices. */
export type PlanetsByRasiInput = Record<number, string[]> | Record<string, string[]>;

export function normalizePlanetsByRasi(input: PlanetsByRasiInput): Record<number, string[]> {
  const out: Record<number, string[]> = {};
  for (const [key, names] of Object.entries(input)) {
    const rasi = Number(key);
    if (!Number.isFinite(rasi) || rasi < 0 || rasi > 11) continue;
    out[rasi] = names;
  }
  return out;
}

export function getPlanetFullName(englishName: string): string {
  return englishName;
}

export function getPlanetLabel(englishName: string): string {
  return PLANET_TAMIL[englishName] ?? englishName.slice(0, 2);
}

export function getPlanetsInRasi(
  rasi: number,
  planetsByRasi: Record<number, string[]>
): string[] {
  return planetsByRasi[rasi] ?? [];
}

export interface SouthIndianChartProps {
  planetsByRasi: PlanetsByRasiInput;
  ascendantRasi: number;
  highlightedRasis?: number[];
  title?: string;
  onRasiClick?: (rasi: number) => void;
  theme?: "light" | "dark";
}
