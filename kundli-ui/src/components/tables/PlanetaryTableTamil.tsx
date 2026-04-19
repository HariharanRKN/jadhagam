"use client";

import { getRasiCellLabel } from "@/components/SouthIndianChart/chartConfig";
import { VIMSOTTARI_LABELS_EN } from "@/i18n/vimsottariLabelsEn";
import { useTranslations } from "@/i18n/useTranslations";
import type { PlanetRow, VimsottariLabelsTa } from "@/types/chartData";
import styles from "./TamilTables.module.css";

interface Props {
  natal: PlanetRow[];
  transit: PlanetRow[];
  labels: VimsottariLabelsTa;
  dark?: boolean;
}

function PlanetTable({
  rows,
  labels,
  language,
}: {
  rows: PlanetRow[];
  labels: VimsottariLabelsTa;
  language: "en" | "ta";
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{labels.planet}</th>
            <th>{labels.rasi}</th>
            <th>{labels.deg}</th>
            <th>{labels.totalDegTa}</th>
            <th>{labels.nakshatra}</th>
            <th>{labels.pada}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.planetId}>
              <td>
                {language === "en" ? (
                  <>
                    <strong>{r.planetEn}</strong>
                    <span className={styles.mono}> ({r.planetTa})</span>
                  </>
                ) : (
                  <>
                    <strong>{r.planetTa}</strong>
                    <span className={styles.mono}> ({r.planetEn})</span>
                  </>
                )}
              </td>
              <td>
                {language === "en" ? getRasiCellLabel("en", r.rasi) : r.rasiTa}
              </td>
              <td className={styles.mono}>{r.degInSign.toFixed(2)}°</td>
              <td className={styles.mono}>
                {typeof r.totalLongitude === "number"
                  ? `${r.totalLongitude.toFixed(2)}°`
                  : "—"}
              </td>
              <td>{r.nakshatraTa}</td>
              <td>{r.pada}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PlanetaryTableTamil({ natal, transit, labels, dark }: Props) {
  const { language } = useTranslations();
  const tableLabels = language === "en" ? VIMSOTTARI_LABELS_EN : labels;

  return (
    <section className={`${styles.section} ${dark ? styles.themeDark : ""}`}>
      <h2 className={styles.sectionTitle}>{tableLabels.natalTitle}</h2>
      <PlanetTable rows={natal} labels={tableLabels} language={language} />

      <h2 className={styles.sectionTitle}>{tableLabels.transitTitle}</h2>
      <PlanetTable rows={transit} labels={tableLabels} language={language} />
    </section>
  );
}
