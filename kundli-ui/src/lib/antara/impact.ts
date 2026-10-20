import type { ChartDataPayload } from "@/types/chartData";
import { buildAllHouseAnalyses } from "@/lib/prediction/house-analysis";
import type {
  DignityState,
  HouseAnalysis,
  InfluenceRole,
} from "@/lib/prediction/house-analysis/types";
import type { PeriodLevel } from "./period";

export type LordImpact = {
  role: PeriodLevel;
  planetId: number;
  rasi: number;
  degInSign: number;
  nakshatraEn: string;
  nakshatraTa: string;
  pada: number;
  houseFromAsc: number;
  dignity: DignityState;
  influence: InfluenceRole;
  strength: number;
  ruledHouses: number[];
  /** Sign lord Rahu/Ketu act for. They do not rule signs themselves. */
  actsForPlanetId: number | null;
};

export type HouseLinkKaraka = {
  planetId: number;
  area: string;
  dignity: DignityState;
  strength: number;
  houseFromAsc: number;
};

export type HouseLink = {
  house: number;
  signRasi: number;
  adhipathiId: number;
  dignity: DignityState;
  strength: number;
  adhipathiHouse: number;
  /** Set when the adhipathi is one of the period lords. */
  periodRole: PeriodLevel | null;
  /** Set when Rahu or Ketu, as a period lord, occupies the house. */
  viaNode: { planetId: number; role: PeriodLevel } | null;
  occupiedBy: Array<{ planetId: number; role: PeriodLevel }>;
  karakas: HouseLinkKaraka[];
};

export type ExtraInfluence = {
  planetId: number;
  kind: "conjunct" | "aspect";
  targetPlanetId: number;
  influence: InfluenceRole;
  strength: number;
};

export type ActivatedHouse = {
  house: number;
  signRasi: number;
  reasons: Array<"ruled" | "occupied" | "aspected">;
  influence: InfluenceRole;
};

export type PeriodImpact = {
  lords: LordImpact[];
  houses: HouseLink[];
  extras: ExtraInfluence[];
  activated: ActivatedHouse[];
};

const ROLE_RANK: Record<PeriodLevel, number> = { maha: 0, bhukti: 1, antara: 2 };

function combineRoles(roles: InfluenceRole[]): InfluenceRole {
  const unique = new Set(roles);
  if (unique.size === 0) return "mixed";
  if (unique.size === 1) return [...unique][0];
  return "mixed";
}

function specificRole(
  lords: Array<{ role: PeriodLevel; planetId: number }>,
  planetId: number
): PeriodLevel | null {
  const matches = lords.filter((lord) => lord.planetId === planetId);
  if (!matches.length) return null;
  return matches.sort((a, b) => ROLE_RANK[b.role] - ROLE_RANK[a.role])[0].role;
}

/**
 * Period lords, the houses they rule or occupy, and karakas for those houses.
 * Karakas, dignities, strengths, and conjunction/aspect links come from
 * `buildAllHouseAnalyses` (HOUSE_KARAKAS). Nakshatra lords are not included.
 */
export function buildPeriodImpact(
  chart: ChartDataPayload,
  lords: Array<{ role: PeriodLevel; planetId: number }>,
  lang: "en" | "ta" = "en"
): PeriodImpact {
  const bundle = buildAllHouseAnalyses(chart, lang);
  const lordIds = new Set(lords.map((lord) => lord.planetId));

  const lordImpacts: LordImpact[] = [];
  for (const lord of lords) {
    const row = chart.natalPlanets.find((planet) => planet.planetId === lord.planetId);
    const occupied = bundle.houses.find((house) =>
      house.bhavagam.occupants.some((occupant) => occupant.planetId === lord.planetId)
    );
    const occupant = occupied?.bhavagam.occupants.find(
      (item) => item.planetId === lord.planetId
    );
    if (!row || !occupied || !occupant) continue;
    const ruledHouses = bundle.houses
      .filter((house) => house.bhavagam.houseLord.planetId === lord.planetId)
      .map((house) => house.houseNumber);
    const isNode = lord.planetId === 7 || lord.planetId === 8;
    lordImpacts.push({
      role: lord.role,
      planetId: lord.planetId,
      rasi: row.rasi,
      degInSign: row.degInSign,
      nakshatraEn: row.nakshatraEn ?? row.nakshatraTa,
      nakshatraTa: row.nakshatraTa,
      pada: row.pada,
      houseFromAsc: occupied.houseNumber,
      dignity: occupant.dignity,
      influence: occupant.role,
      strength: occupant.strength,
      ruledHouses,
      actsForPlanetId: isNode ? occupied.bhavagam.houseLord.planetId : null,
    });
  }

  const houseNumbers = new Set<number>();
  for (const lord of lordImpacts) {
    houseNumbers.add(lord.houseFromAsc);
    for (const house of lord.ruledHouses) houseNumbers.add(house);
  }

  const houses: HouseLink[] = [...houseNumbers]
    .sort((a, b) => a - b)
    .map((houseNumber) => {
      const house = bundle.houses[houseNumber - 1] as HouseAnalysis;
      const lordStrength = house.bhavagam.houseLordStrength;
      const adhipathiId = house.bhavagam.houseLord.planetId;
      const via = lordImpacts.find(
        (lord) =>
          (lord.planetId === 7 || lord.planetId === 8) && lord.houseFromAsc === houseNumber
      );
      const occupiedBy = lordImpacts
        .filter((lord) => lord.houseFromAsc === houseNumber)
        .map((lord) => ({ planetId: lord.planetId, role: lord.role }));
      const karakas = house.karakam.karakaAthibathi.map((karaka) => ({
        planetId: karaka.planetId,
        area:
          house.karakam.karakas.find((item) => item.planet.planetId === karaka.planetId)?.area ??
          karaka.area,
        dignity: karaka.dignity,
        strength: karaka.strength,
        houseFromAsc: karaka.houseFromAsc,
      }));
      return {
        house: houseNumber,
        signRasi: house.signRasi,
        adhipathiId,
        dignity: lordStrength?.dignity ?? "ordinary",
        strength: lordStrength?.strength ?? 0,
        adhipathiHouse: lordStrength?.houseFromAsc ?? houseNumber,
        periodRole: specificRole(lords, adhipathiId),
        viaNode: via ? { planetId: via.planetId, role: via.role } : null,
        occupiedBy,
        karakas,
      };
    });

  const extras: ExtraInfluence[] = [];
  const seen = new Set<string>();
  for (const lord of lordImpacts) {
    const house = bundle.houses[lord.houseFromAsc - 1];
    if (!house) continue;
    for (const occupant of house.bhavagam.occupants) {
      if (occupant.planetId === lord.planetId) continue;
      const key = `${occupant.planetId}|conjunct|${lord.planetId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      extras.push({
        planetId: occupant.planetId,
        kind: "conjunct",
        targetPlanetId: lord.planetId,
        influence: occupant.role,
        strength: occupant.strength,
      });
    }
    for (const aspect of house.bhavagam.aspectsToHouse) {
      if (aspect.planetId === lord.planetId) continue;
      const key = `${aspect.planetId}|aspect|${lord.planetId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      extras.push({
        planetId: aspect.planetId,
        kind: "aspect",
        targetPlanetId: lord.planetId,
        influence: aspect.role,
        strength: aspect.strength,
      });
    }
  }

  const activated: ActivatedHouse[] = [];
  for (const house of bundle.houses) {
    const reasons: ActivatedHouse["reasons"] = [];
    const influences: InfluenceRole[] = [];
    if (lordImpacts.some((lord) => lord.ruledHouses.includes(house.houseNumber))) {
      reasons.push("ruled");
    }
    const occupiers = lordImpacts.filter((lord) => lord.houseFromAsc === house.houseNumber);
    if (occupiers.length) {
      reasons.push("occupied");
      influences.push(...occupiers.map((lord) => lord.influence));
    }
    const aspecting = house.bhavagam.aspectsToHouse.filter((aspect) =>
      lordIds.has(aspect.planetId)
    );
    if (aspecting.length) {
      reasons.push("aspected");
      influences.push(...aspecting.map((aspect) => aspect.role));
    }
    if (!reasons.length) continue;
    if (!influences.length) {
      for (const lord of lordImpacts) {
        if (lord.ruledHouses.includes(house.houseNumber)) influences.push(lord.influence);
      }
    }
    activated.push({
      house: house.houseNumber,
      signRasi: house.signRasi,
      reasons,
      influence: combineRoles(influences),
    });
  }

  return { lords: lordImpacts, houses, extras, activated };
}
