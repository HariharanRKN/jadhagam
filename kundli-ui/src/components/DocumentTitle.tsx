"use client";

import { useEffect } from "react";
import { useTranslations } from "@/i18n/useTranslations";

export function DocumentTitle() {
  const { t } = useTranslations();
  useEffect(() => {
    document.title = t("home.metaTitle");
  }, [t]);
  return null;
}
