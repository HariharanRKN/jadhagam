function isoDateKey(value: string | null | undefined): string {
  if (!value) return "";
  const match = value.trim().match(/(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? value.trim().slice(0, 10);
}

export const ANTARA_CLIP_MAX_DAYS = 90;

export type DatedSpan = {
  start: string;
  end: string | null;
};

export type ClippedSpan<T extends DatedSpan> = T & {
  clipStart: string;
  clipEnd: string;
  continuesOutside: boolean;
  containsFocus: boolean;
};

export type FamilyPeriodRange = {
  start: string;
  end: string;
};

export type FamilyMemberClip = {
  name: string;
  mahaLords: number[];
  bhuktiLords: number[];
  houses: number[];
};

export type FamilyPeriodSummary = {
  memberCount: number;
  sharedMaha: Array<{ lordId: number; names: string[] }>;
  sharedBhukti: Array<{ lordId: number; names: string[] }>;
  sharedHouses: number[];
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function isoUtcMs(iso: string) {
  const [year, month, day] = isoDateKey(iso).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function orderedIsoRange(from: string, to: string): FamilyPeriodRange {
  const start = isoDateKey(from);
  const end = isoDateKey(to);
  if (!start) return { start: end, end };
  if (!end) return { start, end: start };
  return start <= end ? { start, end } : { start: end, end: start };
}

export function inclusiveDaySpan(from: string, to: string) {
  const { start, end } = orderedIsoRange(from, to);
  if (!start || !end) return 0;
  return Math.round((isoUtcMs(end) - isoUtcMs(start)) / 86_400_000) + 1;
}

export function shouldShowAntara(from: string, to: string) {
  return inclusiveDaySpan(from, to) <= ANTARA_CLIP_MAX_DAYS;
}

export function clampIsoToRange(focus: string, from: string, to: string) {
  const { start, end } = orderedIsoRange(from, to);
  const value = isoDateKey(focus) || start;
  if (!start) return value;
  if (value < start) return start;
  if (end && value > end) return end;
  return value;
}

export function clipDateRange(
  rowStart: string,
  rowEnd: string | null,
  periodFrom: string,
  periodTo: string
) {
  const { start: periodStart, end: periodEnd } = orderedIsoRange(
    periodFrom,
    periodTo
  );
  const rowFrom = isoDateKey(rowStart);
  const rowTo = rowEnd ? isoDateKey(rowEnd) : "9999-12-31";
  if (!rowFrom || !periodStart || !periodEnd) return null;
  const clipStart = rowFrom > periodStart ? rowFrom : periodStart;
  const clipEnd = rowTo < periodEnd ? rowTo : periodEnd;
  if (clipStart > clipEnd) return null;
  return {
    clipStart,
    clipEnd,
    continuesOutside: rowFrom < periodStart || rowTo > periodEnd,
  };
}

export function clipDatedRows<T extends DatedSpan>(
  rows: T[],
  periodFrom: string,
  periodTo: string,
  focusDate: string
): ClippedSpan<T>[] {
  const focus = isoDateKey(focusDate);
  const clipped: ClippedSpan<T>[] = [];
  for (const row of rows) {
    const clip = clipDateRange(row.start, row.end, periodFrom, periodTo);
    if (!clip) continue;
    clipped.push({
      ...row,
      ...clip,
      containsFocus: Boolean(focus) && focus >= clip.clipStart && focus <= clip.clipEnd,
    });
  }
  return clipped.sort((a, b) => a.clipStart.localeCompare(b.clipStart));
}

function addCalendarMonths(iso: string, months: number) {
  const [year, month, day] = isoDateKey(iso).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, day));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(
    date.getUTCDate()
  )}`;
}

function lastDayOfMonth(iso: string) {
  const [year, month] = isoDateKey(iso).split("-").map(Number);
  const date = new Date(Date.UTC(year, month, 0));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(
    date.getUTCDate()
  )}`;
}

export function familyPeriodPresets(today: string) {
  const day = isoDateKey(today);
  const [year, month] = day.split("-").map(Number);
  const monthStart = `${year}-${pad2(month)}-01`;
  return {
    thisMonth: { from: monthStart, to: lastDayOfMonth(day) },
    nextSixMonths: { from: day, to: addCalendarMonths(day, 6) },
    thisYear: { from: `${year}-01-01`, to: `${year}-12-31` },
  };
}

function uniqueNumbers(values: number[]) {
  return [...new Set(values)];
}

function sharedLord(
  members: FamilyMemberClip[],
  pick: (member: FamilyMemberClip) => number[]
) {
  const namesByLord = new Map<number, string[]>();
  for (const member of members) {
    for (const lordId of uniqueNumbers(pick(member))) {
      const names = namesByLord.get(lordId) ?? [];
      names.push(member.name);
      namesByLord.set(lordId, names);
    }
  }
  return [...namesByLord.entries()]
    .filter(([, names]) => names.length >= 2)
    .map(([lordId, names]) => ({ lordId, names }))
    .sort((a, b) => b.names.length - a.names.length || a.lordId - b.lordId);
}

export function buildFamilyPeriodSummary(
  members: FamilyMemberClip[]
): FamilyPeriodSummary {
  const houseHits = new Map<number, number>();
  for (const member of members) {
    for (const house of uniqueNumbers(member.houses)) {
      houseHits.set(house, (houseHits.get(house) ?? 0) + 1);
    }
  }
  return {
    memberCount: members.length,
    sharedMaha: sharedLord(members, (member) => member.mahaLords),
    sharedBhukti: sharedLord(members, (member) => member.bhuktiLords),
    sharedHouses: [...houseHits.entries()]
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .map(([house]) => house),
  };
}
