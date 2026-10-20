export type DurationUnit = "year" | "month" | "day";

/** Non-zero year, month, and day counts. A zero-length span is one day segment of 0. */
export function durationSegments(duration: {
  years: number;
  months: number;
  days: number;
}): Array<{ unit: DurationUnit; count: number }> {
  const segments: Array<{ unit: DurationUnit; count: number }> = [];
  if (duration.years) segments.push({ unit: "year", count: duration.years });
  if (duration.months) segments.push({ unit: "month", count: duration.months });
  if (duration.days || segments.length === 0) {
    segments.push({ unit: "day", count: duration.days });
  }
  return segments;
}
