"use client";

import { VIMSOTTARI_LABELS_EN } from "@/i18n/vimsottariLabelsEn";
import { useTranslations } from "@/i18n/useTranslations";
import type { BhuktiRow, VimsottariLabelsTa } from "@/types/chartData";
import { compareDashaStart, lordEnglish, lordTamil } from "@/lib/tamilDasha";
import styles from "./TamilTables.module.css";

interface Props {
  rows: BhuktiRow[];
  labels: VimsottariLabelsTa;
  dark?: boolean;
}

export function DashaBhuktiTableTamil({ rows, labels, dark }: Props) {
  const { language } = useTranslations();
  const tableLabels = language === "en" ? VIMSOTTARI_LABELS_EN : labels;
  const lord = (id: number) => (language === "en" ? lordEnglish(id) : lordTamil(id));

  const sorted = [...rows].sort((a, b) => compareDashaStart(a.start, b.start));

  return (
    <section className={`${styles.section} ${dark ? styles.themeDark : ""}`}>
      <h2 className={styles.sectionTitle}>
        {tableLabels.dashaTitle} — {tableLabels.mahadasha} / {tableLabels.bhukti}
      </h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{tableLabels.mahadasha}</th>
              <th>{tableLabels.bhukti}</th>
              <th>{tableLabels.start}</th>
              <th>{tableLabels.end}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={`${r.maha}-${r.lord}-${r.start}-${i}`}>
                <td>{lord(r.maha)}</td>
                <td>{lord(r.lord)}</td>
                <td className={styles.mono}>{r.start}</td>
                <td className={styles.mono}>{r.end ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
