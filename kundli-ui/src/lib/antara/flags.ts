import {
  guruLinksFromNatalMoon,
  saturnFromNatalMoon,
  type SaturnMoonRelation,
} from "./moonHouses";

export type SkySample = {
  date: string;
  positions: Array<{ planetId: number; rasi: number }>;
};

export type KocharFlagCode =
  | "sadeSati"
  | "ashtamaSani"
  | "ardhashtamaSani"
  | "guruOverMoon"
  | "guruAspectsMoon"
  | "guruOverSeventh"
  | "guruAspectsSeventh"
  | "overNatalLord";

export type KocharFlag = {
  code: KocharFlagCode;
  tone: "bad" | "good" | "warn";
  scope: "period" | "date";
  transitPlanetId?: number;
  natalPlanetId?: number;
};

const SLOW_OVER_NATAL = [4, 6, 7, 8];

function rasiOf(day: SkySample, planetId: number): number | null {
  const planet = day.positions.find((item) => item.planetId === planetId);
  return planet ? planet.rasi : null;
}

function saturnCode(relation: SaturnMoonRelation | null): KocharFlagCode | null {
  if (relation === "sade_sati") return "sadeSati";
  if (relation === "ashtama_sani") return "ashtamaSani";
  if (relation === "ardhashtama_sani") return "ardhashtamaSani";
  return null;
}

function scopeFor(
  days: SkySample[],
  selected: SkySample | null,
  holds: (day: SkySample) => boolean
): "period" | "date" | null {
  if (!days.length) {
    if (selected && holds(selected)) return "date";
    return null;
  }
  if (days.every(holds)) return "period";
  if (selected && holds(selected)) return "date";
  return null;
}

/**
 * Sade Sati / Ashtama / Ardhashtama, Guru on the Moon or 7th, and slow
 * planets sitting on the natal signs of the period lords.
 * "period" means the condition is true on every sampled day.
 */
export function collectKocharFlags(
  days: SkySample[],
  natalMoonRasi: number,
  lords: Array<{ planetId: number; rasi: number }>,
  selectedDate: string
): KocharFlag[] {
  const selected =
    days.find((day) => day.date === selectedDate) ??
    [...days].reverse().find((day) => day.date <= selectedDate) ??
    null;
  const flags: KocharFlag[] = [];

  const saturnFlags: Array<{ code: KocharFlagCode; tone: "bad" | "warn" }> = [
    { code: "sadeSati", tone: "bad" },
    { code: "ashtamaSani", tone: "bad" },
    { code: "ardhashtamaSani", tone: "warn" },
  ];
  for (const item of saturnFlags) {
    const scope = scopeFor(days, selected, (day) => {
      const saturn = rasiOf(day, 6);
      if (saturn == null) return false;
      return saturnCode(saturnFromNatalMoon(natalMoonRasi, saturn)) === item.code;
    });
    if (scope) flags.push({ code: item.code, tone: item.tone, scope });
  }

  const guruChecks: Array<{
    code: KocharFlagCode;
    tone: "good" | "warn";
    key: "overMoon" | "aspectsMoon" | "overSeventh" | "aspectsSeventh";
  }> = [
    { code: "guruOverMoon", tone: "good", key: "overMoon" },
    { code: "guruAspectsMoon", tone: "good", key: "aspectsMoon" },
    { code: "guruOverSeventh", tone: "good", key: "overSeventh" },
    { code: "guruAspectsSeventh", tone: "good", key: "aspectsSeventh" },
  ];
  for (const item of guruChecks) {
    const scope = scopeFor(days, selected, (day) => {
      const guru = rasiOf(day, 4);
      if (guru == null) return false;
      return guruLinksFromNatalMoon(natalMoonRasi, guru)[item.key];
    });
    if (scope) flags.push({ code: item.code, tone: item.tone, scope });
  }

  for (const transitPlanetId of SLOW_OVER_NATAL) {
    for (const lord of lords) {
      const scope = scopeFor(days, selected, (day) => rasiOf(day, transitPlanetId) === lord.rasi);
      if (!scope) continue;
      flags.push({
        code: "overNatalLord",
        tone: "warn",
        scope,
        transitPlanetId,
        natalPlanetId: lord.planetId,
      });
    }
  }

  return flags;
}
