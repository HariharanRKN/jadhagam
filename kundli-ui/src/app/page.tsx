"use client";

import { useEffect, useState } from "react";
import { SouthIndianChart } from "@/components/SouthIndianChart/SouthIndianChart";
import { BirthInputForm } from "@/components/BirthInputForm";
import { PlanetaryTableTamil } from "@/components/tables/PlanetaryTableTamil";
import { DashaBhuktiTableTamil } from "@/components/tables/DashaBhuktiTableTamil";
import { VimsottariExpander } from "@/components/tables/VimsottariExpander";
import type { ChartDataPayload } from "@/types/chartData";
import styles from "./page.module.css";

type TrackerTab = "kundli" | "kochar";

type HistoricalPositionsResponse = {
  dateIst: string;
  timestampIst: string;
  timestampUtc: string;
  positions: Record<
    string,
    {
      planetId: number;
      planetEn: string;
      rasi: number;
      degInSign: number;
      totalLongitude: number;
    }
  >;
};

type HistoricalSearchResponse = {
  matchCount: number;
  matches: Array<{
    date_ist: string;
    ts_ist: string;
    ts_utc: string;
  }>;
  ranges: Array<{
    startDateIst: string;
    endDateIst: string;
  }>;
};

const RASI_OPTIONS = [
  { value: "mesha", label: "Mesha" },
  { value: "rishabha", label: "Rishabha" },
  { value: "mithuna", label: "Mithuna" },
  { value: "karkata", label: "Karkata" },
  { value: "simha", label: "Simha" },
  { value: "kanya", label: "Kanya" },
  { value: "tula", label: "Tula" },
  { value: "vrischika", label: "Vrischika" },
  { value: "dhanu", label: "Dhanu" },
  { value: "makara", label: "Makara" },
  { value: "kumbha", label: "Kumbha" },
  { value: "meena", label: "Meena" },
] as const;

const PLANET_OPTIONS = [
  { value: "sun", label: "Sun" },
  { value: "moon", label: "Moon" },
  { value: "mars", label: "Mars" },
  { value: "mercury", label: "Mercury" },
  { value: "guru", label: "Guru" },
  { value: "sukra", label: "Sukra" },
  { value: "saturn", label: "Saturn" },
  { value: "rahu", label: "Rahu" },
  { value: "ketu", label: "Ketu" },
] as const;

function positionsToPlanetsByRasi(
  positions: HistoricalPositionsResponse["positions"]
): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  for (const planet of Object.values(positions)) {
    const key = String(planet.rasi);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(planet.planetEn);
  }
  return grouped;
}

export default function Home() {
  const [dark, setDark] = useState(false);
  const [data, setData] = useState<ChartDataPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TrackerTab>("kundli");
  const [trackerDate, setTrackerDate] = useState("1990-05-20");
  const [trackerLoading, setTrackerLoading] = useState(false);
  const [trackerError, setTrackerError] = useState<string | null>(null);
  const [trackerSnapshot, setTrackerSnapshot] =
    useState<HistoricalPositionsResponse | null>(null);
  const [selectedPlanets, setSelectedPlanets] = useState<string[]>([]);
  const [selectedRasi, setSelectedRasi] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResult, setSearchResult] =
    useState<HistoricalSearchResponse | null>(null);
  const [searchSnapshots, setSearchSnapshots] = useState<
    HistoricalPositionsResponse[]
  >([]);

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

  useEffect(() => {
    let cancelled = false;
    setTrackerLoading(true);
    setTrackerError(null);
    fetch(`/api/history/positions?date=${encodeURIComponent(trackerDate)}`)
      .then(async (res) => {
        const json = (await res.json()) as HistoricalPositionsResponse & {
          error?: string;
          detail?: string;
        };
        if (!res.ok) {
          throw new Error(json.detail || json.error || `Request failed (${res.status})`);
        }
        return json;
      })
      .then((json) => {
        if (!cancelled) {
          setTrackerSnapshot(json);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setTrackerSnapshot(null);
          setTrackerError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) setTrackerLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [trackerDate]);

  async function handleSearch() {
    if (!selectedPlanets.length || !selectedRasi) return;
    setSearchLoading(true);
    setSearchError(null);
    setSearchResult(null);
    setSearchSnapshots([]);
    try {
      const params = new URLSearchParams({
        rasi: selectedRasi,
        startDate: "1960-01-01",
        endDate: new Date().toISOString().slice(0, 10),
      });
      for (const planet of selectedPlanets) {
        params.append("planet", planet);
      }

      const res = await fetch(`/api/history/search?${params.toString()}`);
      const json = (await res.json()) as HistoricalSearchResponse & {
        error?: string;
        detail?: string;
      };
      if (!res.ok) {
        throw new Error(json.detail || json.error || `Request failed (${res.status})`);
      }
      setSearchResult(json);

      const firstMatches = json.matches.slice(0, 10);
      const snapshots = await Promise.all(
        firstMatches.map(async (match) => {
          const posRes = await fetch(
            `/api/history/positions?date=${encodeURIComponent(match.date_ist)}`
          );
          const posJson = (await posRes.json()) as HistoricalPositionsResponse & {
            error?: string;
            detail?: string;
          };
          if (!posRes.ok) {
            throw new Error(
              posJson.detail || posJson.error || `Request failed (${posRes.status})`
            );
          }
          return posJson;
        })
      );
      setSearchSnapshots(snapshots);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearchLoading(false);
    }
  }

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

      <div className={styles.tabBar}>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === "kundli" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("kundli")}
        >
          Kundli
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === "kochar" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("kochar")}
        >
          Kochar Tracker
        </button>
      </div>

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

      {data && activeTab === "kundli" && (
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

      {data && activeTab === "kochar" && (
        <div className={styles.trackerWrap}>
          <section className={styles.trackerSection}>
            <div className={styles.sectionHeader}>
              <h2>Section 1</h2>
              <p>Compare today&apos;s gochara with a selected historical IST date.</p>
            </div>
            <div className={styles.trackerGrid}>
              <div className={styles.trackerPane}>
                <div className={styles.paneHead}>
                  <h3>Current planetary position</h3>
                  <p>{data.transit.computedAt ? `Computed at ${data.transit.computedAt}` : "Live from current transit payload"}</p>
                </div>
                <SouthIndianChart
                  planetsByRasi={data.transit.planetsByRasi}
                  ascendantRasi={data.transit.ascendantRasi}
                  title="கோசார நிலை"
                  theme={theme}
                />
              </div>

              <div className={styles.trackerPane}>
                <div className={styles.paneHead}>
                  <h3>Historical planetary position</h3>
                  <label className={styles.dateField}>
                    <span>Date chooser</span>
                    <input
                      type="date"
                      value={trackerDate}
                      onChange={(e) => setTrackerDate(e.target.value)}
                      min="1960-01-01"
                      max={new Date().toISOString().slice(0, 10)}
                    />
                  </label>
                </div>
                {trackerError ? (
                  <p className={styles.inlineError}>{trackerError}</p>
                ) : trackerLoading ? (
                  <p className={styles.inlineMeta}>Loading chart…</p>
                ) : trackerSnapshot ? (
                  <>
                    <p className={styles.inlineMeta}>
                      Snapshot time: {trackerSnapshot.timestampIst}
                    </p>
                    <SouthIndianChart
                      planetsByRasi={positionsToPlanetsByRasi(
                        trackerSnapshot.positions
                      )}
                      ascendantRasi={data.transit.ascendantRasi}
                      title={trackerSnapshot.dateIst}
                      theme={theme}
                    />
                  </>
                ) : null}
              </div>
            </div>
          </section>

          <section className={styles.trackerSection}>
            <div className={styles.sectionHeader}>
              <h2>Section 2</h2>
              <p>Search dates where selected planets appeared in the same rasi.</p>
            </div>

            <div className={styles.searchControls}>
              <label className={styles.fieldBlock}>
                <span>Planets</span>
                <select
                  multiple
                  value={selectedPlanets}
                  onChange={(e) =>
                    setSelectedPlanets(
                      Array.from(e.target.selectedOptions, (option) => option.value)
                    )
                  }
                >
                  {PLANET_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.fieldBlock}>
                <span>Rasi chart</span>
                <select
                  value={selectedRasi}
                  onChange={(e) => setSelectedRasi(e.target.value)}
                >
                  <option value="">Select rasi</option>
                  {RASI_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className={styles.computeBox}>
                <button
                  type="button"
                  className={styles.computeBtn}
                  disabled={!selectedPlanets.length || !selectedRasi || searchLoading}
                  onClick={() => void handleSearch()}
                >
                  {searchLoading ? "Computing…" : "Compute"}
                </button>
              </div>
            </div>

            {searchError ? (
              <p className={styles.inlineError}>{searchError}</p>
            ) : null}

            {searchResult ? (
              <div className={styles.searchSummary}>
                <p className={styles.inlineMeta}>
                  {searchResult.matchCount} daily matches found between 1960-01-01 and{" "}
                  {new Date().toISOString().slice(0, 10)}.
                </p>
                {searchResult.ranges.length > 0 ? (
                  <div className={styles.rangeList}>
                    {searchResult.ranges.map((range) => (
                      <span
                        key={`${range.startDateIst}-${range.endDateIst}`}
                        className={styles.rangeChip}
                      >
                        {range.startDateIst} to {range.endDateIst}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {searchSnapshots.length > 0 ? (
              <div className={styles.resultGrid}>
                {searchSnapshots.map((snapshot) => (
                  <section key={snapshot.dateIst} className={styles.resultCard}>
                    <h3>{snapshot.dateIst}</h3>
                    <p className={styles.inlineMeta}>{snapshot.timestampIst}</p>
                    <SouthIndianChart
                      planetsByRasi={positionsToPlanetsByRasi(snapshot.positions)}
                      ascendantRasi={data.transit.ascendantRasi}
                      title={snapshot.dateIst}
                      theme={theme}
                    />
                  </section>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}
