/** Guru, Sani, Rahu, Ketu. Moon is intentionally excluded. */
export const SLOW_SIGN_PLANET_IDS = [4, 6, 7, 8] as const;

export type SlowSignPlanetId = (typeof SLOW_SIGN_PLANET_IDS)[number];

export type PlanetDay = {
  date: string;
  planetId: number;
  rasi: number;
  longitude: number;
};

export type SignChangeDirection = "forward" | "retro";

export type SignChange = {
  planetId: number;
  /** First daily snapshot in the new sign. */
  date: string;
  fromRasi: number;
  toRasi: number;
  direction: SignChangeDirection;
  /** Forward return into a sign this planet had left by retrograde earlier in the series. */
  reentry: boolean;
};

export function signedLongitudeDelta(previous: number, next: number): number {
  let delta = next - previous;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

function isSlowPlanet(planetId: number): planetId is SlowSignPlanetId {
  return (SLOW_SIGN_PLANET_IDS as readonly number[]).includes(planetId);
}

/**
 * Sign changes from day-to-day rasi differences.
 * A negative longitude step is retrograde (Guru/Sani stations, and Rahu/Ketu
 * which always move backward). A later forward crossing back into a sign
 * left by retrograde is a re-entry.
 */
export function detectSignChanges(days: PlanetDay[]): SignChange[] {
  const byPlanet = new Map<number, PlanetDay[]>();
  for (const day of days) {
    if (!isSlowPlanet(day.planetId)) continue;
    const list = byPlanet.get(day.planetId) ?? [];
    list.push(day);
    byPlanet.set(day.planetId, list);
  }

  const changes: SignChange[] = [];
  for (const [planetId, series] of byPlanet) {
    series.sort((a, b) => a.date.localeCompare(b.date));
    const exitedRetro = new Set<number>();
    for (let i = 1; i < series.length; i += 1) {
      const prev = series[i - 1];
      const current = series[i];
      if (prev.rasi === current.rasi) continue;
      const retro = signedLongitudeDelta(prev.longitude, current.longitude) < 0;
      const reentry = !retro && exitedRetro.has(current.rasi);
      if (retro) exitedRetro.add(prev.rasi);
      if (reentry) exitedRetro.delete(current.rasi);
      changes.push({
        planetId,
        date: current.date,
        fromRasi: prev.rasi,
        toRasi: current.rasi,
        direction: retro ? "retro" : "forward",
        reentry,
      });
    }
  }

  changes.sort((a, b) => a.date.localeCompare(b.date) || a.planetId - b.planetId);
  return changes;
}

/** Slider "R" badge: retrograde crossings of Guru or Sani, not the nodes. */
export function markerShowsRetro(change: SignChange): boolean {
  return change.direction === "retro" && (change.planetId === 4 || change.planetId === 6);
}
