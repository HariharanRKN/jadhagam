import type { AnalyzerLang } from "@/lib/prediction/house-analysis/locale";

export type MarriageLang = AnalyzerLang;

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

const RASI_TA = [
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

export function rasiName(lang: MarriageLang, rasi: number): string {
  return lang === "ta" ? RASI_TA[rasi] : RASI_EN[rasi];
}

export function dignityLabel(lang: MarriageLang, d: string): string {
  if (lang === "en") return d;
  const m: Record<string, string> = {
    ucham: "உச்சம்",
    neecham: "நீசம்",
    moolatrikona: "மூலத்திரிகோணம்",
    own_sign: "சொந்த ராசி",
    ordinary: "சாதாரணம்",
  };
  return m[d] ?? d;
}

export const mp = {
  conjunctNote(
    lang: MarriageLang,
    influencer: string,
    target: string
  ): string {
    return lang === "en"
      ? `${influencer} is conjunct ${target}.`
      : `${influencer} ${target} உடன் இணைந்துள்ளார்.`;
  },

  aspectNote(lang: MarriageLang, influencer: string, target: string): string {
    return lang === "en"
      ? `${influencer} aspects ${target}.`
      : `${influencer} ${target} மீது பார்வை பார்க்கிறார்.`;
  },

  placementOpen(
    lang: MarriageLang,
    roleLabel: string,
    signName: string,
    house: number
  ): string {
    return lang === "en"
      ? `${roleLabel} is placed in ${signName} (house ${house}).`
      : `${roleLabel} ${signName}-இில் ${house}ஆம் பாவத்தில் உள்ளார்.`;
  },

  dignityLine(lang: MarriageLang, roleLabel: string, dignity: string): string {
    return lang === "en"
      ? `${roleLabel} dignity is ${dignity}.`
      : `${roleLabel} கௌரவம்: ${dignityLabel(lang, dignity)}.`;
  },

  seventhHouse(lang: MarriageLang, roleLabel: string): string {
    return lang === "en"
      ? `${roleLabel} sits directly in the 7th house.`
      : `${roleLabel} நேரடியாக 7ஆம் பாவத்தில் உள்ளார்.`;
  },

  dusthana(lang: MarriageLang, roleLabel: string): string {
    return lang === "en"
      ? `${roleLabel} is placed in a dusthana house.`
      : `${roleLabel} துஷ்டான பாவத்தில் உள்ளார்.`;
  },

  periodNote7th(lang: MarriageLang): string {
    return lang === "en"
      ? "7th lord is active in this period."
      : "இந்த காலத்தில் 7ஆம் அதிபதி செயலில் உள்ளார்.";
  },

  periodNoteShukra(lang: MarriageLang): string {
    return lang === "en"
      ? "Shukra is active in this period."
      : "இந்த காலத்தில் சுக்கிரன் செயலில் உள்ளார்.";
  },

  periodNoteGuru(lang: MarriageLang): string {
    return lang === "en"
      ? "Guru is active in this period."
      : "இந்த காலத்தில் குரு செயலில் உள்ளார்.";
  },

  periodNoteHouseLords(lang: MarriageLang): string {
    return lang === "en"
      ? "Marriage-supporting house lords are participating in this period."
      : "திருமணத்தை ஆதரிக்கும் பாவ அதிபதிகள் இந்த காலத்தில் பங்கேற்கின்றனர்.";
  },

  periodSummaryCurrent(
    lang: MarriageLang,
    verdictKey: string,
    score: number,
    roles: string
  ): string {
    const verdict = verdictWord(lang, verdictKey as "strong" | "supportive" | "weak");
    return lang === "en"
      ? `Current marriage period is ${verdict} with score ${score}; active roles: ${roles || "none"}.`
      : `தற்போதைய திருமண காலம் ${verdict}; மதிப்பெண் ${score}; செயலில் உள்ள பாத்திரங்கள்: ${roles || "இல்லை"}.`;
  },

  periodSummaryNone(lang: MarriageLang): string {
    return lang === "en"
      ? "No active antara row was resolved for the current date."
      : "தற்போதைய தேதிக்கு செயலில் உள்ள அந்தர வரிசை கண்டறியப்படவில்லை.";
  },

  guruKocharIn(lang: MarriageLang, signName: string, house: number): string {
    return lang === "en"
      ? `Guru kochar is in ${signName} (house ${house}).`
      : `குரு கோசாரம் ${signName}-இில் ${house}ஆம் பாவம்.`;
  },

  guruLooks7(lang: MarriageLang): string {
    return lang === "en"
      ? "Guru kochar is looking at the 7th house."
      : "குரு கோசாரம் 7ஆம் பாவத்தைப் பார்க்கிறது.";
  },

  guruLooks11(lang: MarriageLang): string {
    return lang === "en"
      ? "Guru kochar is looking at the 11th house."
      : "குரு கோசாரம் 11ஆம் பாவத்தைப் பார்க்கிறது.";
  },

  guruNotSupporting(lang: MarriageLang): string {
    return lang === "en"
      ? "Guru kochar is not currently supporting 7th or 11th house marriage triggers."
      : "குரு கோசாரம் தற்போது 7 அல்லது 11 பாவ திருமணத் தூண்டுதல்களை ஆதரிக்கவில்லை.";
  },

  housePositive(lang: MarriageLang, house: number, item: string): string {
    return lang === "en" ? `House ${house}: ${item}` : `${house}ஆம் பாவம்: ${item}`;
  },

  houseChallenge(lang: MarriageLang, house: number, item: string): string {
    return lang === "en" ? `House ${house}: ${item}` : `${house}ஆம் பாவம்: ${item}`;
  },

  pos7thNoRahuShani(lang: MarriageLang): string {
    return lang === "en"
      ? "7th lord is free from Rahu/Shani pressure in the current baseline model."
      : "7ஆம் அதிபதி தற்போதைய அடிப்படை மாதிரியில் ராகு/சனி அழுத்தம் இல்லாமல் உள்ளார்.";
  },

  chRahu7th(lang: MarriageLang): string {
    return lang === "en"
      ? "Rahu is influencing the 7th lord."
      : "ராகு 7ஆம் அதிபதியைப் பாதிக்கிறார்.";
  },

  chShani7th(lang: MarriageLang): string {
    return lang === "en"
      ? "Shani is influencing the 7th lord."
      : "சனி 7ஆம் அதிபதியைப் பாதிக்கிறார்.";
  },

  chRahuShukra(lang: MarriageLang): string {
    return lang === "en"
      ? "Rahu is influencing Shukra."
      : "ராகு சுக்கிரனைப் பாதிக்கிறார்.";
  },

  chShaniShukra(lang: MarriageLang): string {
    return lang === "en"
      ? "Shani is influencing Shukra."
      : "சனி சுக்கிரனைப் பாதிக்கிறார்.";
  },

  posGuruKochar(lang: MarriageLang): string {
    return lang === "en"
      ? "Guru kochar is supporting marriage by looking at the 7th or 11th house."
      : "குரு கோசாரம் 7 அல்லது 11 பாவத்தைப் பார்த்து திருமணத்தை ஆதரிக்கிறது.";
  },

  chGuruKochar(lang: MarriageLang): string {
    return lang === "en"
      ? "Guru kochar is not currently looking at the 7th or 11th house."
      : "குரு கோசாரம் தற்போது 7 அல்லது 11 பாவத்தைப் பார்க்கவில்லை.";
  },

  foundationOpen(lang: MarriageLang): string {
    return lang === "en"
      ? "Marriage foundation is read from houses 3, 7, and 11, then checked through the 7th lord and Shukra."
      : "திருமண அடித்தளம் 3, 7, 11 பாவங்களிலிருந்து வாசிக்கப்பட்டு, 7ஆம் அதிபதி மற்றும் சுக்கிரன் மூலம் சரிபார்க்கப்படுகிறது.";
  },

  foundation7th(lang: MarriageLang, planet: string, sign: string, house: number): string {
    return lang === "en"
      ? `7th lord ${planet} is in ${sign}, house ${house}.`
      : `7ஆம் அதிபதி ${planet} ${sign}-இில், ${house}ஆம் பாவம்.`;
  },

  foundationShukra(lang: MarriageLang, sign: string, house: number): string {
    return lang === "en"
      ? `Shukra is in ${sign}, house ${house}.`
      : `சுக்கிரன் ${sign}-இில், ${house}ஆம் பாவம்.`;
  },

  foundation7thPressure(lang: MarriageLang): string {
    return lang === "en"
      ? "The 7th lord is under Rahu/Shani influence."
      : "7ஆம் அதிபதி ராகு/சனி தாக்கத்தில் உள்ளார்.";
  },

  foundationShukraPressure(lang: MarriageLang): string {
    return lang === "en"
      ? "Shukra is under Rahu/Shani influence."
      : "சுக்கிரன் ராகு/சனி தாக்கத்தில் உள்ளார்.";
  },

  overviewStrength(lang: MarriageLang, score: number): string {
    return lang === "en"
      ? `Marriage strength score is ${score}.`
      : `திருமண வலிமை மதிப்பெண் ${score}.`;
  },

  overviewActivation(lang: MarriageLang, score: number): string {
    return lang === "en"
      ? `Current activation score is ${score}.`
      : `தற்போதைய செயல்பாட்டு மதிப்பெண் ${score}.`;
  },

  overviewGuruYes(lang: MarriageLang): string {
    return lang === "en"
      ? "Guru kochar is currently acting as a marriage trigger."
      : "குரு கோசாரம் தற்போது திருமணத் தூண்டுதலாகச் செயல்படுகிறது.";
  },

  overviewGuruNo(lang: MarriageLang): string {
    return lang === "en"
      ? "Guru kochar is not currently acting as a marriage trigger."
      : "குரு கோசாரம் தற்போது திருமணத் தூண்டுதலாகச் செயல்படவில்லை.";
  },

  roleLabel(lang: MarriageLang, role: string): string {
    if (lang === "en") return role;
    const m: Record<string, string> = {
      "3rd-lord": "3ஆம் அதிபதி",
      "7th-lord": "7ஆம் அதிபதி",
      "11th-lord": "11ஆம் அதிபதி",
      shukra: "சுக்கிரன்",
      guru: "குரு",
    };
    return m[role] ?? role;
  },
};

function verdictWord(
  lang: MarriageLang,
  v: "strong" | "supportive" | "weak"
): string {
  if (lang === "en") return v;
  const m = { strong: "வலுவானது", supportive: "ஆதரவானது", weak: "பலவீனமானது" };
  return m[v];
}

export function formatMatchedRoles(lang: MarriageLang, roles: string[]): string {
  if (!roles.length) return "";
  return roles.map((r) => mp.roleLabel(lang, r)).join(lang === "en" ? ", " : ", ");
}

export function isBaselineNoChallengeNote(text: string): boolean {
  return (
    text.includes("No major direct challenge") ||
    text.includes("பெரிய நேரடி சவால் தெரியவில்லை")
  );
}
