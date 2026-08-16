"use client";

import { useEffect, useMemo, useState } from "react";
import { SouthIndianChart } from "@/components/SouthIndianChart/SouthIndianChart";
import { BirthInputForm } from "@/components/BirthInputForm";
import { BirthTimeIdentifier } from "@/components/BirthTimeIdentifier";
import { PlacePhotonField } from "@/components/PlacePhotonField";
import { PlanetaryTableTamil } from "@/components/tables/PlanetaryTableTamil";
import { DashaBhuktiTableTamil } from "@/components/tables/DashaBhuktiTableTamil";
import { VimsottariExpander } from "@/components/tables/VimsottariExpander";
import { houseOrdinal, lordName, rasiName } from "@/i18n/astro";
import { useTranslations } from "@/i18n/useTranslations";
import { formatMatchedRoles } from "@/lib/prediction/events/marriageLocale";
import {
  buildMarriagePrediction,
  collectMarriageBhavaReadings,
  collectMarriageKocharSampleDates,
  currentBhuktiWindow,
  listMarriageBhuktiWindows,
  overlayMoonKocharOnWindows,
} from "@/lib/prediction/events";
import type { MarriageBhuktiWindow, MarriagePrediction } from "@/lib/prediction/events";
import { isoDateKey } from "@/lib/isoDate";
import type { ChartDataPayload } from "@/types/chartData";
import styles from "./page.module.css";

type TrackerTab = "kundli" | "kochar" | "marriage" | "family" | "birthTime";

type HistoricalPositionsResponse = {
  dateIst: string;
  timestampIst?: string;
  timestampUtc?: string;
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
  conjuncts: string[];
  lordName: string;
};

type FamilyFormState = {
  name: string;
  birthDate: string;
  birthTime: string;
  placeName: string;
  lat: string;
  lng: string;
  loading: boolean;
  error: string | null;
  result: ChartDataPayload | null;
};

const RASI_ORDER = [
  "mesha",
  "rishabha",
  "mithuna",
  "karkata",
  "simha",
  "kanya",
  "tula",
  "vrischika",
  "dhanu",
  "makara",
  "kumbha",
  "meena",
] as const;

const PLANET_ORDER = [
  { value: "sun", id: 0 },
  { value: "moon", id: 1 },
  { value: "mars", id: 2 },
  { value: "mercury", id: 3 },
  { value: "guru", id: 4 },
  { value: "sukra", id: 5 },
  { value: "saturn", id: 6 },
  { value: "rahu", id: 7 },
  { value: "ketu", id: 8 },
] as const;

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

function rasiForHouse(ascendantRasi: number, houseNumber: number) {
  return (ascendantRasi + houseNumber - 1) % 12;
}

function formatPlanetList(values: string[], noneLabel: string) {
  return values.length ? values.join(", ") : noneLabel;
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await mapper(items[index]);
    }
  }
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

function marriageVerdictLabel(
  verdict: "strong" | "supportive" | "weak",
  t: (key: string) => string
) {
  if (verdict === "strong") return t("home.verdictStrong");
  if (verdict === "supportive") return t("home.verdictSupportive");
  return t("home.verdictWeak");
}

function parseDatePart(value: string) {
  return isoDateKey(value);
}

function latestStartedRow<T extends { start: string }>(rows: T[], selectedDate: string) {
  return [...rows]
    .filter((row) => parseDatePart(row.start) <= selectedDate)
    .sort((a, b) => a.start.localeCompare(b.start, "en", { numeric: true }))
    .at(-1) ?? null;
}

function moonRasiFromPlanets(planets: { planetId: number; rasi: number }[]) {
  return planets.find((planet) => planet.planetId === 1)?.rasi ?? null;
}

function housesOwnedByPlanet(ascendantRasi: number, planetId: number) {
  const houses: number[] = [];
  for (let house = 1; house <= 12; house++) {
    const rasi = rasiForHouse(ascendantRasi, house);
    if (SIGN_LORD[rasi] === planetId) {
      houses.push(house);
    }
  }
  return houses;
}

function createFamilyFormState(index: number): FamilyFormState {
  const defaults = [
    {
      name: "",
      birthDate: "1994-05-10",
      birthTime: "17:00",
      placeName: "Puducherry, IN",
      lat: "11.9416",
      lng: "79.8083",
    },
    {
      name: "",
      birthDate: "",
      birthTime: "",
      placeName: "",
      lat: "",
      lng: "",
    },
    {
      name: "",
      birthDate: "",
      birthTime: "",
      placeName: "",
      lat: "",
      lng: "",
    },
    {
      name: "",
      birthDate: "",
      birthTime: "",
      placeName: "",
      lat: "",
      lng: "",
    },
  ] as const;

  return {
    ...defaults[index],
    loading: false,
    error: null,
    result: null,
  };
}

export default function Home() {
  const { language, t, interpolate: ti } = useTranslations();
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
  const [marriageServerPrediction, setMarriageServerPrediction] =
    useState<MarriagePrediction | null>(null);
  const [todayIso, setTodayIso] = useState("2026-04-03");
  const [familyInsightDate, setFamilyInsightDate] = useState("2026-04-05");
  const [familyTransitSnapshot, setFamilyTransitSnapshot] =
    useState<HistoricalPositionsResponse | null>(null);
  const [familyTransitLoading, setFamilyTransitLoading] = useState(false);
  const [familyTransitError, setFamilyTransitError] = useState<string | null>(null);
  const [familyForms, setFamilyForms] = useState<FamilyFormState[]>(() =>
    Array.from({ length: 4 }, (_, index) => createFamilyFormState(index))
  );

  const theme = dark ? "dark" : "light";

  const rasiOptions = useMemo(
    () =>
      RASI_ORDER.map((value, index) => ({
        value,
        label: rasiName(language, index),
      })),
    [language]
  );

  const planetOptions = useMemo(
    () =>
      PLANET_ORDER.map(({ value, id }) => ({
        value,
        label: lordName(language, id),
      })),
    [language]
  );

  const marriageDerived = useMemo(() => {
    if (!data) return null;

    const planetLabel = (planet: { planetEn: string; planetTa: string }) =>
      language === "ta" ? planet.planetTa : planet.planetEn;

    const analysisRows: MarriageAnalysisRow[] = collectMarriageBhavaReadings(
      data
    ).map((reading) => ({
      houseNumber: reading.houseNumber,
      rasi: reading.signRasi,
      occupants: reading.occupants.map(planetLabel),
      conjuncts: reading.conjuncts.map(planetLabel),
      lordName: lordName(language, SIGN_LORD[reading.signRasi]),
    }));

    return {
      analysisRows,
      prediction: buildMarriagePrediction(data, language, todayIso),
    };
  }, [data, todayIso, language]);

  const overlayedMarriageWindows = useMemo((): MarriageBhuktiWindow[] => {
    if (marriageServerPrediction) {
      return marriageServerPrediction.periodSequence.windows;
    }
    if (!data || !marriageDerived) return [];
    const snapshotsByDate = new Map(
      marriageSnapshots.map((snapshot) => [
        isoDateKey(snapshot.dateIst),
        Object.values(snapshot.positions).map((planet) => ({
          planetId: planet.planetId,
          rasi: planet.rasi,
        })),
      ])
    );
    return overlayMoonKocharOnWindows(
      marriageDerived.prediction.periodSequence.windows,
      data.natalPlanets,
      snapshotsByDate,
      language
    );
  }, [data, language, marriageDerived, marriageServerPrediction, marriageSnapshots]);

  const currentMarriageBhukti = useMemo(() => {
    return currentBhuktiWindow(overlayedMarriageWindows, todayIso);
  }, [overlayedMarriageWindows, todayIso]);

  useEffect(() => {
    setTodayIso(new Date().toISOString().slice(0, 10));
    setFamilyInsightDate(new Date().toISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setFamilyTransitLoading(true);
    setFamilyTransitError(null);
    fetch(`/api/history/positions?date=${encodeURIComponent(familyInsightDate)}`)
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
          setFamilyTransitSnapshot(json);
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setFamilyTransitSnapshot(null);
          setFamilyTransitError(error.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setFamilyTransitLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [familyInsightDate]);

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
    if (!data) {
      setMarriageSnapshots([]);
      setMarriageServerPrediction(null);
      setMarriageLoading(false);
      return;
    }
    let cancelled = false;
    const chart = data;
    async function loadMarriageSky() {
      setMarriageLoading(true);
      try {
        const res = await fetch("/api/prediction/marriage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chart, language }),
        });
        const json = (await res.json()) as MarriagePrediction & {
          error?: string;
          startDateSnapshots?: HistoricalPositionsResponse[];
        };
        if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
        if (cancelled) return;
        setMarriageServerPrediction(json);
        setMarriageSnapshots(
          (json.startDateSnapshots ?? []).filter(
            (snapshot) => snapshot?.dateIst && snapshot.positions
          )
        );
      } catch {
        if (cancelled) return;
        setMarriageServerPrediction(null);
        const windows = listMarriageBhuktiWindows(chart, language);
        const uniqueDates = collectMarriageKocharSampleDates(windows);
        const snapshots = (
          await mapPool(uniqueDates, 6, async (dateOnly) => {
            try {
              const res = await fetch(
                `/api/history/positions?date=${encodeURIComponent(dateOnly)}`
              );
              const json = (await res.json()) as HistoricalPositionsResponse & {
                error?: string;
                detail?: string;
              };
              if (!res.ok) return null;
              return { ...json, dateIst: isoDateKey(json.dateIst) || dateOnly };
            } catch {
              return null;
            }
          })
        ).filter((item): item is HistoricalPositionsResponse => item !== null);
        if (!cancelled) setMarriageSnapshots(snapshots);
      } finally {
        if (!cancelled) setMarriageLoading(false);
      }
    }
    void loadMarriageSky();
    return () => {
      cancelled = true;
    };
  }, [data, language]);

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
      setSearchError(
        err instanceof Error ? err.message : t("home.searchFailed")
      );
    } finally {
      setSearchLoading(false);
    }
  }

  function updateFamilyForm(
    index: number,
    field: keyof Omit<FamilyFormState, "loading" | "error" | "result">,
    value: string
  ) {
    setFamilyForms((current) =>
      current.map((form, formIndex) =>
        formIndex === index ? { ...form, [field]: value } : form
      )
    );
  }

  function applyFamilyPlaceSelection(
    index: number,
    detail: { formattedAddress: string; lat: number; lng: number }
  ) {
    setFamilyForms((current) =>
      current.map((form, formIndex) =>
        formIndex === index
          ? {
              ...form,
              placeName: detail.formattedAddress,
              lat: detail.lat.toFixed(6),
              lng: detail.lng.toFixed(6),
            }
          : form
      )
    );
  }

  async function computeFamilyChart(index: number) {
    const form = familyForms[index];
    const [year, month, day] = form.birthDate.split("-").map(Number);
    const [hour, minute] = form.birthTime.split(":").map(Number);
    const lat = Number(form.lat);
    const lng = Number(form.lng);

    if (
      !form.birthDate ||
      !form.birthTime ||
      !form.placeName.trim() ||
      !Number.isFinite(year) ||
      !Number.isFinite(month) ||
      !Number.isFinite(day) ||
      !Number.isFinite(hour) ||
      !Number.isFinite(minute) ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      setFamilyForms((current) =>
        current.map((item, itemIndex) =>
          itemIndex === index
            ? { ...item, error: t("home.familyValidationError") }
            : item
        )
      );
      return;
    }

    setFamilyForms((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, loading: true, error: null }
          : item
      )
    );

    try {
      const tzRes = await fetch(
        `/api/timezone?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(
          String(lng)
        )}`
      );
      const tzJson = (await tzRes.json()) as { offsetHours?: number; error?: string };
      if (!tzRes.ok || typeof tzJson.offsetHours !== "number") {
        throw new Error(tzJson.error || t("home.timezoneFailed"));
      }

      const payload: Record<string, unknown> = {
        birth: {
          year,
          month,
          day,
          hour,
          minute,
          second: 0,
        },
        place: {
          name: form.placeName.trim(),
          lat,
          lng,
          tz: tzJson.offsetHours,
        },
        transit: null,
      };
      if (form.name.trim()) {
        payload.name = form.name.trim();
      }

      const res = await fetch("/api/horoscope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as ChartDataPayload & {
        error?: string;
        detail?: string;
      };
      if (!res.ok) {
        throw new Error(json.detail || json.error || `Request failed (${res.status})`);
      }

      setFamilyForms((current) =>
        current.map((item, itemIndex) =>
          itemIndex === index
            ? { ...item, loading: false, error: null, result: json }
            : item
        )
      );
    } catch (error) {
      setFamilyForms((current) =>
        current.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                loading: false,
                error:
                  error instanceof Error ? error.message : t("home.familyChartError"),
              }
            : item
        )
      );
    }
  }

  return (
    <div className={`${styles.page} ${dark ? styles.dark : ""}`}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <h1>{t("home.headerTitle")}</h1>
          <p>
            {t("home.headerIntroA")}
            <code>horoscope.py</code>
            {t("home.headerIntroB")}
            <code>public/chart-data.json</code>
            {t("home.headerIntroC")}
            <code>/api/horoscope</code>
            {t("home.headerIntroD")}
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
                ? ` · ${t("home.transitComputed")} ${data.transit.computedAt}`
                : null}
            </p>
          )}
        </div>
        <button
          type="button"
          className={styles.themeToggle}
          onClick={() => setDark((d) => !d)}
        >
          {dark ? t("home.themeLight") : t("home.themeDark")}
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
          {t("home.tabKundli")}
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === "kochar" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("kochar")}
        >
          {t("home.tabKochar")}
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === "marriage" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("marriage")}
        >
          {t("home.tabMarriage")}
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === "family" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("family")}
        >
          {t("home.tabFamily")}
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === "birthTime" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("birthTime")}
        >
          {t("home.tabBirthTime")}
        </button>
      </div>

      {apiError && (
        <p className={styles.apiError} role="alert">
          {apiError}
        </p>
      )}

      {loadError && (
        <p className={styles.loadError}>
          {t("home.loadErrorPrefix")} {loadError}. {t("home.loadErrorSuffix")}
        </p>
      )}

      {data && activeTab === "kundli" && (
        <>
          <div className={styles.charts}>
            <section className={styles.chartBlock}>
              <h2>{t("home.chartBirth")}</h2>
              <SouthIndianChart
                planetsByRasi={data.birth.planetsByRasi}
                ascendantRasi={data.birth.ascendantRasi}
                title={t("home.chartTitleBirth")}
                theme={theme}
              />
            </section>
            <section className={styles.chartBlock}>
              <h2>{t("home.chartTransit")}</h2>
              <SouthIndianChart
                planetsByRasi={data.transit.planetsByRasi}
                ascendantRasi={data.transit.ascendantRasi}
                title={t("home.chartTitleTransit")}
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

      {activeTab === "birthTime" && (
        <BirthTimeIdentifier
          dark={dark}
          seed={
            data?.meta
              ? {
                  dob: data.meta.dob,
                  tob: data.meta.tob,
                  place: data.meta.place,
                }
              : null
          }
        />
      )}

      {data && activeTab === "kochar" && (
        <div className={styles.trackerWrap}>
          <section className={styles.trackerSection}>
            <div className={styles.sectionHeader}>
              <h2>{t("home.kocharPart1Title")}</h2>
              <p>{t("home.kocharPart1Desc")}</p>
            </div>
            <div className={styles.trackerGrid}>
              <div className={styles.trackerPane}>
                <div className={styles.paneHead}>
                  <h3>{t("home.currentPositions")}</h3>
                  <p>
                    {data.transit.computedAt
                      ? `${data.transit.computedAt} ${t("home.transitAt")}`
                      : t("home.currentTransitData")}
                  </p>
                </div>
                <SouthIndianChart
                  planetsByRasi={data.transit.planetsByRasi}
                  ascendantRasi={data.transit.ascendantRasi}
                  title={t("home.chartTitleTransit")}
                  theme={theme}
                />
              </div>

              <div className={styles.trackerPane}>
                <div className={styles.paneHead}>
                  <h3>{t("home.selectedDatePositions")}</h3>
                  <label className={styles.dateField}>
                    <span>{t("home.dateLabel")}</span>
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
                  <p className={styles.inlineMeta}>{t("home.loadingChart")}</p>
                ) : trackerSnapshot ? (
                  <>
                    <p className={styles.inlineMeta}>
                      {t("home.snapshotTime")} {trackerSnapshot.timestampIst}
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
              <h2>{t("home.kocharPart2Title")}</h2>
              <p>{t("home.kocharPart2Desc")}</p>
            </div>

            <div className={styles.searchControls}>
              <label className={styles.fieldBlock}>
                <span>{t("home.planetsLabel")}</span>
                <select
                  multiple
                  value={selectedPlanets}
                  onChange={(e) =>
                    setSelectedPlanets(
                      Array.from(e.target.selectedOptions, (option) => option.value)
                    )
                  }
                >
                  {planetOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.fieldBlock}>
                <span>{t("home.signLabel")}</span>
                <select
                  value={selectedRasi}
                  onChange={(e) => setSelectedRasi(e.target.value)}
                >
                  <option value="">{t("home.signPlaceholder")}</option>
                  {rasiOptions.map((option) => (
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
                  {searchLoading ? t("home.computing") : t("home.compute")}
                </button>
              </div>
            </div>

            {searchError ? (
              <p className={styles.inlineError}>{searchError}</p>
            ) : null}

            {searchResult ? (
              <div className={styles.searchSummary}>
                <p className={styles.inlineMeta}>
                  {ti("home.matchesSummary", {
                    end: todayIso,
                    count: searchResult.matchCount,
                  })}
                </p>
                {searchResult.ranges.length > 0 ? (
                  <div className={styles.rangeList}>
                    {searchResult.ranges.map((range) => (
                      <span
                        key={`${range.startDateIst}-${range.endDateIst}`}
                        className={styles.rangeChip}
                      >
                        {ti("home.rangeFromTo", {
                          start: range.startDateIst,
                          end: range.endDateIst,
                        })}
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
              <h2>{t("home.marriageAssessmentTitle")}</h2>
              <p>{t("home.marriageAssessmentDesc")}</p>
            </div>
            <p className={styles.inlineMeta}>
              {(marriageServerPrediction ?? marriageDerived.prediction).overview.summary}
            </p>
            <div className={styles.marriageScoreRow}>
              <div className={styles.marriageScoreCard}>
                <span className={styles.scoreLabel}>
                  {t("home.marriageStrength")}
                </span>
                <strong>
                  {marriageDerived.prediction.overview.marriageStrengthScore}
                </strong>
              </div>
              <div className={styles.marriageScoreCard}>
                <span className={styles.scoreLabel}>
                  {t("home.marriageActivation")}
                </span>
                <strong>
                  {marriageLoading
                    ? "…"
                    : currentMarriageBhukti
                      ? currentMarriageBhukti.score
                      : "—"}
                </strong>
              </div>
              <div className={styles.marriageScoreCard}>
                <span className={styles.scoreLabel}>{t("home.guruKochar")}</span>
                <strong>
                  {marriageLoading
                    ? t("home.loadingKochar")
                    : currentMarriageBhukti?.kocharHits?.some(
                          (hit) => hit.role === "guru" && hit.weight > 0
                        )
                      ? t("home.guruTriggerYes")
                      : t("home.guruTriggerNo")}
                </strong>
                {currentMarriageBhukti?.kocharApplied ? (
                  <p className={styles.inlineMeta}>
                    {t("home.kocharScore")}: {currentMarriageBhukti.kocharScore}
                  </p>
                ) : null}
              </div>
            </div>
            {currentMarriageBhukti?.kocharHits?.filter((hit) => hit.weight > 0)
              .length ? (
              <p className={styles.inlineMeta}>
                {currentMarriageBhukti.kocharHits
                  .filter((hit) => hit.weight > 0)
                  .slice(0, 4)
                  .map((hit) => hit.note)
                  .join(" · ")}
              </p>
            ) : null}
            {currentMarriageBhukti ? (
              <p className={styles.inlineMeta}>
                <strong>{t("home.currentPeriodHeading")}:</strong>{" "}
                {lordName(language, currentMarriageBhukti.maha)} /{" "}
                {lordName(language, currentMarriageBhukti.bhukti)} ·{" "}
                {isoDateKey(currentMarriageBhukti.start)}
                {currentMarriageBhukti.end
                  ? ` – ${isoDateKey(currentMarriageBhukti.end)}`
                  : ""}{" "}
                · {t("home.scoreLabel")} {currentMarriageBhukti.score} ·{" "}
                {marriageVerdictLabel(currentMarriageBhukti.verdict, t)}
                {currentMarriageBhukti.matchedRoles.length
                  ? ` · ${formatMatchedRoles(
                      language,
                      currentMarriageBhukti.matchedRoles
                    )}`
                  : ""}
              </p>
            ) : (
              <p className={styles.inlineMeta}>{t("home.noCurrentPeriod")}</p>
            )}
          </section>

          <section className={styles.trackerSection}>
            <div className={styles.sectionHeader}>
              <h2>{t("home.marriageBirthTitle")}</h2>
              <p>{t("home.marriageBirthDesc")}</p>
            </div>

            <div className={styles.tableWrapCustom}>
              <table className={`${styles.analysisTable} ${styles.responsiveTable}`}>
                <thead>
                  <tr>
                    <th>{t("home.thHouse")}</th>
                    <th>{t("home.thSign")}</th>
                    <th>{t("home.thBhavaOccupants")}</th>
                    <th>{t("home.thConjuncts")}</th>
                    <th>{t("home.thLord")}</th>
                  </tr>
                </thead>
                <tbody>
                  {marriageDerived.analysisRows.map((row) => (
                    <tr key={row.houseNumber}>
                      <td data-label={t("home.thHouse")}>
                        {houseOrdinal(language, row.houseNumber)}
                      </td>
                      <td data-label={t("home.thSign")}>{rasiName(language, row.rasi)}</td>
                      <td data-label={t("home.thBhavaOccupants")}>
                        {formatPlanetList(row.occupants, t("home.noneList"))}
                      </td>
                      <td data-label={t("home.thConjuncts")}>
                        {formatPlanetList(row.conjuncts, t("home.noneList"))}
                      </td>
                      <td data-label={t("home.thLord")}>{row.lordName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.trackerSection}>
            <div className={styles.sectionHeader}>
              <h2>{t("home.dashaPeriodsTitle")}</h2>
              <p>{t("home.dashaPeriodsDesc")}</p>
            </div>

            {marriageLoading ? (
              <p className={styles.inlineMeta}>{t("home.loadingKochar")}</p>
            ) : (
            <div className={styles.tableWrapCustom}>
              <table className={`${styles.analysisTable} ${styles.responsiveTable}`}>
                <thead>
                  <tr>
                    <th>{t("home.thRoles")}</th>
                    <th>{t("home.mahadasha")}</th>
                    <th>{t("home.bhukti")}</th>
                    <th>{t("home.scoreLabel")}</th>
                    <th>{t("home.thKochar")}</th>
                    <th>{t("home.thStatus")}</th>
                    <th>{t("home.thStart")}</th>
                    <th>{t("home.thEnd")}</th>
                  </tr>
                </thead>
                <tbody>
                  {overlayedMarriageWindows.length ? (
                    overlayedMarriageWindows.map(
                      (row, index) => (
                        <tr key={`${row.start}-${row.maha}-${row.bhukti}-${index}`}>
                          <td data-label={t("home.thRoles")}>
                            {row.matchedRoles.length
                              ? formatMatchedRoles(language, row.matchedRoles)
                              : t("home.noMarriageRoles")}
                          </td>
                          <td data-label={t("home.mahadasha")}>{lordName(language, row.maha)}</td>
                          <td data-label={t("home.bhukti")}>{lordName(language, row.bhukti)}</td>
                          <td data-label={t("home.scoreLabel")}>
                            {row.score} · {marriageVerdictLabel(row.verdict, t)}
                            {row.kocharApplied
                              ? ` (${row.dashaScore}+${row.kocharScore})`
                              : ""}
                          </td>
                          <td data-label={t("home.thKochar")}>
                            {row.kocharApplied
                              ? row.kocharHits?.filter((hit) => hit.weight > 0)
                                  .length
                                ? row.kocharHits
                                    .filter((hit) => hit.weight > 0)
                                    .slice(0, 3)
                                    .map((hit) => hit.note)
                                    .join(" · ")
                                : t("home.kocharNone")
                              : t("home.kocharUnavailable")}
                          </td>
                          <td data-label={t("home.thStatus")}>
                            {currentMarriageBhukti &&
                            currentMarriageBhukti.start === row.start &&
                            currentMarriageBhukti.maha === row.maha &&
                            currentMarriageBhukti.bhukti === row.bhukti
                              ? t("home.currentPeriodHeading")
                              : isoDateKey(row.start) <= todayIso
                                ? t("home.statusOccurred")
                                : t("home.statusUpcoming")}
                          </td>
                          <td data-label={t("home.thStart")}>{row.start}</td>
                          <td data-label={t("home.thEnd")}>{row.end ?? "—"}</td>
                        </tr>
                      )
                    )
                  ) : (
                    <tr>
                      <td colSpan={8}>{t("home.noSuchPeriods")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            )}
          </section>

          <section className={styles.trackerSection}>
            <div className={styles.sectionHeader}>
              <h2>{t("home.snapshotChartsTitle")}</h2>
              <p>{t("home.snapshotChartsDesc")}</p>
            </div>
            {marriageLoading ? (
              <p className={styles.inlineMeta}>{t("home.loadingCharts")}</p>
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
              <p className={styles.inlineMeta}>{t("home.noChartsToShow")}</p>
            )}
          </section>
        </div>
      )}

      {activeTab === "family" && (
        <div className={styles.familyWrap}>
          <section className={styles.trackerSection}>
            <div className={styles.sectionHeader}>
              <h2>{t("home.familyInputsTitle")}</h2>
              <p>{t("home.familyInputsDesc")}</p>
            </div>
            <div className={styles.familyGrid}>
              {familyForms.map((form, index) => (
                <div key={`family-form-${index}`} className={styles.familyCard}>
                  <h3>{ti("home.profileN", { n: index + 1 })}</h3>
                  <div className={styles.familyFields}>
                    <label className={styles.fieldBlock}>
                      <span>{t("home.name")}</span>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => updateFamilyForm(index, "name", e.target.value)}
                      />
                    </label>
                    <label className={styles.fieldBlock}>
                      <span>{t("home.birthDate")}</span>
                      <input
                        type="date"
                        value={form.birthDate}
                        onChange={(e) =>
                          updateFamilyForm(index, "birthDate", e.target.value)
                        }
                      />
                    </label>
                    <label className={styles.fieldBlock}>
                      <span>{t("home.birthTime")}</span>
                      <input
                        type="time"
                        value={form.birthTime}
                        onChange={(e) =>
                          updateFamilyForm(index, "birthTime", e.target.value)
                        }
                      />
                    </label>
                    <PlacePhotonField
                      label={t("home.placeName")}
                      className={styles.fieldBlock}
                      syncValue={form.placeName}
                      onPlaceSelected={(detail) =>
                        applyFamilyPlaceSelection(index, detail)
                      }
                      dark={dark}
                    />
                    <label className={styles.fieldBlock}>
                      <span>{t("home.latitude")}</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={form.lat}
                        onChange={(e) => updateFamilyForm(index, "lat", e.target.value)}
                      />
                    </label>
                    <label className={styles.fieldBlock}>
                      <span>{t("home.longitude")}</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={form.lng}
                        onChange={(e) => updateFamilyForm(index, "lng", e.target.value)}
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    className={styles.computeBtn}
                    disabled={form.loading}
                    onClick={() => void computeFamilyChart(index)}
                  >
                    {form.loading ? t("home.computingProfile") : t("home.computeProfile")}
                  </button>
                  {form.error ? (
                    <p className={styles.inlineError}>{form.error}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className={styles.trackerSection}>
            <div className={styles.sectionHeader}>
              <h2>{t("home.familyOutputsTitle")}</h2>
              <p>{t("home.familyOutputsDesc")}</p>
            </div>
            <div className={styles.familyDateBar}>
              <label className={styles.dateField}>
                <span>{t("home.selectedDate")}</span>
                <input
                  type="date"
                  value={familyInsightDate}
                  onChange={(e) => setFamilyInsightDate(e.target.value)}
                  max={todayIso}
                />
              </label>
              <p className={styles.inlineMeta}>{t("home.familyDateHint")}</p>
            </div>
            <div className={styles.familyGrid}>
              {familyForms.map((form, index) => (
                <div key={`family-result-${index}`} className={styles.familyCard}>
                  <h3>
                    {form.result?.meta.name ||
                      form.name ||
                      ti("home.profileN", { n: index + 1 })}
                  </h3>
                  {form.result ? (
                    <div className={styles.familyResultStack}>
                      <div>
                        <p className={styles.inlineMeta}>
                          {form.result.meta.dob} · {form.result.meta.tob} ·{" "}
                          {form.result.meta.place}
                        </p>
                        <SouthIndianChart
                          planetsByRasi={form.result.birth.planetsByRasi}
                          ascendantRasi={form.result.birth.ascendantRasi}
                          title={t("home.chartTitleBirth")}
                          theme={theme}
                        />
                      </div>
                      <div className={styles.familyModule}>
                        <h4>{t("home.dateSnapshot")}</h4>
                        {(() => {
                          const currentMaha = latestStartedRow(
                            form.result.vimsottari.mahadasha,
                            familyInsightDate
                          );
                          const currentBhukti = latestStartedRow(
                            form.result.vimsottari.bhukti,
                            familyInsightDate
                          );
                          const currentAntara = latestStartedRow(
                            form.result.vimsottari.antara,
                            familyInsightDate
                          );
                          const ascendant = form.result.birth.ascendantRasi;
                          const impactedHouseText = (planetId: number | undefined) => {
                            if (planetId == null) return "—";
                            const houses = housesOwnedByPlanet(ascendant, planetId);
                            return houses.length
                              ? houses
                                  .map((house) => houseOrdinal(language, house))
                                  .join(", ")
                              : "—";
                          };
                          return (
                            <div className={styles.timelineList}>
                              <div className={styles.timelineRow}>
                                <strong>
                                  {t("home.mahadasha")}:{" "}
                                  {currentMaha
                                    ? lordName(language, currentMaha.lord)
                                    : "—"}
                                </strong>
                                <span>
                                  {currentMaha
                                    ? `${currentMaha.start} → ${currentMaha.end ?? "—"}`
                                    : t("home.noDataForDate")}
                                </span>
                                <span>
                                  {t("home.housesImpacted")}:{" "}
                                  {impactedHouseText(currentMaha?.lord)}
                                </span>
                              </div>
                              <div className={styles.timelineRow}>
                                <strong>
                                  {t("home.bhukti")}:{" "}
                                  {currentBhukti
                                    ? lordName(language, currentBhukti.lord)
                                    : "—"}
                                </strong>
                                <span>
                                  {currentBhukti
                                    ? `${currentBhukti.start} → ${currentBhukti.end ?? "—"}`
                                    : t("home.noDataForDate")}
                                </span>
                                <span>
                                  {t("home.housesImpacted")}:{" "}
                                  {impactedHouseText(currentBhukti?.lord)}
                                </span>
                              </div>
                              <div className={styles.timelineRow}>
                                <strong>
                                  {t("home.antara")}:{" "}
                                  {currentAntara
                                    ? lordName(language, currentAntara.lord)
                                    : "—"}
                                </strong>
                                <span>
                                  {currentAntara
                                    ? `${currentAntara.start} → ${currentAntara.end ?? "—"}`
                                    : t("home.noDataForDate")}
                                </span>
                                <span>
                                  {t("home.housesImpacted")}:{" "}
                                  {impactedHouseText(currentAntara?.lord)}
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                      <div className={styles.familyModule}>
                        <h4>{t("home.kocharSection")}</h4>
                        <p className={styles.inlineMeta}>{t("home.kocharHint")}</p>
                        {familyTransitError ? (
                          <p className={styles.inlineError}>{familyTransitError}</p>
                        ) : familyTransitLoading || !familyTransitSnapshot ? (
                          <p className={styles.inlineMeta}>{t("home.loadingTransit")}</p>
                        ) : (
                          <SouthIndianChart
                            planetsByRasi={positionsToPlanetsByRasi(
                              familyTransitSnapshot.positions
                            )}
                            ascendantRasi={form.result.birth.ascendantRasi}
                            highlightedRasis={
                              moonRasiFromPlanets(form.result.natalPlanets) != null
                                ? [moonRasiFromPlanets(form.result.natalPlanets) as number]
                                : []
                            }
                            title={familyInsightDate}
                            theme={theme}
                          />
                        )}
                      </div>
                      <VimsottariExpander
                        mahas={form.result.vimsottari.mahadasha}
                        bhukti={form.result.vimsottari.bhukti}
                        antara={form.result.vimsottari.antara}
                        sookshma={form.result.vimsottari.sookshma}
                        labels={form.result.vimsottari.labelsTa}
                        dark={dark}
                      />
                    </div>
                  ) : (
                    <p className={styles.inlineMeta}>{t("home.computePrompt")}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
