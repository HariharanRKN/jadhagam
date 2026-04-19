import type { LanguageCode } from "@/components/LanguageProvider";
import { RASI_TAMIL } from "@/components/SouthIndianChart/chartConfig";
import { lordTamil } from "@/lib/tamilDasha";

const RASI_EN = [
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

const LORD_EN: Record<number, string> = {
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

export function rasiName(lang: LanguageCode, rasi: number): string {
  if (rasi < 0 || rasi > 11) return String(rasi);
  return lang === "ta" ? RASI_TAMIL[rasi] : RASI_EN[rasi];
}

export function lordName(lang: LanguageCode, lordId: number): string {
  return lang === "ta" ? lordTamil(lordId) : LORD_EN[lordId] ?? String(lordId);
}

export function houseOrdinal(lang: LanguageCode, houseNumber: number): string {
  if (lang === "ta") return `${houseNumber}ஆம் பாவம்`;
  const suf =
    houseNumber % 10 === 1 && houseNumber % 100 !== 11
      ? "st"
      : houseNumber % 10 === 2 && houseNumber % 100 !== 12
        ? "nd"
        : houseNumber % 10 === 3 && houseNumber % 100 !== 13
          ? "rd"
          : "th";
  return `${houseNumber}${suf} house`;
}

export function dignityWord(
  lang: LanguageCode,
  d: "ucham" | "neecham" | "moolatrikona" | "own_sign" | "ordinary"
): string {
  if (lang === "en") return d;
  const m: Record<typeof d, string> = {
    ucham: "உச்சம்",
    neecham: "நீசம்",
    moolatrikona: "மூலத்திரிகோணம்",
    own_sign: "சொந்த ராசி",
    ordinary: "சாதாரணம்",
  };
  return m[d];
}
