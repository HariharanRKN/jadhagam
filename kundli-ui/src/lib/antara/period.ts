import type { ChartDataPayload } from "@/types/chartData";
import { isoDateKey } from "@/lib/isoDate";

export { durationSegments, type DurationUnit } from "./duration";

export type PeriodLevel = "maha" | "bhukti" | "antara";

export type OpenPeriod = {
  level: PeriodLevel;
  mahaLord: number;
  bhuktiLord: number | null;
  antaraLord: number | null;
  start: string;
  end: string | null;
};

export type DateStep = "day" | "week" | "month";

export type PeriodTiming = "past" | "current" | "upcoming";

function parts(value: string): { y: number; m: number; d: number } | null {
  const key = isoDateKey(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

export function addIsoDays(iso: string, days: number): string {
  const parsed = parts(iso);
  if (!parsed) return isoDateKey(iso);
  const date = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  date.setUTCDate(date.getUTCDate() + days);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function daysBetween(start: string, end: string): number {
  const a = parts(start);
  const b = parts(end);
  if (!a || !b) return 0;
  const ms = Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d);
  return Math.round(ms / 86_400_000);
}

export function calendarDuration(
  start: string,
  end: string
): { years: number; months: number; days: number } {
  const a = parts(start);
  const b = parts(end);
  if (!a || !b) return { years: 0, months: 0, days: 0 };
  let years = b.y - a.y;
  let months = b.m - a.m;
  let days = b.d - a.d;
  if (days < 0) {
    months -= 1;
    days += new Date(Date.UTC(b.y, b.m - 1, 0)).getUTCDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days };
}

/** End date is exclusive, matching house-analysis active-period checks. */
export function periodTiming(start: string, end: string | null, today: string): PeriodTiming {
  const from = isoDateKey(start);
  const to = end ? isoDateKey(end) : "";
  const now = isoDateKey(today);
  if (now < from) return "upcoming";
  if (to && now >= to) return "past";
  return "current";
}

/** Under two months defaults to week; otherwise month. */
export function defaultDateStep(start: string, end: string | null): DateStep {
  if (!end) return "month";
  const span = calendarDuration(isoDateKey(start), isoDateKey(end));
  const months = span.years * 12 + span.months + span.days / 31;
  if (months < 2) return "week";
  return "month";
}

export function clampIsoDate(value: string, start: string, end: string): string {
  const date = isoDateKey(value);
  const from = isoDateKey(start);
  const to = isoDateKey(end);
  if (!date || date < from) return from;
  if (to && date > to) return to;
  return date;
}

export function initialSelectedDate(start: string, end: string | null, today: string): string {
  const from = isoDateKey(start);
  const to = end ? isoDateKey(end) : from;
  const now = isoDateKey(today);
  if (now >= from && (!to || now <= to)) return to && now > to ? to : now;
  return from;
}

export function stepDays(step: DateStep): number {
  if (step === "week") return 7;
  if (step === "month") return 30;
  return 1;
}

export function snapOffset(offset: number, span: number, step: DateStep): number {
  const size = stepDays(step);
  const bounded = Math.max(0, Math.min(span, offset));
  if (size === 1) return bounded;
  const snapped = Math.round(bounded / size) * size;
  return Math.max(0, Math.min(span, snapped));
}

export function periodKey(period: OpenPeriod): string {
  return [
    period.level,
    period.mahaLord,
    period.bhuktiLord ?? "",
    period.antaraLord ?? "",
    isoDateKey(period.start),
  ].join("|");
}

function mapMaha(row: ChartDataPayload["vimsottari"]["mahadasha"][number]): OpenPeriod {
  return {
    level: "maha",
    mahaLord: row.lord,
    bhuktiLord: null,
    antaraLord: null,
    start: row.start,
    end: row.end,
  };
}

function mapBhukti(row: ChartDataPayload["vimsottari"]["bhukti"][number]): OpenPeriod {
  return {
    level: "bhukti",
    mahaLord: row.maha,
    bhuktiLord: row.lord,
    antaraLord: null,
    start: row.start,
    end: row.end,
  };
}

function mapAntara(row: ChartDataPayload["vimsottari"]["antara"][number]): OpenPeriod {
  return {
    level: "antara",
    mahaLord: row.maha,
    bhuktiLord: row.bhukti,
    antaraLord: row.lord,
    start: row.start,
    end: row.end,
  };
}

export function siblingPeriods(chart: ChartDataPayload, current: OpenPeriod): OpenPeriod[] {
  if (current.level === "maha") {
    return [...chart.vimsottari.mahadasha]
      .sort((a, b) => a.start.localeCompare(b.start))
      .map(mapMaha);
  }
  if (current.level === "bhukti") {
    return chart.vimsottari.bhukti
      .filter((row) => row.maha === current.mahaLord)
      .sort((a, b) => a.start.localeCompare(b.start))
      .map(mapBhukti);
  }
  return chart.vimsottari.antara
    .filter((row) => row.maha === current.mahaLord && row.bhukti === current.bhuktiLord)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map(mapAntara);
}

function siblingIndex(list: OpenPeriod[], current: OpenPeriod): number {
  const key = periodKey(current);
  const exact = list.findIndex((period) => periodKey(period) === key);
  if (exact >= 0) return exact;
  const start = isoDateKey(current.start);
  const byStart = list.findIndex(
    (period) => isoDateKey(period.start) === start && period.mahaLord === current.mahaLord
  );
  if (byStart >= 0) return byStart;
  if (current.level === "bhukti") {
    return list.findIndex(
      (period) =>
        period.mahaLord === current.mahaLord && period.bhuktiLord === current.bhuktiLord
    );
  }
  if (current.level === "antara") {
    return list.findIndex(
      (period) =>
        period.mahaLord === current.mahaLord &&
        period.bhuktiLord === current.bhuktiLord &&
        period.antaraLord === current.antaraLord
    );
  }
  return list.findIndex((period) => period.mahaLord === current.mahaLord);
}

export function stepSibling(
  chart: ChartDataPayload,
  current: OpenPeriod,
  direction: -1 | 1
): OpenPeriod | null {
  const list = siblingPeriods(chart, current);
  const index = siblingIndex(list, current);
  if (index < 0) return null;
  return list[index + direction] ?? null;
}

export function childAntaras(chart: ChartDataPayload, period: OpenPeriod): OpenPeriod[] {
  if (period.bhuktiLord == null) return [];
  return chart.vimsottari.antara
    .filter((row) => row.maha === period.mahaLord && row.bhukti === period.bhuktiLord)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map(mapAntara);
}

export function childBhuktis(chart: ChartDataPayload, period: OpenPeriod): OpenPeriod[] {
  return chart.vimsottari.bhukti
    .filter((row) => row.maha === period.mahaLord)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map(mapBhukti);
}

export function sookshmaStrip(chart: ChartDataPayload, period: OpenPeriod) {
  if (period.level !== "antara" || period.bhuktiLord == null || period.antaraLord == null) {
    return [];
  }
  return chart.vimsottari.sookshma
    .filter(
      (row) =>
        row.maha === period.mahaLord &&
        row.bhukti === period.bhuktiLord &&
        row.antara === period.antaraLord
    )
    .sort((a, b) => a.start.localeCompare(b.start));
}
