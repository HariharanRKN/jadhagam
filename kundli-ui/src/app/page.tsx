"use client";

import { useEffect, useMemo, useState } from "react";
import { SouthIndianChart } from "@/components/SouthIndianChart/SouthIndianChart";
import { BirthInputForm } from "@/components/BirthInputForm";
import { PlanetaryTableTamil } from "@/components/tables/PlanetaryTableTamil";
import { DashaBhuktiTableTamil } from "@/components/tables/DashaBhuktiTableTamil";
import { VimsottariExpander } from "@/components/tables/VimsottariExpander";
import type { AntaraRow, ChartDataPayload } from "@/types/chartData";
import styles from "./page.module.css";

type TrackerTab = "kundli" | "kochar" | "marriage";

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

type MarriageAnalysisRow = {
  houseNumber: 3 | 7 | 11;
  rasi: number;
  occupants: string[];
  lordId: number;
  lordName: string;
  aspectors: string[];
};

type PlanetInfluenceRow = {
  planetId: number;
  label: string;
  houseNumber: number;
  rasi: number;
  notes: string[];
};

type MarriageTimingRow = AntaraRow & {
  houseOrder: [3 | 7 | 11, 3 | 7 | 11, 3 | 7 | 11];
  permutationLabel: string;
};

type MarriagePermutationStatusRow = {
  permutationLabel: string;
  houseOrder: [3 | 7 | 11, 3 | 7 | 11, 3 | 7 | 11];
  occurred: boolean;
  firstMatch: MarriageTimingRow | null;
};

const RASI_OPTIONS = [
  { value: "mesha", label: "மேஷம்" },
  { value: "rishabha", label: "ரிஷபம்" },
  { value: "mithuna", label: "மிதுனம்" },
  { value: "karkata", label: "கடகம்" },
  { value: "simha", label: "சிம்மம்" },
  { value: "kanya", label: "கன்னி" },
  { value: "tula", label: "துலாம்" },
  { value: "vrischika", label: "விருச்சிகம்" },
  { value: "dhanu", label: "தனுசு" },
  { value: "makara", label: "மகரம்" },
  { value: "kumbha", label: "கும்பம்" },
  { value: "meena", label: "மீனம்" },
] as const;

const PLANET_OPTIONS = [
  { value: "sun", label: "சூரியன்" },
  { value: "moon", label: "சந்திரன்" },
  { value: "mars", label: "செவ்வாய்" },
  { value: "mercury", label: "புதன்" },
  { value: "guru", label: "குரு" },
  { value: "sukra", label: "சுக்கிரன்" },
  { value: "saturn", label: "சனி" },
  { value: "rahu", label: "ராகு" },
  { value: "ketu", label: "கேது" },
] as const;

const RASI_TAMIL = [
  "மேஷம்",
  "ரிஷபம்",
  "மிதுனம்",
  "கடகம்",
  "சிம்மம்",
  "கன்னி",
  "துலாம்",
  "விருச்சிகம்",
  "தனுசு",
  "மகரம்",
  "கும்பம்",
  "மீனம்",
];

const HOUSE_LABEL_TAMIL: Record<3 | 7 | 11, string> = {
  3: "3ஆம் பாவம்",
  7: "7ஆம் பாவம்",
  11: "11ஆம் பாவம்",
};

const LORD_TAMIL: Record<number, string> = {
  0: "சூரியன்",
  1: "சந்திரன்",
  2: "செவ்வாய்",
  3: "புதன்",
  4: "குரு",
  5: "சுக்கிரன்",
  6: "சனி",
  7: "ராகு",
  8: "கேது",
};

const SIGN_LORD: Record<number, number> = {
  0: 2,
  1: 5,
  2: 3,
  3: 1,
  4: 0,
  5: 3,
  6: 5,
  7: 2,
  8: 4,
  9: 6,
  10: 6,
  11: 4,
};

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

function houseFromRasi(ascendantRasi: number, rasi: number) {
  return ((rasi - ascendantRasi + 12) % 12) + 1;
}

function rasiForHouse(ascendantRasi: number, houseNumber: number) {
  return (ascendantRasi + houseNumber - 1) % 12;
}

function grahaDrishtiTargets(planetId: number, houseNumber: number): number[] {
  const offsets = new Set<number>([7]);
  if (planetId === 2) {
    offsets.add(4);
    offsets.add(8);
  }
  if (planetId === 4) {
    offsets.add(5);
    offsets.add(9);
  }
  if (planetId === 6) {
    offsets.add(3);
    offsets.add(10);
  }
  return Array.from(offsets).map(
    (offset) => ((houseNumber + offset - 2) % 12) + 1
  );
}

function sameLordSequence(
  targetLordIds: [number, number, number],
  row: AntaraRow
): [3 | 7 | 11, 3 | 7 | 11, 3 | 7 | 11] | null {
  const houseToLord = {
    3: targetLordIds[0],
    7: targetLordIds[1],
    11: targetLordIds[2],
  } as const;
  const permutations: Array<[3 | 7 | 11, 3 | 7 | 11, 3 | 7 | 11]> = [
    [3, 7, 11],
    [3, 11, 7],
    [7, 3, 11],
    [7, 11, 3],
    [11, 3, 7],
    [11, 7, 3],
  ];

  for (const permutation of permutations) {
    const [mahaHouse, bhuktiHouse, antaraHouse] = permutation;
    if (
      row.maha === houseToLord[mahaHouse] &&
      row.bhukti === houseToLord[bhuktiHouse] &&
      row.lord === houseToLord[antaraHouse]
    ) {
      return permutation;
    }
  }
  return null;
}

function formatTamilPlanetList(values: string[]) {
  return values.length ? values.join(", ") : "இல்லை";
}

function permutationLabelForRow(
  houseOrder: [3 | 7 | 11, 3 | 7 | 11, 3 | 7 | 11],
  row: AntaraRow
) {
  return `${LORD_TAMIL[row.maha]} / ${LORD_TAMIL[row.bhukti]} / ${LORD_TAMIL[row.lord]}`;
}

function buildPermutationLabelFromLords(
  houseOrder: [3 | 7 | 11, 3 | 7 | 11, 3 | 7 | 11],
  houseToLord: Record<3 | 7 | 11, number>
) {
  return houseOrder.map((house) => LORD_TAMIL[houseToLord[house]]).join(" / ");
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
  const [marriageLoading, setMarriageLoading] = useState(false);
  const [marriageSnapshots, setMarriageSnapshots] = useState<
    HistoricalPositionsResponse[]
  >([]);
  const [todayIso, setTodayIso] = useState("2026-04-03");

  const theme = dark ? "dark" : "light";

  const marriageDerived = useMemo(() => {
    if (!data) return null;

    const ascendant = data.birth.ascendantRasi;
    const targetHouses: [3 | 7 | 11, 3 | 7 | 11, 3 | 7 | 11] = [3, 7, 11];

    const analysisRows: MarriageAnalysisRow[] = targetHouses.map((houseNumber) => {
      const rasi = rasiForHouse(ascendant, houseNumber);
      const lordId = SIGN_LORD[rasi];
      const occupants = data.natalPlanets
        .filter((planet) => houseFromRasi(ascendant, planet.rasi) === houseNumber)
        .map((planet) => planet.planetTa);
      const aspectors = data.natalPlanets
        .filter((planet) =>
          grahaDrishtiTargets(
            planet.planetId,
            houseFromRasi(ascendant, planet.rasi)
          ).includes(houseNumber)
        )
        .map((planet) => planet.planetTa);
      return {
        houseNumber,
        rasi,
        occupants,
        lordId,
        lordName: LORD_TAMIL[lordId],
        aspectors,
      };
    });

    const targetLordIds = analysisRows.map(
      (row) => row.lordId
    ) as [number, number, number];
    const houseToLord = {
      3: targetLordIds[0],
      7: targetLordIds[1],
      11: targetLordIds[2],
    } as Record<3 | 7 | 11, number>;

    const targetLordPlanetRows = data.natalPlanets.filter((planet) =>
      targetLordIds.includes(planet.planetId)
    );

    const guruSukraRows: PlanetInfluenceRow[] = [4, 5]
      .map((planetId) => {
        const row = data.natalPlanets.find((planet) => planet.planetId === planetId);
        if (!row) return null;
        const houseNumber = houseFromRasi(ascendant, row.rasi);
        const notes: string[] = [];
        if (targetHouses.includes(houseNumber as 3 | 7 | 11)) {
          notes.push(`${HOUSE_LABEL_TAMIL[houseNumber as 3 | 7 | 11]}-இல் இருப்பு`);
        }
        const aspected = targetHouses.filter((houseNumberItem) =>
          grahaDrishtiTargets(planetId, houseNumber).includes(houseNumberItem)
        );
        if (aspected.length) {
          notes.push(
            `${aspected.map((item) => HOUSE_LABEL_TAMIL[item]).join(", ")} மீது பார்வை`
          );
        }
        const lordOf = analysisRows
          .filter((analysis) => analysis.lordId === planetId)
          .map((analysis) => HOUSE_LABEL_TAMIL[analysis.houseNumber]);
        if (lordOf.length) {
          notes.push(`${lordOf.join(", ")} அதிபதி`);
        }
        const conjunctTargetLords = targetLordPlanetRows
          .filter(
            (planet) =>
              planet.planetId !== planetId && planet.rasi === row.rasi
          )
          .map((planet) => planet.planetTa);
        if (conjunctTargetLords.length) {
          notes.push(
            `இதே ராசியில் இணைவு: ${conjunctTargetLords.join(", ")}`
          );
        }
        if (!notes.length) {
          notes.push("3, 7, 11 பாவங்களுடன் நேரடி இணைவு இல்லை");
        }
        return {
          planetId,
          label: row.planetTa,
          houseNumber,
          rasi: row.rasi,
          notes,
        };
      })
      .filter((row): row is PlanetInfluenceRow => row !== null);

    const timingRows: MarriageTimingRow[] = data.vimsottari.antara
      .map((row) => {
        const houseOrder = sameLordSequence(targetLordIds, row);
        if (!houseOrder) return null;
        const startDateIso = row.start.slice(0, 10);
        if (!startDateIso || startDateIso > todayIso) return null;
        return {
          ...row,
          houseOrder,
          permutationLabel: permutationLabelForRow(houseOrder, row),
        };
      })
      .filter((row): row is MarriageTimingRow => row !== null)
      .sort((a, b) => a.start.localeCompare(b.start, "en", { numeric: true }));

    const allPermutationOrders: Array<[3 | 7 | 11, 3 | 7 | 11, 3 | 7 | 11]> = [
      [3, 7, 11],
      [3, 11, 7],
      [7, 3, 11],
      [7, 11, 3],
      [11, 3, 7],
      [11, 7, 3],
    ];

    const permutationStatusRows: MarriagePermutationStatusRow[] =
      allPermutationOrders.map((houseOrder) => {
        const permutationLabel = buildPermutationLabelFromLords(
          houseOrder,
          houseToLord
        );
        const firstMatch =
          timingRows.find(
            (row) =>
              row.houseOrder[0] === houseOrder[0] &&
              row.houseOrder[1] === houseOrder[1] &&
              row.houseOrder[2] === houseOrder[2]
          ) ?? null;
        return {
          permutationLabel,
          houseOrder,
          occurred: Boolean(firstMatch),
          firstMatch,
        };
      });

    return {
      analysisRows,
      guruSukraRows,
      timingRows,
      permutationStatusRows,
    };
  }, [data, todayIso]);

  useEffect(() => {
    setTodayIso(new Date().toISOString().slice(0, 10));
  }, []);

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

  useEffect(() => {
    const timingRows = marriageDerived?.timingRows;
    if (!timingRows?.length) {
      setMarriageSnapshots([]);
      return;
    }
    let cancelled = false;
    async function loadMarriageSnapshots() {
      setMarriageLoading(true);
      try {
        const firstTen = timingRows.slice(0, 10);
        const snapshots = await Promise.all(
          firstTen.map(async (row) => {
            const dateOnly = row.start.slice(0, 10);
            const res = await fetch(
              `/api/history/positions?date=${encodeURIComponent(dateOnly)}`
            );
            const json = (await res.json()) as HistoricalPositionsResponse & {
              error?: string;
              detail?: string;
            };
            if (!res.ok) {
              throw new Error(
                json.detail || json.error || `Request failed (${res.status})`
              );
            }
            return json;
          })
        );
        if (!cancelled) {
          setMarriageSnapshots(snapshots);
        }
      } catch {
        if (!cancelled) {
          setMarriageSnapshots([]);
        }
      } finally {
        if (!cancelled) setMarriageLoading(false);
      }
    }
    void loadMarriageSnapshots();
    return () => {
      cancelled = true;
    };
  }, [marriageDerived]);

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
        endDate: todayIso,
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
          ஜாதகம்
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === "kochar" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("kochar")}
        >
          கோசார கண்காணிப்பு
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === "marriage" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("marriage")}
        >
          திருமணம்
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
              <h2>பகுதி 1</h2>
              <p>இன்றைய கோசார நிலையும் தேர்ந்தெடுத்த தேதியின் நிலையும் ஒப்பிடலாம்.</p>
            </div>
            <div className={styles.trackerGrid}>
              <div className={styles.trackerPane}>
                <div className={styles.paneHead}>
                  <h3>தற்போதைய கிரக நிலை</h3>
                  <p>
                    {data.transit.computedAt
                      ? `${data.transit.computedAt} நேர நிலை`
                      : "தற்போதைய கோசார தரவு"}
                  </p>
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
                  <h3>தேர்ந்தெடுத்த தேதியின் கிரக நிலை</h3>
                  <label className={styles.dateField}>
                    <span>தேதி</span>
                    <input
                      type="date"
                      value={trackerDate}
                      onChange={(e) => setTrackerDate(e.target.value)}
                      min="1960-01-01"
                      max={todayIso}
                    />
                  </label>
                </div>
                {trackerError ? (
                  <p className={styles.inlineError}>{trackerError}</p>
                ) : trackerLoading ? (
                  <p className={styles.inlineMeta}>ஜாதகம் ஏற்றப்படுகிறது…</p>
                ) : trackerSnapshot ? (
                  <>
                    <p className={styles.inlineMeta}>
                      எடுத்த நேரம்: {trackerSnapshot.timestampIst}
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
              <h2>பகுதி 2</h2>
              <p>தேர்ந்தெடுத்த கிரகங்கள் ஒரு ராசியில் சேர்ந்த நாட்களைத் தேடலாம்.</p>
            </div>

            <div className={styles.searchControls}>
              <label className={styles.fieldBlock}>
                <span>கிரகங்கள்</span>
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
                <span>ராசி</span>
                <select
                  value={selectedRasi}
                  onChange={(e) => setSelectedRasi(e.target.value)}
                >
                  <option value="">ராசியைத் தேர்வு செய்க</option>
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
                  {searchLoading ? "கணக்கிடுகிறது…" : "கணக்கிடு"}
                </button>
              </div>
            </div>

            {searchError ? (
              <p className={styles.inlineError}>{searchError}</p>
            ) : null}

            {searchResult ? (
              <div className={styles.searchSummary}>
                <p className={styles.inlineMeta}>
                  1960-01-01 முதல் {todayIso} வரை {searchResult.matchCount} தின பொருத்தங்கள் கிடைத்துள்ளன.
                </p>
                {searchResult.ranges.length > 0 ? (
                  <div className={styles.rangeList}>
                    {searchResult.ranges.map((range) => (
                      <span
                        key={`${range.startDateIst}-${range.endDateIst}`}
                        className={styles.rangeChip}
                      >
                        {range.startDateIst} முதல் {range.endDateIst}
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

      {data && marriageDerived && activeTab === "marriage" && (
        <div className={styles.trackerWrap}>
          <section className={styles.trackerSection}>
            <div className={styles.sectionHeader}>
              <h2>பிறப்பு ஜாதக ஆய்வு</h2>
              <p>3, 7, 11 பாவங்களில் உள்ள கிரகங்கள், பார்வைகள் மற்றும் அதிபதிகள்.</p>
            </div>

            <div className={styles.tableWrapCustom}>
              <table className={styles.analysisTable}>
                <thead>
                  <tr>
                    <th>பாவம்</th>
                    <th>ராசி</th>
                    <th>அந்த பாவத்தில் உள்ள கிரகங்கள்</th>
                    <th>அதிபதி</th>
                    <th>பார்க்கும் கிரகங்கள்</th>
                  </tr>
                </thead>
                <tbody>
                  {marriageDerived.analysisRows.map((row) => (
                    <tr key={row.houseNumber}>
                      <td>{HOUSE_LABEL_TAMIL[row.houseNumber]}</td>
                      <td>{RASI_TAMIL[row.rasi]}</td>
                      <td>{formatTamilPlanetList(row.occupants)}</td>
                      <td>{row.lordName}</td>
                      <td>{formatTamilPlanetList(row.aspectors)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.sectionHeader} style={{ marginTop: "1.25rem" }}>
              <h2>குரு மற்றும் சுக்கிரன் நிலை</h2>
              <p>இருவரின் இருப்பு, பார்வை மற்றும் 3, 7, 11 பாவங்களுடனான தொடர்பு.</p>
            </div>

            <div className={styles.tableWrapCustom}>
              <table className={styles.analysisTable}>
                <thead>
                  <tr>
                    <th>கிரகம்</th>
                    <th>ராசி</th>
                    <th>பாவம்</th>
                    <th>குறிப்புகள்</th>
                  </tr>
                </thead>
                <tbody>
                  {marriageDerived.guruSukraRows.map((row) => (
                    <tr key={row.planetId}>
                      <td>{row.label}</td>
                      <td>{RASI_TAMIL[row.rasi]}</td>
                      <td>{row.houseNumber}ஆம் பாவம்</td>
                      <td>{row.notes.join(" · ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.trackerSection}>
            <div className={styles.sectionHeader}>
              <h2>Permutation நிலை</h2>
              <p>3, 7, 11 பாவ அதிபதிகளின் 6 permutation-களும் நடந்ததா இல்லையா என்பதை காட்டும் அட்டவணை.</p>
            </div>

            <div className={styles.tableWrapCustom}>
              <table className={styles.analysisTable}>
                <thead>
                  <tr>
                    <th>Permutation</th>
                    <th>பாவ வரிசை</th>
                    <th>நிலை</th>
                    <th>தொடக்கம்</th>
                    <th>முடிவு</th>
                  </tr>
                </thead>
                <tbody>
                  {marriageDerived.permutationStatusRows.map((row) => (
                    <tr key={row.permutationLabel}>
                      <td>{row.permutationLabel}</td>
                      <td>
                        {row.houseOrder
                          .map((houseNumber) => HOUSE_LABEL_TAMIL[houseNumber])
                          .join(" → ")}
                      </td>
                      <td>{row.occurred ? "நடைந்துள்ளது" : "இன்னும் வரவில்லை"}</td>
                      <td>{row.firstMatch ? row.firstMatch.start : "—"}</td>
                      <td>{row.firstMatch?.end ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.trackerSection}>
            <div className={styles.sectionHeader}>
              <h2>தசை - புக்தி - அந்தரம் காலங்கள்</h2>
              <p>
                3, 7, 11 பாவ அதிபதிகள் மூன்றும் தசை, புக்தி, அந்தரம் வரிசையில் மாற்றி மாற்றி
                வந்த காலங்கள்.
              </p>
            </div>

            <div className={styles.tableWrapCustom}>
              <table className={styles.analysisTable}>
                <thead>
                  <tr>
                    <th>Permutation</th>
                    <th>தசை</th>
                    <th>புக்தி</th>
                    <th>அந்தரம்</th>
                    <th>பாவ வரிசை</th>
                    <th>தொடக்கம்</th>
                    <th>முடிவு</th>
                  </tr>
                </thead>
                <tbody>
                  {marriageDerived.timingRows.length ? (
                    marriageDerived.timingRows.map((row, index) => (
                      <tr key={`${row.start}-${index}`}>
                        <td>{row.permutationLabel}</td>
                        <td>{LORD_TAMIL[row.maha]}</td>
                        <td>{LORD_TAMIL[row.bhukti]}</td>
                        <td>{LORD_TAMIL[row.lord]}</td>
                        <td>
                          {row.houseOrder
                            .map((houseNumber) => HOUSE_LABEL_TAMIL[houseNumber])
                            .join(" → ")}
                        </td>
                        <td>{row.start}</td>
                        <td>{row.end ?? "—"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7}>இத்தகைய காலங்கள் இதுவரை இல்லை.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.trackerSection}>
            <div className={styles.sectionHeader}>
              <h2>கால தொடக்க ஜாதகங்கள்</h2>
              <p>ஒவ்வொரு பொருந்தும் காலத்தின் முதல் நாளுக்கான கோசார ஜாதகம். அதிகபட்சம் 10 மட்டும்.</p>
            </div>
            {marriageLoading ? (
              <p className={styles.inlineMeta}>ஜாதகங்கள் ஏற்றப்படுகிறது…</p>
            ) : marriageSnapshots.length > 0 ? (
              <div className={styles.resultGrid}>
                {marriageSnapshots.map((snapshot, index) => (
                  <section key={`${snapshot.dateIst}-${index}`} className={styles.resultCard}>
                    <h3>{snapshot.dateIst}</h3>
                    <p className={styles.inlineMeta}>{snapshot.timestampIst}</p>
                    <SouthIndianChart
                      planetsByRasi={positionsToPlanetsByRasi(snapshot.positions)}
                      ascendantRasi={data.birth.ascendantRasi}
                      title={snapshot.dateIst}
                      theme={theme}
                    />
                  </section>
                ))}
              </div>
            ) : (
              <p className={styles.inlineMeta}>காட்ட ஜாதகம் எதுவும் இல்லை.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
