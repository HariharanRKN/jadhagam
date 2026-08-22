"use client";

import { getRasiCellLabel, RASI_TAMIL } from "@/components/SouthIndianChart/chartConfig";
import { VIMSOTTARI_LABELS_EN } from "@/i18n/vimsottariLabelsEn";
import { useTranslations } from "@/i18n/useTranslations";
import type { PlanetRow, VimsottariLabelsTa } from "@/types/chartData";
import styles from "./TamilTables.module.css";

/** Matches horoscope.py LAGNA_PLANET_ID — not a graha. */
export const LAGNA_PLANET_ID = -1;

const NAKSHATRA_EN = [
  "Ashwini",
  "Bharani",
  "Krittika",
  "Rohini",
  "Mrigashira",
  "Ardra",
  "Punarvasu",
  "Pushya",
  "Ashlesha",
  "Magha",
  "Purva Phalguni",
  "Uttara Phalguni",
  "Hasta",
  "Chitra",
  "Swati",
  "Vishakha",
  "Anuradha",
  "Jyeshtha",
  "Moola",
  "Purva Ashadha",
  "Uttara Ashadha",
  "Shravana",
  "Dhanishta",
  "Shatabhisha",
  "Purva Bhadrapada",
  "Uttara Bhadrapada",
  "Revati",
] as const;

const NAKSHATRA_TAMIL = [
  "அஸ்வினி",
  "பரணி",
  "கிருத்திகை",
  "ரோகிணி",
  "மிருகசீரிடம்",
  "திருவாதிரை",
  "புனர்பூசம்",
  "பூசம்",
  "ஆயில்யம்",
  "மகம்",
  "பூரம்",
  "உத்திரம்",
  "அஸ்தம்",
  "சித்திரை",
  "சுவாதி",
  "விசாகம்",
  "அனுஷம்",
  "கேட்டை",
  "மூலம்",
  "பூராடம்",
  "உத்திராடம்",
  "திருவோணம்",
  "அவிட்டம்",
  "சதயம்",
  "பூரட்டாதி",
  "உத்திரட்டாதி",
  "ரேவதி",
] as const;

interface Props {
  natal: PlanetRow[];
  natalLagna?: PlanetRow | null;
  birth?: { ascendantRasi: number; ascendantDeg?: number };
  transit: PlanetRow[];
  labels: VimsottariLabelsTa;
  dark?: boolean;
}

export function lagnaRowFromBirth(birth: {
  ascendantRasi: number;
  ascendantDeg?: number;
}): PlanetRow {
  const rasi = ((birth.ascendantRasi % 12) + 12) % 12;
  const deg = typeof birth.ascendantDeg === "number" ? birth.ascendantDeg : 0;
  const tl = rasi * 30 + deg;
  const nakSpan = 360 / 27;
  const nakIdx = Math.floor(tl / nakSpan) % 27;
  const pada = Math.floor((tl % nakSpan) / (nakSpan / 4)) + 1;
  return {
    planetId: LAGNA_PLANET_ID,
    planetEn: "Lagna",
    planetTa: "லக்னம்",
    rasi,
    rasiTa: RASI_TAMIL[rasi] ?? "",
    degInSign: deg,
    totalLongitude: tl,
    nakshatraEn: NAKSHATRA_EN[nakIdx],
    nakshatraTa: NAKSHATRA_TAMIL[nakIdx],
    pada,
  };
}

function natalRowsWithLagna(
  natal: PlanetRow[],
  natalLagna: PlanetRow | null | undefined,
  birth?: { ascendantRasi: number; ascendantDeg?: number }
): PlanetRow[] {
  const grahas = natal.filter((row) => row.planetId !== LAGNA_PLANET_ID);
  const lagna = natalLagna ?? (birth ? lagnaRowFromBirth(birth) : null);
  return lagna ? [lagna, ...grahas] : grahas;
}

function nakshatraLabel(row: PlanetRow, language: "en" | "ta"): string {
  if (language === "en") return row.nakshatraEn ?? row.nakshatraTa;
  return row.nakshatraTa;
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
              <td data-label={labels.planet}>
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
              <td data-label={labels.rasi}>
                {language === "en" ? getRasiCellLabel("en", r.rasi) : r.rasiTa}
              </td>
              <td className={styles.mono} data-label={labels.deg}>
                {r.degInSign.toFixed(2)}°
              </td>
              <td className={styles.mono} data-label={labels.totalDegTa}>
                {typeof r.totalLongitude === "number"
                  ? `${r.totalLongitude.toFixed(2)}°`
                  : "—"}
              </td>
              <td data-label={labels.nakshatra}>{nakshatraLabel(r, language)}</td>
              <td data-label={labels.pada}>{r.pada}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PlanetaryTableTamil({
  natal,
  natalLagna,
  birth,
  transit,
  labels,
  dark,
}: Props) {
  const { language } = useTranslations();
  const tableLabels = language === "en" ? VIMSOTTARI_LABELS_EN : labels;

  return (
    <section className={`${styles.section} ${dark ? styles.themeDark : ""}`}>
      <h2 className={styles.sectionTitle}>{tableLabels.natalTitle}</h2>
      <PlanetTable
        rows={natalRowsWithLagna(natal, natalLagna, birth)}
        labels={tableLabels}
        language={language}
      />

      <h2 className={styles.sectionTitle}>{tableLabels.transitTitle}</h2>
      <PlanetTable rows={transit} labels={tableLabels} language={language} />
    </section>
  );
}
