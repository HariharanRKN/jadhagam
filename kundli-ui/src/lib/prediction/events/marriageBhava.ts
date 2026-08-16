import type { ChartDataPayload, PlanetRow } from "@/types/chartData";

export const MARRIAGE_BHAVA_HOUSES = [3, 7, 11] as const;
export type MarriageBhavaHouse = (typeof MARRIAGE_BHAVA_HOUSES)[number];
export const MARRIAGE_CONJUNCTION_ORB = 8;

export type MarriageBhavaHouseReading = {
  houseNumber: MarriageBhavaHouse;
  signRasi: number;
  occupants: PlanetRow[];
  conjuncts: PlanetRow[];
};

function normalizeDeg(value: number): number {
  return ((value % 360) + 360) % 360;
}

export function lagnaLongitude(ascendantRasi: number, ascendantDeg: number): number {
  return normalizeDeg(ascendantRasi * 30 + ascendantDeg);
}

export function angularDistance(a: number, b: number): number {
  const delta = Math.abs(normalizeDeg(a) - normalizeDeg(b));
  return Math.min(delta, 360 - delta);
}

export function equalHouseCusp(lagnaLon: number, houseNumber: number): number {
  return normalizeDeg(lagnaLon + (houseNumber - 1) * 30);
}

/** Shortest distance from a longitude to an equal-house span [cusp, cusp+30). */
export function distanceToEqualHouse(
  lagnaLon: number,
  planetLon: number,
  houseNumber: number
): number {
  const cusp = equalHouseCusp(lagnaLon, houseNumber);
  const rel = normalizeDeg(planetLon - cusp);
  if (rel < 30) return 0;
  return Math.min(rel - 30, 360 - rel);
}

export function isBhavaOccupant(
  lagnaLon: number,
  planetLon: number,
  houseNumber: number,
  orb: number = MARRIAGE_CONJUNCTION_ORB
): boolean {
  return distanceToEqualHouse(lagnaLon, planetLon, houseNumber) <= orb;
}

export function collectMarriageBhavaReadings(
  chart: ChartDataPayload,
  orb: number = MARRIAGE_CONJUNCTION_ORB
): MarriageBhavaHouseReading[] {
  const lagnaLon = lagnaLongitude(
    chart.birth.ascendantRasi,
    chart.birth.ascendantDeg
  );

  return MARRIAGE_BHAVA_HOUSES.map((houseNumber) => {
    const occupants = chart.natalPlanets.filter((planet) =>
      isBhavaOccupant(lagnaLon, planet.totalLongitude, houseNumber, orb)
    );
    const occupantIds = new Set(occupants.map((planet) => planet.planetId));
    const conjuncts = chart.natalPlanets.filter((planet) => {
      if (occupantIds.has(planet.planetId)) return false;
      return occupants.some(
        (occupant) =>
          angularDistance(planet.totalLongitude, occupant.totalLongitude) <= orb
      );
    });
    return {
      houseNumber,
      signRasi: (chart.birth.ascendantRasi + houseNumber - 1) % 12,
      occupants,
      conjuncts,
    };
  });
}
