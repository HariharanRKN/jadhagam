"use client";

import { useLanguage, type LanguageCode } from "./LanguageProvider";

const LABELS: Record<LanguageCode, { english: string; tamil: string }> = {
  en: {
    english: "English",
    tamil: "Tamil",
  },
  ta: {
    english: "ஆங்கிலம்",
    tamil: "தமிழ்",
  },
};

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  const labels = LABELS[language];

  return (
    <div className="languageToggle" role="group" aria-label="Language toggle">
      <button
        type="button"
        className={`languageToggleBtn ${language === "en" ? "active" : ""}`}
        onClick={() => setLanguage("en")}
      >
        {labels.english}
      </button>
      <button
        type="button"
        className={`languageToggleBtn ${language === "ta" ? "active" : ""}`}
        onClick={() => setLanguage("ta")}
      >
        {labels.tamil}
      </button>
    </div>
  );
}
