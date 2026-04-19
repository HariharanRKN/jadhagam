import type { HouseNumber } from "./types";

export const PLANET_NAMES_EN: Record<number, string> = {
  0: "Sun",
  1: "Moon",
  2: "Mars",
  3: "Mercury",
  4: "Jupiter",
  5: "Venus",
  6: "Saturn",
  7: "Rahu",
  8: "Ketu",
};

export const PLANET_NAMES_TA: Record<number, string> = {
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

export const RASI_NAMES_EN = [
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

export const RASI_NAMES_TA = [
  "மேஷம்",
  "ரிஷபம்",
  "மிதுனம்",
  "கடகம்",
  "சிம்மம்",
  "கன்னி",
  "துலாம்",
  "விருச்சிகம்",
  "தனுசு",
  "மகரம்",
  "கும்பம்",
  "மீனம்",
] as const;

export const SIGN_LORD: Record<number, number> = {
  0: 2,
  1: 5,
  2: 3,
  3: 1,
  4: 0,
  5: 3,
  6: 5,
  7: 2,
  8: 4,
  9: 6,
  10: 6,
  11: 4,
};

export const HOUSE_CORE_MEANINGS: Record<HouseNumber, string[]> = {
  1: ["self", "body", "identity", "health"],
  2: ["family", "speech", "savings", "stored wealth", "values"],
  3: ["courage", "effort", "siblings", "initiative", "communication"],
  4: ["mother", "home", "comfort", "property", "emotional foundation"],
  5: ["children", "intelligence", "purva punya", "creativity", "romance"],
  6: ["service", "debts", "disease", "competition", "conflict"],
  7: ["marriage", "partner", "agreements", "public dealings", "union"],
  8: ["longevity", "transformation", "secrets", "inheritance", "sudden events"],
  9: ["fortune", "dharma", "father", "guru", "higher principles"],
  10: ["career", "status", "karma", "authority", "public life"],
  11: ["gains", "network", "elder siblings", "fulfillment", "income"],
  12: ["loss", "expense", "moksha", "foreign lands", "withdrawal"],
};

export const HOUSE_KARAKAS: Record<
  HouseNumber,
  Array<{ planetId: number; area: string }>
> = {
  1: [
    { planetId: 0, area: "selfhood" },
    { planetId: 1, area: "mind and vitality response" },
  ],
  2: [
    { planetId: 4, area: "wealth and family prosperity" },
    { planetId: 3, area: "speech and articulation" },
  ],
  3: [
    { planetId: 2, area: "courage and action" },
    { planetId: 3, area: "skills and communication" },
  ],
  4: [
    { planetId: 1, area: "home and emotional base" },
    { planetId: 5, area: "comfort and vehicles" },
  ],
  5: [
    { planetId: 4, area: "children and wisdom" },
    { planetId: 0, area: "intelligence and recognition" },
  ],
  6: [
    { planetId: 2, area: "fights and resistance" },
    { planetId: 6, area: "endurance and burden" },
  ],
  7: [
    { planetId: 5, area: "marriage and attraction" },
    { planetId: 4, area: "relationship guidance" },
  ],
  8: [
    { planetId: 6, area: "longevity and suffering" },
    { planetId: 8, area: "moksha-karma and detachment" },
  ],
  9: [
    { planetId: 4, area: "fortune and dharma" },
    { planetId: 0, area: "father and blessings" },
  ],
  10: [
    { planetId: 0, area: "status and visibility" },
    { planetId: 6, area: "work discipline" },
  ],
  11: [
    { planetId: 4, area: "gains and expansion" },
    { planetId: 6, area: "network durability" },
  ],
  12: [
    { planetId: 6, area: "loss and withdrawal" },
    { planetId: 8, area: "release and detachment" },
  ],
};

export const UCHAM_RASI: Partial<Record<number, number>> = {
  0: 0,
  1: 1,
  2: 9,
  3: 5,
  4: 3,
  5: 11,
  6: 6,
};

export const NEECHAM_RASI: Partial<Record<number, number>> = {
  0: 6,
  1: 7,
  2: 3,
  3: 11,
  4: 9,
  5: 5,
  6: 0,
};

export const MOOLATRIKONA_RASI: Partial<Record<number, number>> = {
  0: 4,
  1: 1,
  2: 0,
  3: 5,
  4: 8,
  5: 6,
  6: 10,
};

export const OWN_SIGNS: Partial<Record<number, number[]>> = {
  0: [4],
  1: [3],
  2: [0, 7],
  3: [2, 5],
  4: [8, 11],
  5: [1, 6],
  6: [9, 10],
};

