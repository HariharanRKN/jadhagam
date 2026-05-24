import type { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

type LifeEventIn = {
  type: string; // event key from semantic events.json
  at: string; // ISO date or datetime
};

type IdentifyBody = {
  dob: string; // YYYY-MM-DD
  tob: string; // HH:MM or HH:MM:SS (local)
  place: string; // free-text
  deltaMinutes: number; // +/- range
  stepSeconds?: number; // default 60
  lifeEvents: LifeEventIn[];
  topK?: number;
};

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: { name?: string; city?: string; country?: string; state?: string };
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseBody(body: unknown): IdentifyBody {
  if (!isRecord(body)) throw new Error("Body must be a JSON object");
  const dob = String(body.dob ?? "").trim();
  const tob = String(body.tob ?? "").trim();
  const place = String(body.place ?? "").trim();
  const deltaMinutes = Number(body.deltaMinutes);
  const stepSecondsRaw = body.stepSeconds;
  const topKRaw = body.topK;
  const lifeEventsRaw = body.lifeEvents;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) throw new Error("dob must be YYYY-MM-DD");
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(tob)) throw new Error("tob must be HH:MM or HH:MM:SS");
  if (!place) throw new Error("place is required");
  if (!Number.isFinite(deltaMinutes) || deltaMinutes <= 0 || deltaMinutes > 240) {
    throw new Error("deltaMinutes must be between 1 and 240");
  }
  const stepSeconds =
    typeof stepSecondsRaw === "number" && Number.isFinite(stepSecondsRaw) ? Math.max(30, Math.min(900, Math.floor(stepSecondsRaw))) : 60;
  const topK =
    typeof topKRaw === "number" && Number.isFinite(topKRaw) ? Math.max(1, Math.min(25, Math.floor(topKRaw))) : 5;

  if (!Array.isArray(lifeEventsRaw) || lifeEventsRaw.length === 0) {
    throw new Error("lifeEvents must be a non-empty array");
  }
  const lifeEvents: LifeEventIn[] = [];
  for (const x of lifeEventsRaw) {
    if (!isRecord(x)) continue;
    const type = String(x.type ?? "").trim();
    const at = String(x.at ?? "").trim();
    if (!type || !at) continue;
    lifeEvents.push({ type, at });
  }
  if (lifeEvents.length === 0) throw new Error("lifeEvents entries must include type and at");

  return { dob, tob, place, deltaMinutes: Math.floor(deltaMinutes), stepSeconds, lifeEvents, topK };
}

function defaultRepoRoot() {
  return process.env.NODE_ENV === "production" ? "/app" : join(process.cwd(), "..");
}

async function photonLookup(placeQuery: string): Promise<{ name: string; lat: number; lng: number }> {
  const base = (process.env.PHOTON_API_URL ?? "https://photon.komoot.io").replace(/\/$/, "");
  const url = `${base}/api/?q=${encodeURIComponent(placeQuery)}&limit=1&lang=en`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("place lookup failed");
  const data = (await res.json()) as { features?: PhotonFeature[] };
  const f = data.features?.[0];
  const coords = f?.geometry?.coordinates;
  if (!coords || coords.length !== 2) throw new Error("no place match");
  const [lng, lat] = coords;
  const nameRaw = f?.properties?.name ?? placeQuery;
  return { name: String(nameRaw), lat: Number(lat), lng: Number(lng) };
}

async function timezoneLookup(lat: number, lng: number): Promise<number> {
  const url = new URL("https://timeapi.io/api/TimeZone/coordinate");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("timezone lookup failed");
  const data = (await res.json()) as { currentUtcOffset?: { seconds?: number } };
  const seconds = data.currentUtcOffset?.seconds;
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) throw new Error("timezone response missing offset");
  return seconds / 3600;
}

function parseDobTob(dob: string, tob: string): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const [y, m, d] = dob.split("-").map((x) => Number(x));
  const parts = tob.split(":").map((x) => Number(x));
  const [hh, mm, ss] = [parts[0], parts[1], parts[2] ?? 0];
  if (![y, m, d, hh, mm, ss].every((n) => Number.isFinite(n))) throw new Error("invalid dob/tob");
  return { year: y, month: m, day: d, hour: hh, minute: mm, second: ss };
}

function addSecondsToTime(tob: string, deltaSeconds: number): string {
  const parts = tob.split(":").map((x) => Number(x));
  const base = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  let total = base + deltaSeconds;
  // keep within 0..86399; birth time adjustments assume same date.
  total = ((total % 86400) + 86400) % 86400;
  const hh = String(Math.floor(total / 3600)).padStart(2, "0");
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

type Vec = Record<string, number>;

function weightedMerge(pairs: Array<[Vec, number]>): Vec {
  const out: Vec = {};
  for (const [v, w] of pairs) {
    for (const [k, val] of Object.entries(v)) {
      out[k] = (out[k] ?? 0) + val * w;
    }
  }
  return out;
}

function normalize(v: Vec): Vec {
  const vals = Object.values(v);
  if (vals.length === 0) return {};
  const max = Math.max(...vals);
  if (!Number.isFinite(max) || max === 0) return { ...v };
  const out: Vec = {};
  for (const [k, val] of Object.entries(v)) out[k] = Math.round((val / max) * 10000) / 10000;
  return out;
}

function cosine(v1: Vec, v2: Vec): number {
  const keys = new Set([...Object.keys(v1), ...Object.keys(v2)]);
  let num = 0;
  let n1 = 0;
  let n2 = 0;
  for (const k of keys) {
    const a = v1[k] ?? 0;
    const b = v2[k] ?? 0;
    num += a * b;
    n1 += a * a;
    n2 += b * b;
  }
  if (n1 === 0 || n2 === 0) return 0;
  return Math.round((num / (Math.sqrt(n1) * Math.sqrt(n2))) * 10000) / 10000;
}

function conjunctionSignature(p1: string, p2: string, planets: Record<string, { dimensions: Vec }>, conjunctions: Record<string, Vec>): Vec {
  const v1 = planets[p1]?.dimensions ?? {};
  const v2 = planets[p2]?.dimensions ?? {};
  const base = weightedMerge([
    [v1, 0.5],
    [v2, 0.5],
  ]);
  const key = [p1, p2].sort().join("_");
  const mods = conjunctions[key] ?? {};
  return normalize(weightedMerge([[base, 0.7], [mods, 0.3]]));
}

function composeDasha(maha: string, bhukti: string, antara: string | null, planets: Record<string, { dimensions: Vec }>, conjunctions: Record<string, Vec>): Vec {
  const mahaV = planets[maha]?.dimensions ?? {};
  const bhuktiV = planets[bhukti]?.dimensions ?? {};
  const pairs: Array<[Vec, number]> = [
    [mahaV, 0.55],
    [bhuktiV, 0.3],
  ];
  if (antara) {
    const antaraV = planets[antara]?.dimensions ?? {};
    pairs.push([antaraV, 0.15]);
  }
  const base = weightedMerge(pairs);
  const conj = conjunctionSignature(maha, bhukti, planets, conjunctions);
  return normalize(weightedMerge([[base, 0.7], [conj, 0.3]]));
}

function parseDateMs(s: string): number | null {
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

function parseEventAtMs(input: string, tzHours: number): { atMs: number; atIso: string } | null {
  const s = input.trim();
  // Date-only: treat as noon at the place timezone to avoid midnight boundary issues.
  const mDateOnly = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (mDateOnly) {
    const y = Number(mDateOnly[1]);
    const mo = Number(mDateOnly[2]);
    const d = Number(mDateOnly[3]);
    if (![y, mo, d].every((n) => Number.isFinite(n))) return null;
    // noon local time at place => UTC = local - offset
    const utcMs = Date.UTC(y, mo - 1, d, 12, 0, 0) - Math.round(tzHours * 3600 * 1000);
    return { atMs: utcMs, atIso: new Date(utcMs).toISOString() };
  }

  // ISO with timezone: let Date.parse handle it (deterministic).
  if (/[zZ]$/.test(s) || /[+-]\d{2}:\d{2}$/.test(s)) {
    const t = Date.parse(s);
    if (!Number.isFinite(t)) return null;
    return { atMs: t, atIso: new Date(t).toISOString() };
  }

  // ISO without timezone: treat as place-local time.
  const mLocal = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (mLocal) {
    const y = Number(mLocal[1]);
    const mo = Number(mLocal[2]);
    const d = Number(mLocal[3]);
    const hh = Number(mLocal[4]);
    const mm = Number(mLocal[5]);
    const ss = mLocal[6] ? Number(mLocal[6]) : 0;
    if (![y, mo, d, hh, mm, ss].every((n) => Number.isFinite(n))) return null;
    const utcMs = Date.UTC(y, mo - 1, d, hh, mm, ss) - Math.round(tzHours * 3600 * 1000);
    return { atMs: utcMs, atIso: new Date(utcMs).toISOString() };
  }

  // Fallback to Date.parse (best-effort).
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  return { atMs: t, atIso: new Date(t).toISOString() };
}

function findActiveLordByTime(rows: unknown[], atMs: number): number | null {
  for (const r of rows) {
    if (!isRecord(r)) continue;
    const start = typeof r.start === "string" ? parseDateMs(r.start) : null;
    const end = typeof r.end === "string" ? parseDateMs(r.end) : null;
    if (start == null) continue;
    if (atMs < start) continue;
    if (end != null && atMs >= end) continue;
    const lord = Number(r.lord);
    return Number.isFinite(lord) ? lord : null;
  }
  return null;
}

function getLordEn(lordId: number): string | null {
  const m: Record<number, string> = { 0: "Sun", 1: "Moon", 2: "Mars", 3: "Mercury", 4: "Jupiter", 5: "Venus", 6: "Saturn", 7: "Rahu", 8: "Ketu" };
  return m[lordId] ?? null;
}

async function loadOntology() {
  const repoRoot = defaultRepoRoot();
  const base = join(repoRoot, "semantic", "semantic_engine", "ontology");
  const [eventsRaw, planetsRaw, conjRaw] = await Promise.all([
    readFile(join(base, "events.json"), "utf8"),
    readFile(join(base, "planets.json"), "utf8"),
    readFile(join(base, "conjunctions.json"), "utf8"),
  ]);
  const events = JSON.parse(eventsRaw) as Record<string, { dimensions: Vec }>;
  const planets = JSON.parse(planetsRaw) as Record<string, { dimensions: Vec }>;
  const conjunctions = JSON.parse(conjRaw) as Record<string, Vec>;
  return { events, planets, conjunctions };
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let input: IdentifyBody;
  try {
    input = parseBody(body);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Validation failed" }, { status: 400 });
  }

  let ontology: Awaited<ReturnType<typeof loadOntology>>;
  try {
    ontology = await loadOntology();
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Failed to load ontology" }, { status: 500 });
  }

  // Validate event types exist.
  for (const ev of input.lifeEvents) {
    if (!ontology.events[ev.type]) {
      return Response.json({ error: `Unknown life event type: ${ev.type}` }, { status: 400 });
    }
  }

  let placeResolved: { name: string; lat: number; lng: number; tz: number };
  try {
    const p = await photonLookup(input.place);
    const tz = await timezoneLookup(p.lat, p.lng);
    placeResolved = { ...p, tz };
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Place resolution failed" }, { status: 502 });
  }

  const baseBirth = parseDobTob(input.dob, input.tob);
  const now = Date.now();
  const results: Array<Record<string, unknown>> = [];

  const deltaSeconds = input.deltaMinutes * 60;
  const stepSeconds = input.stepSeconds ?? 60;

  // Candidate loop: call /api/horoscope for each candidate time and score life events against active dashas.
  for (let ds = -deltaSeconds; ds <= deltaSeconds; ds += stepSeconds) {
    const candidateTob = addSecondsToTime(input.tob, ds);
    const birth = { ...baseBirth, hour: Number(candidateTob.slice(0, 2)), minute: Number(candidateTob.slice(3, 5)), second: Number(candidateTob.slice(6, 8)) };

    const horoscopeRes = await fetch(new URL("/api/horoscope", request.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ birth, place: placeResolved, transit: null }),
    });
    if (!horoscopeRes.ok) continue;
    const chartUnknown = (await horoscopeRes.json()) as unknown;
    const chart = isRecord(chartUnknown) ? chartUnknown : {};
    const v = isRecord(chart.vimsottari) ? chart.vimsottari : null;
    if (!v || !Array.isArray(v.mahadasha) || !Array.isArray(v.bhukti) || !Array.isArray(v.antara)) continue;

    const perEvent: Array<Record<string, unknown>> = [];
    let total = 0;
    let count = 0;

    for (const le of input.lifeEvents) {
      const parsedAt = parseEventAtMs(le.at, placeResolved.tz);
      if (!parsedAt) continue;
      const { atMs, atIso } = parsedAt;
      const mahaId = findActiveLordByTime(v.mahadasha, atMs);
      const bhuktiId = findActiveLordByTime(v.bhukti, atMs);
      const antaraId = findActiveLordByTime(v.antara, atMs);
      const maha = mahaId == null ? null : getLordEn(mahaId);
      const bhuk = bhuktiId == null ? null : getLordEn(bhuktiId);
      const ant = antaraId == null ? null : getLordEn(antaraId);
      if (!maha || !bhuk) continue;

      const dashaVec = composeDasha(maha, bhuk, ant, ontology.planets, ontology.conjunctions);
      const evVec = ontology.events[le.type].dimensions;
      const score = cosine(evVec, dashaVec);
      total += score;
      count += 1;
      perEvent.push({ type: le.type, at: le.at, atIso, mahadasha: maha, bhukti: bhuk, antara: ant, score });
    }

    if (count === 0) continue;
    const avg = Math.round((total / count) * 10000) / 10000;
    results.push({
      candidateTob,
      deltaSeconds: ds,
      avgScore: avg,
      matchedEvents: perEvent,
      computedAt: new Date(now).toISOString(),
    });
  }

  results.sort((a, b) => {
    const d = Number(b.avgScore) - Number(a.avgScore);
    if (d !== 0) return d;
    // Stable tie-breaker: prefer smaller absolute delta, then earlier time string.
    const absA = Math.abs(Number(a.deltaSeconds));
    const absB = Math.abs(Number(b.deltaSeconds));
    if (absA !== absB) return absA - absB;
    return String(a.candidateTob).localeCompare(String(b.candidateTob));
  });
  const top = results.slice(0, input.topK ?? 5);

  return Response.json({
    input,
    resolvedPlace: placeResolved,
    candidatesEvaluated: results.length,
    topCandidates: top,
  });
}
