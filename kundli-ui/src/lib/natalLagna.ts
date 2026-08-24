import type { PlanetRow } from "../types/chartData.ts";

/** Matches horoscope.py LAGNA_PLANET_ID — not a graha. */
export const LAGNA_PLANET_ID = -1;

export const RASI_EN = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
] as const;

const RASI_TAMIL: Record<number, string> = {
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

export const NAKSHATRA_EN = [
  "Ashwini",
  "Bharani",
  "Krittika",
  "Rohini",
  "Mrigashira",
  "Ardra",
  "Punarvasu",
  "Pushya",
  "Ashlesha",
  "Magha",
  "Purva Phalguni",
  "Uttara Phalguni",
  "Hasta",
  "Chitra",
  "Swati",
  "Vishakha",
  "Anuradha",
  "Jyeshtha",
  "Moola",
  "Purva Ashadha",
  "Uttara Ashadha",
  "Shravana",
  "Dhanishta",
  "Shatabhisha",
  "Purva Bhadrapada",
  "Uttara Bhadrapada",
  "Revati",
] as const;

const NAKSHATRA_TAMIL = [
  "அஸ்வினி",
  "பரணி",
  "கிருத்திகை",
  "ரோகிணி",
  "மிருகசீரிடம்",
  "திருவாதிரை",
  "புனர்பூசம்",
  "பூசம்",
  "ஆயில்யம்",
  "மகம்",
  "பூரம்",
  "உத்திரம்",
  "அஸ்தம்",
  "சித்திரை",
  "சுவாதி",
  "விசாகம்",
  "அனுஷம்",
  "கேட்டை",
  "மூலம்",
  "பூராடம்",
  "உத்திராடம்",
  "திருவோணம்",
  "அவிட்டம்",
  "சதயம்",
  "பூரட்டாதி",
  "உத்திரட்டாதி",
  "ரேவதி",
] as const;

export function lagnaRowFromBirth(birth: {
  ascendantRasi: number;
  ascendantDeg?: number;
}): PlanetRow {
  const rasi = ((birth.ascendantRasi % 12) + 12) % 12;
  const deg = typeof birth.ascendantDeg === "number" ? birth.ascendantDeg : 0;
  const tl = rasi * 30 + deg;
  const nakSpan = 360 / 27;
  const nakIdx = Math.floor(tl / nakSpan) % 27;
  const pada = Math.floor((tl % nakSpan) / (nakSpan / 4)) + 1;
  return {
    planetId: LAGNA_PLANET_ID,
    planetEn: "Lagna",
    planetTa: "லக்னம்",
    rasi,
    rasiTa: RASI_TAMIL[rasi] ?? "",
    degInSign: deg,
    totalLongitude: tl,
    nakshatraEn: NAKSHATRA_EN[nakIdx],
    nakshatraTa: NAKSHATRA_TAMIL[nakIdx],
    pada,
  };
}

export function natalRowsWithLagna(
  natal: PlanetRow[],
  natalLagna: PlanetRow | null | undefined,
  birth?: { ascendantRasi: number; ascendantDeg?: number }
): PlanetRow[] {
  const grahas = natal.filter((row) => row.planetId !== LAGNA_PLANET_ID);
  const lagna = natalLagna ?? (birth ? lagnaRowFromBirth(birth) : null);
  return lagna ? [lagna, ...grahas] : grahas;
}
