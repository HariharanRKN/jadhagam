/** Vimsottari lord id 0..8 — same as PyJHora / horoscope.py PLANET_NAMES */
export const LORD_ID_TAMIL: Record<number, string> = {
  0: "சூரியன்",
  1: "சந்திரன்",
  2: "செவ்வாய்",
  3: "புதன்",
  4: "வியாழன்",
  5: "சுக்கிரன்",
  6: "சனி",
  7: "ராகு",
  8: "கேது",
};

export function lordTamil(id: number): string {
  return LORD_ID_TAMIL[id] ?? String(id);
}

export function compareDashaStart(a: string, b: string): number {
  return a.localeCompare(b, "en", { numeric: true });
}
