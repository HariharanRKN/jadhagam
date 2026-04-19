import { RASI_NAMES_EN, RASI_NAMES_TA } from "./constants";
import type { HouseNumber } from "./types";

export type AnalyzerLang = "en" | "ta";

const KARAKA_AREA_TA: Record<string, string> = {
  selfhood: "சுயம்",
  "mind and vitality response": "மனமும் உயிர்ச்சக்தி பதிலும்",
  "wealth and family prosperity": "செல்வமும் குடும்ப வளமும்",
  "speech and articulation": "பேச்சும் வெளிப்பாடும்",
  "courage and action": "துணிவும் செயலும்",
  "skills and communication": "திறனும் தொடர்பும்",
  "home and emotional base": "வீடும் உணர்வு அடித்தளமும்",
  "comfort and vehicles": "ஆறுதலும் வாகனங்களும்",
  "children and wisdom": "குழந்தைகளும் ஞானமும்",
  "intelligence and recognition": "அறிவும் அங்கீகாரமும்",
  "fights and resistance": "போராட்டமும் எதிர்ப்பும்",
  "endurance and burden": "நிலைத்தன்மையும் சுமையும்",
  "marriage and attraction": "திருமணமும் ஈர்ப்பும்",
  "relationship guidance": "உறவு வழிகாட்டுதல்",
  "longevity and suffering": "ஆயுளும் துன்பமும்",
  "moksha-karma and detachment": "மோட்ச கர்மாவும் விடுபடலும்",
  "fortune and dharma": "அதிர்ஷ்டமும் தர்மமும்",
  "father and blessings": "தந்தையும் ஆசிகளும்",
  "status and visibility": "நிலையும் புலப்பாடும்",
  "work discipline": "வேலை ஒழுங்கு",
  "gains and expansion": "லாபமும் விரிவும்",
  "network durability": "நெட்வொர்க் நிலைத்தன்மை",
  "loss and withdrawal": "இழப்பும் விலகலும்",
  "release and detachment": "விடுதலையும் விடுபடலும்",
};

export function karakaAreaLabel(lang: AnalyzerLang, areaEn: string): string {
  if (lang === "en") return areaEn;
  return KARAKA_AREA_TA[areaEn] ?? areaEn;
}

export function rasiLabelForLang(lang: AnalyzerLang, rasi: number): string {
  return lang === "ta" ? RASI_NAMES_TA[rasi] : RASI_NAMES_EN[rasi];
}

export function dignityPhrase(lang: AnalyzerLang, dignity: string): string {
  if (lang === "en") return `Planet dignity: ${dignity}.`;
  const d: Record<string, string> = {
    ucham: "உச்சம்",
    neecham: "நீசம்",
    moolatrikona: "மூலத்திரிகோணம்",
    own_sign: "சொந்த ராசி",
    ordinary: "சாதாரணம்",
  };
  return `கிரக கௌரவம்: ${d[dignity] ?? dignity}.`;
}

function ordinalEn(n: number): string {
  const suf =
    n % 10 === 1 && n % 100 !== 11
      ? "st"
      : n % 10 === 2 && n % 100 !== 12
        ? "nd"
        : n % 10 === 3 && n % 100 !== 13
          ? "rd"
          : "th";
  return `${n}${suf}`;
}

export function houseDisplayLabel(lang: AnalyzerLang, houseNumber: HouseNumber): string {
  if (lang === "ta") return `${houseNumber}ஆம் பாவம்`;
  return `${ordinalEn(houseNumber)} house`;
}

export const ha = {
  lordBhavagamLine(
    lang: AnalyzerLang,
    planetTa: string,
    houseNumber: number,
    rasiName: string,
    lordHouse: number
  ): string[] {
    if (lang === "en") {
      return [
        `${planetTa} is the bhavagam athibathi for house ${houseNumber}.`,
        `${planetTa} is placed in ${rasiName} (house ${lordHouse}).`,
      ];
    }
    return [
      `${planetTa} ${houseNumber}ஆம் பாவத்தின் அதிபதி.`,
      `${planetTa} ${rasiName}-இில் ${lordHouse}ஆம் பாவத்தில் உள்ளார்.`,
    ];
  },

  lordDignityNote(lang: AnalyzerLang, kind: "ucham" | "neecham" | "moolatrikona" | "own_sign"): string {
    if (lang === "en") {
      const m = {
        ucham: "Bhavagam lord is in ucham.",
        neecham: "Bhavagam lord is in neecham.",
        moolatrikona: "Bhavagam lord is in moolatrikona.",
        own_sign: "Bhavagam lord is in own sign.",
      };
      return m[kind];
    }
    const m = {
      ucham: "பாவ அதிபதி உச்சத்தில் உள்ளார்.",
      neecham: "பாவ அதிபதி நீசத்தில் உள்ளார்.",
      moolatrikona: "பாவ அதிபதி மூலத்திரிகோணத்தில் உள்ளார்.",
      own_sign: "பாவ அதிபதி சொந்த ராசியில் உள்ளார்.",
    };
    return m[kind];
  },

  occupantBase(lang: AnalyzerLang, planetTa: string): string {
    return lang === "en"
      ? `${planetTa} occupies this bhavagam.`
      : `${planetTa} இந்த பாவத்தில் உள்ளார்.`;
  },

  occupantRoleSupport(lang: AnalyzerLang): string {
    return lang === "en"
      ? "Occupant tends to support the house naturally."
      : "இந்த கிரகம் பாவத்தை இயல்பாக ஆதரிக்கும்.";
  },

  occupantRoleChallenge(lang: AnalyzerLang): string {
    return lang === "en"
      ? "Occupant tends to pressure or complicate the house."
      : "இந்த கிரகம் பாவத்திற்கு அழுத்தம் அல்லது சிக்கலைத் தரும்.";
  },

  occupantRoleMixed(lang: AnalyzerLang): string {
    return lang === "en"
      ? "Occupant gives mixed results and needs context."
      : "கலப்பு பலன்கள்; சூழல் தேவை.";
  },

  aspectFromHouse(lang: AnalyzerLang, planetTa: string, sourceHouse: number): string {
    return lang === "en"
      ? `${planetTa} aspects this bhavagam from house ${sourceHouse}.`
      : `${planetTa} ${sourceHouse}ஆம் பாவத்திலிருந்து இப்பாவத்தைப் பார்க்கிறார்.`;
  },

  aspectSupport(lang: AnalyzerLang): string {
    return lang === "en"
      ? "Aspect is naturally supportive."
      : "பார்வை இயல்பாக ஆதரவானது.";
  },

  aspectChallenge(lang: AnalyzerLang): string {
    return lang === "en"
      ? "Aspect is naturally pressurizing."
      : "பார்வை இயல்பாக அழுத்தமானது.";
  },

  aspectMixed(lang: AnalyzerLang): string {
    return lang === "en"
      ? "Aspect is mixed and interpretive."
      : "பார்வை கலப்பு; விளக்கம் தேவை.";
  },

  dashaLordIsBhavagamLord(lang: AnalyzerLang, label: string): string {
    const L =
      lang === "en"
        ? { mahadasha: "Mahadasha", bhukti: "Bhukti", antara: "Antara" }
        : { mahadasha: "மஹாதசை", bhukti: "புக்தி", antara: "அந்தரம்" };
    const name = L[label as keyof typeof L] ?? label;
    return lang === "en"
      ? `${name} lord is the bhavagam athibathi`
      : `${name} அதிபதி இந்த பாவ அதிபதியே`;
  },

  dashaLordOccupiesHouse(lang: AnalyzerLang, label: string): string {
    const L =
      lang === "en"
        ? { mahadasha: "Mahadasha", bhukti: "Bhukti", antara: "Antara" }
        : { mahadasha: "மஹாதசை", bhukti: "புக்தி", antara: "அந்தரம்" };
    const name = L[label as keyof typeof L] ?? label;
    return lang === "en"
      ? `${name} lord occupies this bhavagam`
      : `${name} அதிபதி இந்த பாவத்தில் உள்ளார்`;
  },

  transitActivation(lang: AnalyzerLang, names: string): string {
    return lang === "en"
      ? `Transit activation by ${names}`
      : `கோசாரத் தூண்டுதல்: ${names}`;
  },

  karakaSupportLine(
    lang: AnalyzerLang,
    planetTa: string,
    area: string
  ): string {
    const a = karakaAreaLabel(lang, area);
    return lang === "en"
      ? `${planetTa} supports ${area}.`
      : `${planetTa} ${a} பகுதியை ஆதரிக்கிறார்.`;
  },

  karakaPlacementLine(
    lang: AnalyzerLang,
    planetTa: string,
    rasiName: string,
    houseFromAsc: number
  ): string {
    return lang === "en"
      ? `${planetTa} is placed in ${rasiName} (house ${houseFromAsc}).`
      : `${planetTa} ${rasiName}-இில் ${houseFromAsc}ஆம் பாவத்தில் உள்ளார்.`;
  },

  karakaDignity(lang: AnalyzerLang, dignity: string): string {
    if (lang === "en") return `Karaka dignity: ${dignity}.`;
    return dignityPhrase("ta", dignity).replace("கிரக கௌரவம்", "கரக கௌரவம்");
  },

  lordStrengthPositive(lang: AnalyzerLang): string {
    return lang === "en"
      ? "Bhavagam athibathi is carrying reasonable strength."
      : "பாவ அதிபதி நல்ல வலிமையுடன் உள்ளார்.";
  },

  lordDignityPositive(lang: AnalyzerLang, dignity: string): string {
    return lang === "en"
      ? `House lord dignity is ${dignity}.`
      : `பாவ அதிபதி கௌரவம்: ${dignity}.`;
  },

  occupantSupportInner(lang: AnalyzerLang, planetTa: string): string {
    return lang === "en"
      ? `${planetTa} supports the house from within.`
      : `${planetTa} உள்ளிருந்து பாவத்தை ஆதரிக்கிறார்.`;
  },

  occupantPressure(lang: AnalyzerLang, planetTa: string): string {
    return lang === "en"
      ? `${planetTa} directly pressures this bhavagam.`
      : `${planetTa} நேரடியாக இந்த பாவத்திற்கு அழுத்தம் தருகிறார்.`;
  },

  occupantMixed(lang: AnalyzerLang, planetTa: string): string {
    return lang === "en"
      ? `${planetTa} gives mixed internal results.`
      : `${planetTa} கலப்பு உள் பலன்களைத் தருகிறார்.`;
  },

  aspectSupportive(lang: AnalyzerLang, planetTa: string): string {
    return lang === "en"
      ? `${planetTa} aspects the house supportively.`
      : `${planetTa} ஆதரவாக பாவத்தைப் பார்க்கிறார்.`;
  },

  aspectPressure(lang: AnalyzerLang, planetTa: string): string {
    return lang === "en"
      ? `${planetTa} aspects the house with pressure.`
      : `${planetTa} அழுத்தத்துடன் பாவத்தைப் பார்க்கிறார்.`;
  },

  timingActivatesHouse(lang: AnalyzerLang, houseNumber: number): string {
    return lang === "en"
      ? `Current timing activates house ${houseNumber}.`
      : `தற்போதைய தசை ${houseNumber}ஆம் பாவத்தைத் தூண்டுகிறது.`;
  },

  fallbackPositive(lang: AnalyzerLang): string {
    return lang === "en"
      ? "House strength depends more on context than on direct support."
      : "பாவ வலிமை நேரடி ஆதரவை விட சூழலைப் பொறுத்தது.";
  },

  fallbackChallenge(lang: AnalyzerLang): string {
    return lang === "en"
      ? "No major direct challenge is visible in the current baseline model."
      : "தற்போதைய அடிப்படை மாதிரியில் பெரிய நேரடி சவால் தெரியவில்லை.";
  },

  summaryHead(lang: AnalyzerLang, houseNumber: number, signName: string): string {
    return lang === "en"
      ? `House ${houseNumber} in ${signName} is being read through bhavagam, occupants, aspects, and karakas.`
      : `${houseNumber}ஆம் பாவம் ${signName}-இில் — அதிபதி, உள்ள கிரகங்கள், பார்வை, கரகங்கள் வழி வாசிக்கப்படுகிறது.`;
  },

  summaryLord(lang: AnalyzerLang, planetTa: string, houseFromAsc: number): string {
    return lang === "en"
      ? `${planetTa} is the bhavagam athibathi and sits in house ${houseFromAsc}.`
      : `${planetTa} பாவ அதிபதி; ${houseFromAsc}ஆம் பாவத்தில் உள்ளார்.`;
  },

  summaryOccupants(lang: AnalyzerLang, list: string): string {
    return lang === "en" ? `Occupants: ${list}.` : `உள்ள கிரகங்கள்: ${list}.`;
  },

  summaryAspects(lang: AnalyzerLang, list: string): string {
    return lang === "en"
      ? `Aspect pressure/support comes from ${list}.`
      : `பார்வை அழுத்தம்/ஆதரவு: ${list}.`;
  },

  summaryActivation(lang: AnalyzerLang): string {
    return lang === "en"
      ? "Current timing activation is present."
      : "தற்போதைய தசை தூண்டுதல் உள்ளது.";
  },
};
