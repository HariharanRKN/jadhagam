import type { LanguageCode } from "@/components/LanguageProvider";
import { birthForm } from "./birthForm";
import { home } from "./home";
import { marriage2 } from "./marriage2";
import { tables } from "./tables";

export const messages = {
  en: {
    birthForm: birthForm.en,
    home: home.en,
    marriage2: marriage2.en,
    tables: tables.en,
  },
  ta: {
    birthForm: birthForm.ta,
    home: home.ta,
    marriage2: marriage2.ta,
    tables: tables.ta,
  },
} as const;

export type MessageBundle = (typeof messages)[LanguageCode];
