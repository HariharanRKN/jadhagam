/** Parashari naisargika (permanent) friends. Rahu follows Saturn and also befriends Saturn; Ketu follows Mars and also befriends Mars. */
const NATURAL_FRIENDS: Record<number, readonly number[]> = {
  0: [1, 2, 4],
  1: [0, 3],
  2: [0, 1, 4],
  3: [0, 5],
  4: [0, 1, 2],
  5: [3, 6],
  6: [3, 5],
  7: [3, 5, 6],
  8: [0, 1, 2, 4],
};

/** Permanent enemies. Anyone not a friend or an enemy is neutral. */
const NATURAL_ENEMIES: Record<number, readonly number[]> = {
  0: [5, 6],
  1: [],
  2: [3],
  3: [1],
  4: [3, 5],
  5: [0, 1],
  6: [0, 1, 2],
  7: [0, 1, 2],
  8: [3],
};

export type NaturalRelation = "same" | "friend" | "neutral" | "enemy";
export type PlacementTone = "supportive" | "friction" | "neutral";

export type RelatableLord = {
  role: "maha" | "bhukti" | "antara";
  planetId: number;
  rasi: number;
};

export type LordRelation = {
  left: RelatableLord;
  right: RelatableLord;
  leftToRight: NaturalRelation;
  rightToLeft: NaturalRelation;
  houseOfRightFromLeft: number;
  houseOfLeftFromRight: number;
  placement: PlacementTone;
};

export function naturalRelation(fromPlanetId: number, toPlanetId: number): NaturalRelation {
  if (fromPlanetId === toPlanetId) return "same";
  if (NATURAL_FRIENDS[fromPlanetId]?.includes(toPlanetId)) return "friend";
  if (NATURAL_ENEMIES[fromPlanetId]?.includes(toPlanetId)) return "enemy";
  return "neutral";
}

/** House of `toRasi` counted from `fromRasi`. The starting sign is house 1. */
export function houseFromSign(fromRasi: number, toRasi: number): number {
  return ((toRasi - fromRasi + 12) % 12) + 1;
}

/**
 * Kendra (1/4/7/10) or trikona (1/5/9) is supportive.
 * 6/8 and 2/12 are friction. 3/11 are neutral.
 * The two directions always share this tone.
 */
export function placementTone(fromRasi: number, toRasi: number): PlacementTone {
  const house = houseFromSign(fromRasi, toRasi);
  if (house === 1 || house === 4 || house === 5 || house === 7 || house === 9 || house === 10) {
    return "supportive";
  }
  if (house === 2 || house === 6 || house === 8 || house === 12) return "friction";
  return "neutral";
}

export function relateLords(lords: RelatableLord[]): LordRelation[] {
  const pairs: LordRelation[] = [];
  for (let index = 0; index < lords.length; index += 1) {
    for (let other = index + 1; other < lords.length; other += 1) {
      const left = lords[index];
      const right = lords[other];
      pairs.push({
        left,
        right,
        leftToRight: naturalRelation(left.planetId, right.planetId),
        rightToLeft: naturalRelation(right.planetId, left.planetId),
        houseOfRightFromLeft: houseFromSign(left.rasi, right.rasi),
        houseOfLeftFromRight: houseFromSign(right.rasi, left.rasi),
        placement: placementTone(left.rasi, right.rasi),
      });
    }
  }
  return pairs;
}
