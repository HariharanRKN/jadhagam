"use client";

import { useTranslations } from "@/i18n/useTranslations";
import styles from "./SouthIndianChart.module.css";
import {
  RASI_GRID,
  getRasiCellLabel,
  normalizePlanetsByRasi,
  getPlanetsInRasi,
  getPlanetChipLabel,
  getPlanetTooltipLabel,
  type SouthIndianChartProps,
} from "./chartConfig";

export function SouthIndianChart({
  planetsByRasi: planetsInput,
  ascendantRasi,
  highlightedRasis = [],
  title,
  onRasiClick,
  theme = "light",
  language: languageProp,
}: SouthIndianChartProps) {
  const { t, language: ctxLanguage } = useTranslations();
  const language = languageProp ?? ctxLanguage;
  const planetsByRasi = normalizePlanetsByRasi(planetsInput);
  const highlighted = new Set(highlightedRasis);
  const displayTitle = title ?? t("tables.defaultChartTitle");
  const moonBadge = t("tables.moonHighlight");

  const handleCellClick = (rasi: number) => {
    if (onRasiClick) {
      onRasiClick(rasi);
    } else {
      console.log("Rasi:", rasi, getRasiCellLabel(language, rasi));
    }
  };

  return (
    <div
      className={`${styles.wrapper} ${theme === "dark" ? styles.dark : ""}`}
    >
      <div className={styles.grid}>
        {RASI_GRID.map(({ rasi, row, col }) => {
          const planets = getPlanetsInRasi(rasi, planetsByRasi);
          return (
            <div
              key={rasi}
              role="button"
              tabIndex={0}
              className={`${styles.cell} ${rasi === ascendantRasi ? styles.cellAscendant : ""} ${highlighted.has(rasi) ? styles.cellHighlighted : ""}`}
              style={{ gridRow: row, gridColumn: col }}
              onClick={() => handleCellClick(rasi)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleCellClick(rasi);
                }
              }}
            >
              <span className={styles.rasiLabel}>{getRasiCellLabel(language, rasi)}</span>
              {highlighted.has(rasi) ? (
                <span className={styles.highlightBadge}>{moonBadge}</span>
              ) : null}
              <div className={styles.planets}>
                {planets.map((name, idx) => (
                  <span
                    key={`${rasi}-${name}-${idx}`}
                    className={styles.planetChip}
                    data-tooltip={getPlanetTooltipLabel(language, name)}
                    title={getPlanetTooltipLabel(language, name)}
                  >
                    {getPlanetChipLabel(language, name)}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
        <div
          className={styles.center}
          style={{ gridRow: "2 / 4", gridColumn: "2 / 4" }}
        >
          <span className={styles.centerTitle}>{displayTitle}</span>
        </div>
      </div>
    </div>
  );
}

export type { SouthIndianChartProps } from "./chartConfig";
