"use client";

import styles from "./SouthIndianChart.module.css";
import {
  RASI_GRID,
  RASI_TAMIL,
  normalizePlanetsByRasi,
  getPlanetsInRasi,
  getPlanetLabel,
  getPlanetFullName,
  type SouthIndianChartProps,
} from "./chartConfig";

export function SouthIndianChart({
  planetsByRasi: planetsInput,
  ascendantRasi,
  highlightedRasis = [],
  title = "ராசி",
  onRasiClick,
  theme = "light",
}: SouthIndianChartProps) {
  const planetsByRasi = normalizePlanetsByRasi(planetsInput);
  const highlighted = new Set(highlightedRasis);

  const handleCellClick = (rasi: number) => {
    if (onRasiClick) {
      onRasiClick(rasi);
    } else {
      console.log("Rasi:", rasi, RASI_TAMIL[rasi]);
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
              <span className={styles.rasiLabel}>{RASI_TAMIL[rasi]}</span>
              {highlighted.has(rasi) ? (
                <span className={styles.highlightBadge}>சந்</span>
              ) : null}
              <div className={styles.planets}>
                {planets.map((name, idx) => (
                  <span
                    key={`${rasi}-${name}-${idx}`}
                    className={styles.planetChip}
                    data-tooltip={getPlanetFullName(name)}
                    title={getPlanetFullName(name)}
                  >
                    {getPlanetLabel(name)}
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
          <span className={styles.centerTitle}>{title}</span>
        </div>
      </div>
    </div>
  );
}

export type { SouthIndianChartProps } from "./chartConfig";
