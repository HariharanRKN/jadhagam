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
  emphasisRasis = [],
  title,
  onRasiClick,
  theme = "light",
  language: languageProp,
  showAscendant = true,
  janmaRasi,
  janmaLabel,
  houseNumbersFrom,
  natalMarks = [],
  highlightedPlanets = [],
  retrogradePlanets = [],
  mutedPlanets = [],
}: SouthIndianChartProps) {
  const { t, language: ctxLanguage } = useTranslations();
  const language = languageProp ?? ctxLanguage;
  const planetsByRasi = normalizePlanetsByRasi(planetsInput);
  const highlighted = new Set(highlightedRasis);
  const emphasis = new Set(emphasisRasis);
  const hotPlanets = new Set(highlightedPlanets);
  const retrograde = new Set(retrogradePlanets);
  const muted = new Set(mutedPlanets);
  const marksByRasi = new Map<number, string[]>();
  for (const mark of natalMarks) {
    const list = marksByRasi.get(mark.rasi) ?? [];
    list.push(mark.label);
    marksByRasi.set(mark.rasi, list);
  }
  const displayTitle = title ?? t("tables.defaultChartTitle");
  const moonBadge = t("tables.moonHighlight");
  const numberOrigin = houseNumbersFrom ?? janmaRasi;

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
          const isJanma = janmaRasi != null && rasi === janmaRasi;
          const houseNumber =
            numberOrigin == null ? null : ((rasi - numberOrigin + 12) % 12) + 1;
          const marks = marksByRasi.get(rasi) ?? [];
          return (
            <div
              key={rasi}
              role="button"
              tabIndex={0}
              className={`${styles.cell} ${showAscendant && rasi === ascendantRasi ? styles.cellAscendant : ""} ${isJanma ? styles.cellJanma : ""} ${highlighted.has(rasi) || emphasis.has(rasi) ? styles.cellHighlighted : ""}`}
              style={{ gridRow: row, gridColumn: col }}
              onClick={() => handleCellClick(rasi)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleCellClick(rasi);
                }
              }}
            >
              <span className={styles.rasiLabel}>
                {getRasiCellLabel(language, rasi)}
                {isJanma && janmaLabel ? (
                  <span className={styles.janmaBadge}>{janmaLabel}</span>
                ) : null}
              </span>
              {highlighted.has(rasi) ? (
                <span className={styles.highlightBadge}>{moonBadge}</span>
              ) : null}
              <div className={styles.planets}>
                {planets.map((name, idx) => {
                  const chipClass = muted.has(name)
                    ? `${styles.planetChip} ${styles.planetChipMuted}`
                    : hotPlanets.has(name)
                      ? `${styles.planetChip} ${styles.planetChipActive}`
                      : styles.planetChip;
                  return (
                  <span
                    key={`${rasi}-${name}-${idx}`}
                    className={chipClass}
                    data-planet={name}
                    data-muted={muted.has(name) ? "true" : undefined}
                    data-tooltip={getPlanetTooltipLabel(language, name)}
                    title={getPlanetTooltipLabel(language, name)}
                  >
                    {getPlanetChipLabel(language, name)}
                    {retrograde.has(name) ? <span className={styles.retroMark}>℞</span> : null}
                  </span>
                  );
                })}
              </div>
              {marks.length ? (
                <span className={styles.natalMark}>{marks.join(" · ")}</span>
              ) : null}
              {houseNumber != null ? (
                <span className={styles.houseNum}>{houseNumber}</span>
              ) : null}
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
