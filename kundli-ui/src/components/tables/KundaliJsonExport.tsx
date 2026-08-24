"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "@/i18n/useTranslations";
import {
  kundaliShareFilename,
  stringifyKundaliShareJson,
} from "@/lib/kundaliExport";
import type { ChartDataPayload } from "@/types/chartData";
import styles from "./TamilTables.module.css";

interface Props {
  chart: ChartDataPayload;
  dark?: boolean;
  compact?: boolean;
}

function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function KundaliJsonExport({ chart, dark, compact }: Props) {
  const { t } = useTranslations();
  const [copied, setCopied] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const filename = useMemo(() => kundaliShareFilename(chart), [chart]);
  const jsonText = useMemo(
    () => (showJson ? stringifyKundaliShareJson(chart) : ""),
    [chart, showJson]
  );

  function jsonNow() {
    return jsonText || stringifyKundaliShareJson(chart);
  }

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(jsonNow());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className={`${styles.section} ${dark ? styles.themeDark : ""}`}>
      <h2 className={styles.sectionTitle}>{t("tables.jsonExportTitle")}</h2>
      {!compact ? <p className={styles.loading}>{t("tables.jsonExportDesc")}</p> : null}
      <div className={styles.exportActions}>
        <button
          type="button"
          className={styles.exportBtn}
          onClick={() => downloadTextFile(filename, jsonNow())}
        >
          {t("tables.jsonDownload")}
        </button>
        <button type="button" className={styles.exportBtnSecondary} onClick={() => void copyJson()}>
          {copied ? t("tables.jsonCopied") : t("tables.jsonCopy")}
        </button>
      </div>
      {!compact ? (
        <details
          className={styles.exportPreview}
          onToggle={(event) => setShowJson((event.target as HTMLDetailsElement).open)}
        >
          <summary>{t("tables.jsonShow")}</summary>
          {showJson ? <pre className={styles.exportPre}>{jsonText}</pre> : null}
        </details>
      ) : null}
    </section>
  );
}
