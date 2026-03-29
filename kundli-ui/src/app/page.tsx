"use client";

import { useEffect, useState } from "react";
import { SouthIndianChart } from "@/components/SouthIndianChart/SouthIndianChart";
import { BirthInputForm } from "@/components/BirthInputForm";
import { PlanetaryTableTamil } from "@/components/tables/PlanetaryTableTamil";
import { DashaBhuktiTableTamil } from "@/components/tables/DashaBhuktiTableTamil";
import { VimsottariExpander } from "@/components/tables/VimsottariExpander";
import type { ChartDataPayload } from "@/types/chartData";
import styles from "./page.module.css";

export default function Home() {
  const [dark, setDark] = useState(false);
  const [data, setData] = useState<ChartDataPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const theme = dark ? "dark" : "light";

  useEffect(() => {
    let cancelled = false;
    fetch("/chart-data.json")
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((json: ChartDataPayload) => {
        if (!cancelled) {
          setData(json);
          setLoadError(null);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setLoadError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={`${styles.page} ${dark ? styles.dark : ""}`}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <h1>South Indian Rasi chart</h1>
          <p>
            0-based rasi keys and English planet names match{" "}
            <code>horoscope.py</code> / PyJHora. Initial data loads from{" "}
            <code>public/chart-data.json</code>; use the form below to recompute
            via the local <code>/api/horoscope</code> endpoint (requires Python 3
            + PyJHora on the machine running Next.js).
          </p>
          {data?.meta && (
            <p className={styles.metaLine}>
              {(data.meta.name || data.meta.gender) && (
                <>
                  {data.meta.name ? <>{data.meta.name}</> : null}
                  {data.meta.name && data.meta.gender ? " · " : null}
                  {data.meta.gender ? <>{data.meta.gender}</> : null}
                  <br />
                </>
              )}
              {data.meta.dob} · {data.meta.tob} · {data.meta.place} ·{" "}
              {data.meta.ayanamsa}
              {data.transit.computedAt
                ? ` · transit computed ${data.transit.computedAt}`
                : null}
            </p>
          )}
        </div>
        <button
          type="button"
          className={styles.themeToggle}
          onClick={() => setDark((d) => !d)}
        >
          {dark ? "Light mode" : "Dark mode"}
        </button>
      </header>

      <BirthInputForm
        dark={dark}
        onSuccess={(payload) => {
          setData(payload);
          setApiError(null);
        }}
        onError={(msg) => setApiError(msg || null)}
      />

      {apiError && (
        <p className={styles.apiError} role="alert">
          {apiError}
        </p>
      )}

      {loadError && (
        <p className={styles.loadError}>
          Could not load chart data: {loadError}. Place{" "}
          <code>chart-data.json</code> in <code>public/</code> or run the Python
          exporter.
        </p>
      )}

      {data && (
        <>
          <div className={styles.charts}>
            <section className={styles.chartBlock}>
              <h2>Birth chart</h2>
              <SouthIndianChart
                planetsByRasi={data.birth.planetsByRasi}
                ascendantRasi={data.birth.ascendantRasi}
                title="ஜனன குண்டலி"
                theme={theme}
              />
            </section>
            <section className={styles.chartBlock}>
              <h2>Transit (gochara)</h2>
              <SouthIndianChart
                planetsByRasi={data.transit.planetsByRasi}
                ascendantRasi={data.transit.ascendantRasi}
                title="கோசார நிலை"
                theme={theme}
              />
            </section>
          </div>

          <PlanetaryTableTamil
            natal={data.natalPlanets}
            transit={data.transitPlanets}
            labels={data.vimsottari.labelsTa}
            dark={dark}
          />
          <DashaBhuktiTableTamil
            rows={data.vimsottari.bhukti}
            labels={data.vimsottari.labelsTa}
            dark={dark}
          />
          <VimsottariExpander
            mahas={data.vimsottari.mahadasha}
            bhukti={data.vimsottari.bhukti}
            antara={data.vimsottari.antara}
            sookshma={data.vimsottari.sookshma}
            labels={data.vimsottari.labelsTa}
            dark={dark}
          />
        </>
      )}
    </div>
  );
}
