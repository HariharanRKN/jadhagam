"use client";

import { useCallback, useMemo } from "react";
import type { LanguageCode } from "@/components/LanguageProvider";
import { useLanguage } from "@/components/LanguageProvider";
import { messages, type MessageBundle } from "./messages";

function getString(bundle: MessageBundle, path: string): string {
  const parts = path.split(".");
  let cur: unknown = bundle;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return path;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "string" ? cur : path;
}

/** Interpolate `{name}` placeholders in a template string. */
export function interpolate(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`
  );
}

export function getMessage(lang: LanguageCode, path: string): string {
  return getString(messages[lang], path);
}

export function useTranslations() {
  const { language } = useLanguage();
  const t = useCallback(
    (path: string) => getMessage(language, path),
    [language]
  );
  const interpolateBound = useCallback(
    (path: string, vars: Record<string, string | number>) =>
      interpolate(getMessage(language, path), vars),
    [language]
  );
  return useMemo(
    () => ({
      language,
      t,
      interpolate: interpolateBound,
    }),
    [language, t, interpolateBound]
  );
}
