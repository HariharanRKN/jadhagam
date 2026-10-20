"use client";

import { useEffect, useMemo, useState } from "react";
import { SouthIndianChart } from "@/components/SouthIndianChart/SouthIndianChart";
import { getPlanetChipLabel } from "@/components/SouthIndianChart/chartConfig";
import { houseOrdinal, lordName, rasiName } from "@/i18n/astro";
import { useTranslations } from "@/i18n/useTranslations";
import { collectKocharFlags, type KocharFlag } from "@/lib/antara/flags";
import { buildPeriodImpact, type HouseLink, type LordImpact } from "@/lib/antara/impact";
import { houseFromNatalMoon, moonSignReadout } from "@/lib/antara/moonHouses";
import { relateLords, type LordRelation, type NaturalRelation, type PlacementTone } from "@/lib/antara/lordRelations";
import {
  addIsoDays,
  calendarDuration,
  childAntaras,
  childBhuktis,
  clampIsoDate,
  daysBetween,
  defaultDateStep,
  durationSegments,
  initialSelectedDate,
  periodKey,
  periodTiming,
  snapOffset,
  sookshmaStrip,
  stepDays,
  stepSibling,
  type DateStep,
  type DurationUnit,
  type OpenPeriod,
  type PeriodLevel,
} from "@/lib/antara/period";
import { detectSignChanges, markerShowsRetro, signedLongitudeDelta, type SignChange } from "@/lib/antara/signChanges";
import type { SkyDay, SkyPlanet, SkyRangeResponse } from "@/lib/antara/sky";
import { isoDateKey } from "@/lib/isoDate";
import {
  stringifyKundaliShareJson,
  type AntaraShareDetail,
} from "@/lib/kundaliExport";
import { nakshatraFromLongitude } from "@/lib/natalLagna";
import { karakaAreaLabel } from "@/lib/prediction/house-analysis/locale";
import { lordEnglish } from "@/lib/tamilDasha";
import type { ChartDataPayload } from "@/types/chartData";
import styles from "./AntaraDetail.module.css";

type Props = {
  chart: ChartDataPayload;
  period: OpenPeriod;
  dark?: boolean;
  onClose: () => void;
  onPeriodChange: (period: OpenPeriod) => void;
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function formatDay(iso: string, language: "en" | "ta") {
  const [year, month, day] = isoDateKey(iso).split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Intl.DateTimeFormat(language === "ta" ? "ta-IN" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatMonth(iso: string, language: "en" | "ta") {
  const [year, month] = isoDateKey(iso).split("-").map(Number);
  if (!year || !month) return iso;
  return new Intl.DateTimeFormat(language === "ta" ? "ta-IN" : "en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function planetsByRasi(positions: Record<string, SkyPlanet>) {
  const grouped: Record<string, string[]> = {};
  for (const planet of Object.values(positions)) {
    const key = String(planet.rasi);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(planet.planetEn);
  }
  return grouped;
}

function retrogradeNames(days: SkyDay[], date: string): string[] {
  const index = days.findIndex((day) => day.dateIst === date);
  const current = index >= 0 ? days[index] : null;
  if (!current) return ["Rahu", "Ketu"];
  const previous = index > 0 ? days[index - 1] : null;
  const names: string[] = [];
  for (const planet of Object.values(current.positions)) {
    if (planet.planetId === 7 || planet.planetId === 8) {
      names.push(planet.planetEn);
      continue;
    }
    const before = previous
      ? Object.values(previous.positions).find((item) => item.planetId === planet.planetId)
      : null;
    if (!before) continue;
    if (signedLongitudeDelta(before.totalLongitude, planet.totalLongitude) < 0) {
      names.push(planet.planetEn);
    }
  }
  return names;
}

const MARKER_CLASS: Record<number, string> = {
  4: styles.markerGu,
  6: styles.markerSa,
  7: styles.markerRa,
  8: styles.markerKe,
};

export function AntaraDetail({ chart, period, dark, onClose, onPeriodChange }: Props) {
  const { t, language, interpolate: ti } = useTranslations();
  const lang = language === "ta" ? "ta" : "en";
  const start = isoDateKey(period.start);
  const end = period.end ? isoDateKey(period.end) : start;
  const [step, setStep] = useState<DateStep>(() => defaultDateStep(start, end));
  const [selected, setSelected] = useState(() => initialSelectedDate(start, end, todayKey()));
  const [mode, setMode] = useState<"natal" | "kochar">("kochar");
  const [highlight, setHighlight] = useState<number | null>(null);
  const [days, setDays] = useState<SkyDay[]>([]);
  const [focusDay, setFocusDay] = useState<SkyDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState(false);
  const [coverageEnd, setCoverageEnd] = useState<string | null>(null);

  const prev = stepSibling(chart, period, -1);
  const next = stepSibling(chart, period, 1);
  const span = Math.max(0, daysBetween(start, end));
  const offset = Math.max(0, Math.min(span, daysBetween(start, selected)));
  const percent = span === 0 ? 0 : (offset / span) * 100;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    const narrow = window.matchMedia("(max-width: 800px)").matches;
    if (narrow) document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  useEffect(() => {
    const from = isoDateKey(period.start);
    const to = period.end ? isoDateKey(period.end) : from;
    const focus = initialSelectedDate(from, period.end, todayKey());
    const controller = new AbortController();
    fetch(
      `/api/history/positions?start=${encodeURIComponent(from)}&end=${encodeURIComponent(to)}&focus=${encodeURIComponent(focus)}`,
      { signal: controller.signal }
    )
      .then(async (response) => {
        const json = (await response.json()) as SkyRangeResponse & { error?: string };
        if (!response.ok) throw new Error(json.error || t("antara.skyError"));
        return json;
      })
      .then((json) => {
        setDays(json.days ?? []);
        setPartial(Boolean(json.partial));
        setCoverageEnd(json.coverageEnd ?? null);
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : t("antara.skyError"));
        setLoading(false);
      });
    return () => controller.abort();
  }, [period.start, period.end, period.level, period.mahaLord, period.bhuktiLord, period.antaraLord, t]);

  useEffect(() => {
    if (loading || days.some((day) => day.dateIst === selected)) return;
    const controller = new AbortController();
    fetch(`/api/history/positions?date=${encodeURIComponent(selected)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const json = (await response.json()) as {
          dateIst?: string;
          positions?: SkyDay["positions"];
        };
        if (!response.ok || !json.positions) return;
        setFocusDay({
          dateIst: isoDateKey(json.dateIst) || selected,
          positions: json.positions,
        });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [selected, days, loading]);

  const selectedDay = useMemo(() => {
    const exact = days.find((day) => day.dateIst === selected);
    if (exact) return exact;
    if (focusDay?.dateIst === selected) return focusDay;
    const earlier = [...days].reverse().find((day) => day.dateIst <= selected);
    return earlier ?? null;
  }, [days, focusDay, selected]);

  const lordInputs = useMemo(() => {
    const list: Array<{ role: PeriodLevel; planetId: number }> = [
      { role: "maha", planetId: period.mahaLord },
    ];
    if (period.bhuktiLord != null) list.push({ role: "bhukti", planetId: period.bhuktiLord });
    if (period.antaraLord != null) list.push({ role: "antara", planetId: period.antaraLord });
    return list;
  }, [period.antaraLord, period.bhuktiLord, period.mahaLord]);

  const impact = useMemo(
    () => buildPeriodImpact(chart, lordInputs, lang),
    [chart, lang, lordInputs]
  );

  const moonRasi = chart.natalPlanets.find((planet) => planet.planetId === 1)?.rasi ?? null;

  const changes = useMemo(() => {
    const samples = days.flatMap((day) =>
      Object.values(day.positions)
        .filter((planet) => planet.planetId === 4 || planet.planetId === 6 || planet.planetId === 7 || planet.planetId === 8)
        .map((planet) => ({
          date: day.dateIst,
          planetId: planet.planetId,
          rasi: planet.rasi,
          longitude: planet.totalLongitude,
        }))
    );
    return detectSignChanges(samples);
  }, [days]);

  const flags = useMemo(() => {
    if (moonRasi == null) return [];
    return collectKocharFlags(
      days.map((day) => ({
        date: day.dateIst,
        positions: Object.values(day.positions).map((planet) => ({
          planetId: planet.planetId,
          rasi: planet.rasi,
        })),
      })),
      moonRasi,
      impact.lords.map((lord) => ({ planetId: lord.planetId, rasi: lord.rasi })),
      selected
    );
  }, [days, impact.lords, moonRasi, selected]);

  const moon = useMemo(() => {
    if (moonRasi == null) return null;
    const samples = days.flatMap((day) => {
      const planet = Object.values(day.positions).find((item) => item.planetId === 1);
      return planet ? [{ date: day.dateIst, rasi: planet.rasi }] : [];
    });
    const readout = moonSignReadout(samples, selected);
    const rasi =
      readout.rasi ??
      (selectedDay
        ? Object.values(selectedDay.positions).find((planet) => planet.planetId === 1)?.rasi ?? null
        : null);
    return { rasi, nextChangeDate: readout.nextChangeDate };
  }, [days, moonRasi, selected, selectedDay]);

  function togglePlanet(planetId: number) {
    setHighlight((current) => (current === planetId ? null : planetId));
  }

  function chooseDate(date: string) {
    setSelected(clampIsoDate(date, start, end));
  }

  function chooseStep(nextStep: DateStep) {
    setStep(nextStep);
    chooseDate(addIsoDays(start, snapOffset(offset, span, nextStep)));
  }

  const duration = calendarDuration(start, end);
  const durationText = durationSegments(duration)
    .map((part) => ti(durationKey(part.unit, part.count), { count: part.count }))
    .join(" ");
  const timing = periodTiming(start, end, todayKey());
  const timingClass =
    timing === "current" ? styles.pillCurrent : timing === "upcoming" ? styles.pillUpcoming : styles.pillPast;

  const primary = impact.lords.find((lord) => lord.role === period.level) ?? impact.lords.at(-1) ?? null;
  const summary = primary ? summaryLine(primary, lang, t, ti) : "";
  const levelWord =
    period.level === "maha"
      ? t("antara.levelMaha")
      : period.level === "bhukti"
        ? t("antara.levelBhukti")
        : t("antara.levelAntara");

  const highlightName = highlight == null ? null : lordEnglish(highlight);
  const emphasis = useMemo(() => {
    if (highlight == null) return [];
    if (mode === "natal") {
      const row = chart.natalPlanets.find((planet) => planet.planetId === highlight);
      return row ? [row.rasi] : [];
    }
    if (!selectedDay) return [];
    const planet = Object.values(selectedDay.positions).find((item) => item.planetId === highlight);
    return planet ? [planet.rasi] : [];
  }, [chart.natalPlanets, highlight, mode, selectedDay]);

  const natalMarks =
    mode === "kochar"
      ? impact.lords.map((lord) => ({
          rasi: lord.rasi,
          label: `${t("antara.natalShort")} ${getPlanetChipLabel(lang, lordEnglish(lord.planetId))}`,
        }))
      : [];

  const children = period.level === "maha" ? childBhuktis(chart, period) : childAntaras(chart, period);
  const sookshmas = sookshmaStrip(chart, period);
  const today = todayKey();
  const todayInside = today >= start && today <= end;

  function flagText(flag: KocharFlag) {
    const scope = flag.scope === "period" ? t("antara.wholePeriod") : t("antara.onThisDate");
    let label = "";
    if (flag.code === "sadeSati") label = t("antara.flagSadeSati");
    else if (flag.code === "ashtamaSani") label = t("antara.flagAshtama");
    else if (flag.code === "ardhashtamaSani") label = t("antara.flagArdha");
    else if (flag.code === "guruOverMoon") label = t("antara.flagGuruOverMoon");
    else if (flag.code === "guruAspectsMoon") label = t("antara.flagGuruAspectsMoon");
    else if (flag.code === "guruOverSeventh") label = t("antara.flagGuruOverSeventh");
    else if (flag.code === "guruAspectsSeventh") label = t("antara.flagGuruAspectsSeventh");
    else if (flag.transitPlanetId != null && flag.natalPlanetId != null) {
      label = ti("antara.flagOverLord", {
        transit: lordName(lang, flag.transitPlanetId),
        lord: lordName(lang, flag.natalPlanetId),
      });
    }
    return `${label} · ${scope}`;
  }

  function exportPeriod() {
    const detail: AntaraShareDetail = {
      level: period.level,
      from: start,
      to: period.end,
      state: timing,
      lords: impact.lords.map((lord) => ({
        role: lord.role,
        planet: lordEnglish(lord.planetId),
        rasi: rasiName("en", lord.rasi),
        houseFromLagna: lord.houseFromAsc,
        dignity: lord.dignity,
        strength: lord.strength,
        ruledHouses: lord.ruledHouses,
        actsFor: lord.actsForPlanetId == null ? null : lordEnglish(lord.actsForPlanetId),
      })),
      houseLinks: impact.houses.map((house) => ({
        house: house.house,
        sign: rasiName("en", house.signRasi),
        adhipathi: lordEnglish(house.adhipathiId),
        karakas: house.karakas.map((karaka) => lordEnglish(karaka.planetId)),
      })),
      highlights: flags.map(flagText),
      slowPlanetChanges: changes.map((change) => ({
        planet: lordEnglish(change.planetId),
        date: change.date,
        fromSign: rasiName("en", change.fromRasi),
        toSign: rasiName("en", change.toRasi),
        retro: change.direction === "retro",
        reentry: change.reentry,
      })),
    };
    const blob = new Blob([stringifyKundaliShareJson(chart, detail)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `antara-${start}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const chain = [
    { id: period.mahaLord, level: "maha" as const },
    ...(period.bhuktiLord != null ? [{ id: period.bhuktiLord, level: "bhukti" as const }] : []),
    ...(period.antaraLord != null ? [{ id: period.antaraLord, level: "antara" as const }] : []),
  ];

  return (
    <>
      <button type="button" className={styles.backdrop} aria-label={t("antara.close")} onClick={onClose} />
      <aside
        className={`${styles.panel} ${dark ? styles.panelDark : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={levelWord}
        data-testid="antara-detail"
      >
        <div className={styles.header}>
          <div className={styles.grab} />
          <div className={styles.top}>
            <div className={styles.chain}>
              {chain.map((part, index) => (
                <span key={`${part.level}-${part.id}`}>
                  {index > 0 ? " › " : ""}
                  {part.level === period.level ? <b>{lordName(lang, part.id)}</b> : lordName(lang, part.id)}
                </span>
              ))}{" "}
              {levelWord}
            </div>
            <div className={styles.nav}>
              <button type="button" className={styles.iconBtn} aria-label={t("antara.prevPeriod")} disabled={!prev} onClick={() => prev && onPeriodChange(prev)}>
                ‹
              </button>
              <button type="button" className={styles.iconBtn} aria-label={t("antara.nextPeriod")} disabled={!next} onClick={() => next && onPeriodChange(next)}>
                ›
              </button>
              <button type="button" className={styles.iconBtn} aria-label={t("antara.close")} onClick={onClose}>
                ×
              </button>
            </div>
          </div>
          <div className={styles.meta}>
            {formatDay(start, lang)} – {formatDay(end, lang)} · {durationText}
            <span className={`${styles.pill} ${timingClass}`}>{t(`antara.${timing}`)}</span>
          </div>
          <div className={styles.progress}>
            <i style={{ width: `${percent}%` }} />
          </div>
        </div>

        {summary ? <div className={styles.summary}>{summary}</div> : null}

        {children.length ? (
          <div className={styles.childPeriods} data-testid="antara-children">
            <h3 className={styles.childLabel}>
              {period.level === "maha" ? t("antara.bhuktisInMaha") : t("antara.antarasInBhukti")}
            </h3>
            <div
              className={styles.strip}
              aria-label={period.level === "maha" ? t("antara.bhuktisInMaha") : t("antara.antarasInBhukti")}
            >
              {children.map((child) => {
                const lordId =
                  child.level === "bhukti"
                    ? child.bhuktiLord ?? child.mahaLord
                    : child.antaraLord ?? child.mahaLord;
                return (
                  <button
                    key={periodKey(child)}
                    type="button"
                    className={`${styles.stripBtn} ${periodKey(child) === periodKey(period) ? styles.stripBtnOn : ""}`}
                    onClick={() => onPeriodChange(child)}
                  >
                    {lordName(lang, lordId)} · {formatMonth(child.start, lang)}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <section className={styles.section}>
          <h3>{t("antara.impacting")}</h3>
          <div className={styles.lords}>
            {impact.lords.map((lord) => (
              <button
                key={lord.role}
                type="button"
                className={`${styles.lord} ${highlight === lord.planetId ? styles.lordOn : ""}`}
                onClick={() => togglePlanet(lord.planetId)}
              >
                <div className={styles.lordK}>{t(roleHeading(lord.role))}</div>
                <div className={styles.lordN}>{lordName(lang, lord.planetId)}</div>
                <p>
                  {rasiName(lang, lord.rasi)} · {houseOrdinal(lang, lord.houseFromAsc)}
                  <br />
                  {lang === "ta" ? lord.nakshatraTa : lord.nakshatraEn} {t("antara.pada")} {lord.pada}
                  <br />
                  {lord.degInSign.toFixed(1)}°
                  <br />
                  {lord.ruledHouses.length
                    ? ti("antara.adhipathiOf", {
                        houses: lord.ruledHouses.map((house) => houseOrdinal(lang, house)).join(", "),
                      })
                    : lord.actsForPlanetId != null
                      ? ti("antara.actsFor", { name: lordName(lang, lord.actsForPlanetId) })
                      : ti("antara.strength", { score: Math.round(lord.strength) })}
                </p>
                <span className={`${styles.tag} ${lord.dignity === "neecham" ? styles.tagBad : styles.tagOk}`}>
                  {dignityLabel(lord.dignity, t)}
                </span>
                <span className={`${styles.tag} ${lord.influence === "challenge" ? styles.tagBad : lord.influence === "support" ? styles.tagOk : ""}`}>
                  {influenceLabel(lord.influence, t)}
                </span>
              </button>
            ))}
          </div>
          <p className={styles.note}>{t("antara.linkedIntro")}</p>
          <div className={styles.tableWrap}>
            <table className={styles.links}>
              <thead>
                <tr>
                  <th>{t("antara.colHouse")}</th>
                  <th>{t("antara.colAdhipathi")}</th>
                  <th>{t("antara.colKaraka")}</th>
                </tr>
              </thead>
              <tbody>
                {impact.houses.map((house) => (
                  <tr
                    key={house.house}
                    className={
                      highlight != null &&
                      (highlight === house.adhipathiId ||
                        house.karakas.some((karaka) => karaka.planetId === highlight))
                        ? styles.rowOn
                        : undefined
                    }
                  >
                    <td>
                      {houseOrdinal(lang, house.house)} · {rasiName(lang, house.signRasi)}
                    </td>
                    <td>
                      <PlanetChip
                        planetId={house.adhipathiId}
                        active={highlight === house.adhipathiId}
                        language={lang}
                        onClick={togglePlanet}
                      />
                      {linkCaption(house, lang, t, ti)}
                    </td>
                    <td>
                      {house.karakas.map((karaka) => (
                        <PlanetChip
                          key={`${house.house}-${karaka.planetId}-${karaka.area}`}
                          planetId={karaka.planetId}
                          active={highlight === karaka.planetId}
                          language={lang}
                          title={karakaAreaLabel(lang, karaka.area)}
                          onClick={togglePlanet}
                        />
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {impact.lords.length > 1 ? (
            <div className={styles.relations} data-testid="antara-relations">
              <h3>{t("antara.lordRelations")}</h3>
              {relateLords(impact.lords).map((relation) => (
                <div key={`${relation.left.role}-${relation.right.role}`} className={styles.relation}>
                  <strong>
                    {t(roleHeading(relation.left.role))} · {t(roleHeading(relation.right.role))}
                  </strong>
                  <p>{relationCopy(relation, lang, t, ti)}</p>
                </div>
              ))}
            </div>
          ) : null}
          {impact.extras.length ? (
            <div className={styles.chips}>
              <span className={styles.note}>{t("antara.alsoInfluencing")}</span>
              {impact.extras.map((extra) => (
                <button
                  key={`${extra.kind}-${extra.planetId}-${extra.targetPlanetId}`}
                  type="button"
                  className={`${styles.chip} ${highlight === extra.planetId ? styles.chipOn : ""}`}
                  onClick={() => togglePlanet(extra.planetId)}
                >
                  {extra.kind === "conjunct"
                    ? ti("antara.withPlanet", {
                        name: lordName(lang, extra.planetId),
                        target: lordName(lang, extra.targetPlanetId),
                      })
                    : ti("antara.aspectsPlanet", {
                        name: lordName(lang, extra.planetId),
                        target: lordName(lang, extra.targetPlanetId),
                      })}
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className={styles.section}>
          <h3>{t("antara.kocharTitle")}</h3>
          <div className={styles.mode}>
            <button type="button" className={mode === "natal" ? styles.on : ""} data-testid="antara-mode-natal" onClick={() => setMode("natal")}>
              {t("antara.natal")}
            </button>
            <button type="button" className={mode === "kochar" ? styles.on : ""} data-testid="antara-mode-kochar" onClick={() => setMode("kochar")}>
              {t("antara.kochar")}
            </button>
          </div>
          <div className={styles.chartMeta}>
            <span>
              {mode === "natal"
                ? t("antara.chartTitleNatal")
                : ti("antara.kocharOn", { date: formatDay(selected, lang) })}
            </span>
            {mode === "kochar" ? <span>{t("antara.house1")}</span> : null}
          </div>
          <div className={styles.chartFrame} data-testid="antara-chart">
            {mode === "kochar" && !selectedDay ? (
              <p className={error ? styles.error : styles.note}>
                {loading ? t("antara.loadingSky") : error || t("antara.skyError")}
              </p>
            ) : (
              <SouthIndianChart
                planetsByRasi={
                  mode === "natal" || !selectedDay
                    ? chart.birth.planetsByRasi
                    : planetsByRasi(selectedDay.positions)
                }
                ascendantRasi={chart.birth.ascendantRasi}
                showAscendant={mode === "natal"}
                janmaRasi={mode === "kochar" && moonRasi != null ? moonRasi : undefined}
                janmaLabel={t("antara.janmaRasi")}
                houseNumbersFrom={mode === "kochar" && moonRasi != null ? moonRasi : undefined}
                natalMarks={natalMarks}
                highlightedPlanets={highlightName ? [highlightName] : []}
                emphasisRasis={emphasis}
                retrogradePlanets={
                  mode === "kochar" && selectedDay ? retrogradeNames(days, selectedDay.dateIst) : []
                }
                title={mode === "natal" ? t("antara.chartTitleNatal") : formatDay(selected, lang)}
                theme={dark ? "dark" : "light"}
              />
            )}
          </div>
          {partial && coverageEnd ? (
            <p className={styles.note}>{ti("antara.partialMarkers", { date: coverageEnd })}</p>
          ) : null}
          <div className={styles.flags}>
            {flags.map((flag) => (
              <span
                key={`${flag.code}-${flag.transitPlanetId ?? ""}-${flag.natalPlanetId ?? ""}-${flag.scope}`}
                className={`${styles.flag} ${flag.tone === "bad" ? styles.flagBad : flag.tone === "good" ? styles.flagGood : styles.flagWarn}`}
              >
                {flagText(flag)}
              </span>
            ))}
          </div>
          <div className={styles.switcher}>
            <div className={styles.switchTop}>
              <div>
                <div className={styles.note}>{t("antara.selectedDate")}</div>
                <div className={styles.date}>{formatDay(selected, lang)}</div>
              </div>
              <div className={styles.seg}>
                {(["day", "week", "month"] as const).map((item) => (
                  <button key={item} type="button" className={step === item ? styles.on : ""} onClick={() => chooseStep(item)}>
                    {t(`antara.${item}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className={`${styles.moon} ${step === "day" ? "" : styles.moonMuted}`} data-testid="antara-moon">
              <span>
                {moon?.rasi == null || moonRasi == null
                  ? t("antara.loadingSky")
                  : ti("antara.moonLine", {
                      sign: rasiName(lang, moon.rasi),
                      house: houseOrdinal(lang, houseFromNatalMoon(moonRasi, moon.rasi)),
                    })}
                {moon?.nextChangeDate ? ` · ${ti("antara.moonNext", { date: formatDay(moon.nextChangeDate, lang) })}` : ""}
              </span>
              <span className={styles.note}>{step === "day" ? moon && !moon.nextChangeDate ? t("antara.moonNoNext") : "" : t("antara.changesDaily")}</span>
            </div>
            <div className={styles.track}>
              <div className={styles.line} />
              <div className={styles.fill} style={{ width: `${percent}%` }} />
              {todayInside ? (
                <div className={styles.todayMark} style={{ left: `${(daysBetween(start, today) / Math.max(span, 1)) * 100}%` }}>
                  <span>{t("antara.jumpToday")}</span>
                </div>
              ) : null}
              {changes.map((change, index) => {
                const left = (daysBetween(start, change.date) / Math.max(span, 1)) * 100;
                const short = getPlanetChipLabel(lang, lordEnglish(change.planetId));
                return (
                  <button
                    key={`${change.planetId}-${change.date}-${index}`}
                    type="button"
                    className={`${styles.marker} ${MARKER_CLASS[change.planetId] ?? styles.markerSa}`}
                    style={{ left: `${left}%`, top: index % 2 === 0 ? 0 : 8 }}
                    onClick={() => chooseDate(change.date)}
                  >
                    {markerShowsRetro(change) ? `${short} R` : short}
                  </button>
                );
              })}
              <div className={styles.thumb} style={{ left: `${percent}%` }} />
              <input
                className={styles.slider}
                data-testid="antara-slider"
                type="range"
                min={0}
                max={span}
                step={stepDays(step)}
                value={offset}
                aria-label={t("antara.selectedDate")}
                onChange={(event) =>
                  chooseDate(addIsoDays(start, snapOffset(Number(event.target.value), span, step)))
                }
              />
            </div>
            <div className={styles.ends}>
              <span>{formatDay(start, lang)}</span>
              <span>{formatDay(end, lang)}</span>
            </div>
            <div className={styles.jump}>
              <button type="button" onClick={() => chooseDate(start)}>{t("antara.jumpStart")}</button>
              <button
                type="button"
                disabled={!changes.some((change) => change.date < selected)}
                onClick={() => {
                  const earlier = [...changes].reverse().find((change) => change.date < selected);
                  if (earlier) chooseDate(earlier.date);
                }}
              >
                {t("antara.jumpPrev")}
              </button>
              {todayInside ? (
                <button type="button" onClick={() => chooseDate(today)}>{t("antara.jumpToday")}</button>
              ) : null}
              <button
                type="button"
                disabled={!changes.some((change) => change.date > selected)}
                onClick={() => {
                  const later = changes.find((change) => change.date > selected);
                  if (later) chooseDate(later.date);
                }}
              >
                {t("antara.jumpNext")}
              </button>
              <button type="button" onClick={() => chooseDate(end)}>{t("antara.jumpEnd")}</button>
            </div>
          </div>
          <div className={styles.events}>
            <div className={styles.note}>{t("antara.eventsTitle")}</div>
            <SlowSummary days={days} changes={changes} language={lang} t={t} ti={ti} />
            {changes.length ? (
              changes.map((change, index) => (
                <button
                  key={`event-${change.planetId}-${change.date}-${index}`}
                  type="button"
                  className={`${styles.event} ${change.date === selected ? styles.eventOn : ""}`}
                  onClick={() => chooseDate(change.date)}
                >
                  <span className={styles.eventDate}>{formatDay(change.date, lang)}</span>
                  <span className={styles.dot} style={{ background: markerColor(change.planetId) }} />
                  <span>{eventText(change, lang, ti)}</span>
                </button>
              ))
            ) : (
              <p className={styles.note}>{loading ? t("antara.loadingSky") : t("antara.noChanges")}</p>
            )}
          </div>
          <details>
            <summary>{t("antara.transitTable")}</summary>
            {selectedDay ? (
              <table className={styles.plain}>
                <thead>
                  <tr>
                    <th>{t("antara.colPlanet")}</th>
                    <th>{t("antara.colSign")}</th>
                    <th>{t("antara.colDegree")}</th>
                    <th>{t("antara.colNakshatra")}</th>
                    <th>{t("antara.colFromMoon")}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(selectedDay.positions)
                    .sort((a, b) => a.planetId - b.planetId)
                    .map((planet) => {
                      const nakshatra = nakshatraFromLongitude(planet.totalLongitude);
                      return (
                        <tr key={planet.planetId}>
                          <td>{lordName(lang, planet.planetId)}</td>
                          <td>{rasiName(lang, planet.rasi)}</td>
                          <td>{planet.degInSign.toFixed(2)}</td>
                          <td>
                            {lang === "ta" ? nakshatra.ta : nakshatra.en} {nakshatra.pada}
                          </td>
                          <td>
                            {moonRasi == null
                              ? "—"
                              : houseOrdinal(lang, houseFromNatalMoon(moonRasi, planet.rasi))}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            ) : (
              <p className={styles.note}>{t("antara.loadingSky")}</p>
            )}
          </details>
        </section>

        <details className={styles.section}>
          <summary>{t("antara.housesActivated")}</summary>
          <ul>
            {impact.activated.map((house) => (
              <li key={house.house}>
                {houseOrdinal(lang, house.house)} · {rasiName(lang, house.signRasi)} ·{" "}
                {house.reasons.map((reason) => t(reasonKey(reason))).join(", ")} ·{" "}
                {influenceLabel(house.influence, t)}
              </li>
            ))}
          </ul>
        </details>

        {sookshmas.length ? (
          <details className={styles.section}>
            <summary>{t("antara.sookshma")}</summary>
            {sookshmas.map((row) => (
              <button
                key={`${row.lord}-${row.start}`}
                type="button"
                className={styles.leaf}
                onClick={() => chooseDate(isoDateKey(row.start))}
              >
                <span>{lordName(lang, row.lord)}</span>
                <span>
                  {formatDay(row.start, lang)}
                  {row.end ? ` – ${formatDay(row.end, lang)}` : ""}
                </span>
              </button>
            ))}
          </details>
        ) : null}

        <div className={styles.section}>
          <button type="button" className={styles.exportBtn} onClick={exportPeriod}>
            {t("antara.exportJson")}
          </button>
        </div>
      </aside>
    </>
  );
}

function PlanetChip({
  planetId,
  active,
  language,
  title,
  onClick,
}: {
  planetId: number;
  active: boolean;
  language: "en" | "ta";
  title?: string;
  onClick: (planetId: number) => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.chip} ${active ? styles.chipOn : ""}`}
      title={title}
      onClick={() => onClick(planetId)}
    >
      {lordName(language, planetId)}
    </button>
  );
}

function roleHeading(role: PeriodLevel) {
  if (role === "maha") return "antara.mahaLord";
  if (role === "bhukti") return "antara.bhuktiLord";
  return "antara.antaraLord";
}

function dignityLabel(dignity: LordImpact["dignity"], t: (key: string) => string) {
  if (dignity === "ucham") return t("antara.dignityUcham");
  if (dignity === "neecham") return t("antara.dignityNeecham");
  if (dignity === "moolatrikona") return t("antara.dignityMoolatrikona");
  if (dignity === "own_sign") return t("antara.dignityOwn");
  return t("antara.dignityOrdinary");
}

function influenceLabel(role: "support" | "challenge" | "mixed", t: (key: string) => string) {
  if (role === "support") return t("antara.roleSupport");
  if (role === "challenge") return t("antara.roleChallenge");
  return t("antara.roleMixed");
}

function reasonKey(reason: "ruled" | "occupied" | "aspected") {
  if (reason === "ruled") return "antara.reasonRuled";
  if (reason === "occupied") return "antara.reasonOccupied";
  return "antara.reasonAspected";
}

function summaryLine(
  lord: LordImpact,
  language: "en" | "ta",
  t: (key: string) => string,
  ti: (key: string, vars: Record<string, string | number>) => string
) {
  if (lord.actsForPlanetId != null) {
    return ti("antara.summaryNode", {
      name: lordName(language, lord.planetId),
      sign: rasiName(language, lord.rasi),
      house: houseOrdinal(language, lord.houseFromAsc),
      signLord: lordName(language, lord.actsForPlanetId),
    });
  }
  const house = houseOrdinal(language, lord.houseFromAsc);
  return ti("antara.summaryLord", {
    name: lordName(language, lord.planetId),
    ruled: lord.ruledHouses.length
      ? lord.ruledHouses.map((item) => houseOrdinal(language, item)).join(", ")
      : "—",
    placement: ti(dignityPhraseKey(lord.dignity), {
      sign: rasiName(language, lord.rasi),
      house,
    }),
  });
}

function durationKey(unit: DurationUnit, count: number) {
  if (unit === "year") return count === 1 ? "antara.oneYear" : "antara.manyYears";
  if (unit === "month") return count === 1 ? "antara.oneMonth" : "antara.manyMonths";
  return count === 1 ? "antara.oneDay" : "antara.manyDays";
}

function dignityPhraseKey(dignity: LordImpact["dignity"]) {
  if (dignity === "ucham") return "antara.dignityPhraseUcham";
  if (dignity === "neecham") return "antara.dignityPhraseNeecham";
  if (dignity === "moolatrikona") return "antara.dignityPhraseMoolatrikona";
  if (dignity === "own_sign") return "antara.dignityPhraseOwn";
  return "antara.dignityPhraseOrdinary";
}

function relationWord(relation: NaturalRelation, t: (key: string) => string) {
  if (relation === "same") return t("antara.naturalSame");
  if (relation === "friend") return t("antara.naturalFriend");
  if (relation === "enemy") return t("antara.naturalEnemy");
  return t("antara.naturalNeutral");
}

function toneWord(tone: PlacementTone, t: (key: string) => string) {
  if (tone === "supportive") return t("antara.toneSupportive");
  if (tone === "friction") return t("antara.toneFriction");
  return t("antara.toneNeutral");
}

function relationCopy(
  relation: LordRelation,
  language: "en" | "ta",
  t: (key: string) => string,
  ti: (key: string, vars: Record<string, string | number>) => string
) {
  const left = lordName(language, relation.left.planetId);
  const right = lordName(language, relation.right.planetId);
  const tone = toneWord(relation.placement, t);
  if (relation.left.planetId === relation.right.planetId) {
    return `${ti("antara.relationNatural", { relation: t("antara.naturalSame") })} ${ti("antara.relationSamePlace", { tone })}`;
  }
  const natural =
    relation.leftToRight === relation.rightToLeft
      ? ti("antara.relationNatural", { relation: relationWord(relation.leftToRight, t) })
      : ti("antara.relationNaturalBoth", {
          left,
          right,
          leftToRight: relationWord(relation.leftToRight, t),
          rightToLeft: relationWord(relation.rightToLeft, t),
        });
  const placement = ti("antara.relationPlacement", {
    left,
    right,
    rightFromLeft: houseOrdinal(language, relation.houseOfRightFromLeft),
    leftFromRight: houseOrdinal(language, relation.houseOfLeftFromRight),
    tone,
  });
  return `${natural} ${placement}`;
}

function linkCaption(
  house: HouseLink,
  language: "en" | "ta",
  t: (key: string) => string,
  ti: (key: string, vars: Record<string, string | number>) => string
) {
  if (house.periodRole) return ` ${t(roleHeading(house.periodRole))}`;
  if (house.viaNode) return ` ${ti("antara.via", { name: lordName(language, house.viaNode.planetId) })}`;
  const occupied = house.occupiedBy[0];
  if (occupied) return ` ${ti("antara.occupiedBy", { name: lordName(language, occupied.planetId) })}`;
  return "";
}

function markerColor(planetId: number) {
  if (planetId === 4) return "#ca8a04";
  if (planetId === 6) return "#475569";
  if (planetId === 7) return "#7c3aed";
  return "#0f766e";
}

function eventText(
  change: SignChange,
  language: "en" | "ta",
  ti: (key: string, vars: Record<string, string | number>) => string
) {
  const planet = lordName(language, change.planetId);
  if (change.reentry) {
    return ti("antara.reenters", { planet, sign: rasiName(language, change.toRasi) });
  }
  if (change.direction === "retro" && (change.planetId === 4 || change.planetId === 6)) {
    return ti("antara.movesRetro", { planet, sign: rasiName(language, change.toRasi) });
  }
  return ti("antara.movesForward", {
    planet,
    from: rasiName(language, change.fromRasi),
    to: rasiName(language, change.toRasi),
  });
}

function SlowSummary({
  days,
  changes,
  language,
  t,
  ti,
}: {
  days: SkyDay[];
  changes: SignChange[];
  language: "en" | "ta";
  t: (key: string) => string;
  ti: (key: string, vars: Record<string, string | number>) => string;
}) {
  if (!days.length) return null;
  const first = days[0];
  const lines = [4, 6, 7, 8].map((planetId) => {
    const planetChanges = changes.filter((change) => change.planetId === planetId);
    const startPlanet = Object.values(first.positions).find((planet) => planet.planetId === planetId);
    if (!startPlanet) return null;
    if (!planetChanges.length) {
      return ti("antara.throughout", {
        planet: lordName(language, planetId),
        sign: rasiName(language, startPlanet.rasi),
      });
    }
    return planetChanges
      .map((change) =>
        ti("antara.signShift", {
          planet: lordName(language, planetId),
          from: rasiName(language, change.fromRasi),
          to: rasiName(language, change.toRasi),
          date: change.date,
        })
      )
      .join(" · ");
  });
  return (
    <p className={styles.note}>
      {lines.filter(Boolean).join(" · ") || t("antara.noChanges")}
    </p>
  );
}
