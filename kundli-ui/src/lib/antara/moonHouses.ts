/**
 * Kochar house numbers counted from the natal Moon sign.
 * House 1 is the janma rasi. This is separate from lagna house counting
 * in house-analysis.
 */

export type SaturnMoonRelation = "sade_sati" | "ashtama_sani" | "ardhashtama_sani";

/** House of `planetRasi` when house 1 is `natalMoonRasi` (1..12). */
export function houseFromNatalMoon(natalMoonRasi: number, planetRasi: number): number {
  const moon = ((natalMoonRasi % 12) + 12) % 12;
  const planet = ((planetRasi % 12) + 12) % 12;
  return ((planet - moon + 12) % 12) + 1;
}

/**
 * Saturn's relationship to the natal Moon.
 * Sade Sati: 12th, 1st, or 2nd. Ashtama Sani: 8th. Ardhashtama Sani: 4th.
 */
export function saturnFromNatalMoon(
  natalMoonRasi: number,
  saturnRasi: number
): SaturnMoonRelation | null {
  const house = houseFromNatalMoon(natalMoonRasi, saturnRasi);
  if (house === 12 || house === 1 || house === 2) return "sade_sati";
  if (house === 8) return "ashtama_sani";
  if (house === 4) return "ardhashtama_sani";
  return null;
}

/**
 * Graha drishti targets counted in the same house frame as `fromHouse`.
 * Offsets match house-analysis `grahaDrishtiTargets` (all 7; Mars 4 and 8;
 * Jupiter 5 and 9; Saturn 3 and 10).
 */
export function grahaDrishtiHouses(planetId: number, fromHouse: number): number[] {
  const offsets = [7];
  if (planetId === 2) offsets.push(4, 8);
  if (planetId === 4) offsets.push(5, 9);
  if (planetId === 6) offsets.push(3, 10);
  return offsets.map((offset) => ((fromHouse + offset - 2 + 12) % 12) + 1);
}

export type GuruMoonLink = {
  overMoon: boolean;
  aspectsMoon: boolean;
  overSeventh: boolean;
  aspectsSeventh: boolean;
};

/** Jupiter occupying or aspecting the natal Moon or the 7th from it. */
export function guruLinksFromNatalMoon(
  natalMoonRasi: number,
  jupiterRasi: number
): GuruMoonLink {
  const house = houseFromNatalMoon(natalMoonRasi, jupiterRasi);
  const aspects = grahaDrishtiHouses(4, house);
  return {
    overMoon: house === 1,
    aspectsMoon: aspects.includes(1),
    overSeventh: house === 7,
    aspectsSeventh: aspects.includes(7),
  };
}

export type MoonSample = { date: string; rasi: number };

/**
 * Moon sign on `selectedDate` (last sample on or before that date) and the
 * next date the sign changes. Moon is not a slider marker; this feeds the
 * readout above the slider.
 */
export function moonSignReadout(
  samples: MoonSample[],
  selectedDate: string
): { rasi: number | null; nextChangeDate: string | null } {
  const sorted = [...samples].sort((a, b) => a.date.localeCompare(b.date));
  let index = -1;
  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i].date <= selectedDate) index = i;
    else break;
  }
  if (index < 0) return { rasi: null, nextChangeDate: null };
  const rasi = sorted[index].rasi;
  for (let j = index + 1; j < sorted.length; j += 1) {
    if (sorted[j].rasi !== rasi) return { rasi, nextChangeDate: sorted[j].date };
  }
  return { rasi, nextChangeDate: null };
}
