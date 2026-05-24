import type { NextRequest } from "next/server";
import { spawn } from "child_process";
import { join } from "path";

type BirthInput = {
  dob: string; // YYYY-MM-DD
  tob: string; // HH:MM or HH:MM:SS (local time)
  place: string; // free text
  event?: string;
  events?: string[];
  mode?: "now" | "timeline";
  limit?: number;
};

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: { name?: string; city?: string; country?: string; state?: string };
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseBirthInput(body: unknown): BirthInput {
  if (!isRecord(body)) throw new Error("Body must be a JSON object");
  const dob = String(body.dob ?? "").trim();
  const tob = String(body.tob ?? "").trim();
  const place = String(body.place ?? "").trim();
  if (!dob) throw new Error("dob is required (YYYY-MM-DD)");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) throw new Error("dob must be YYYY-MM-DD");
  if (!tob) throw new Error("tob is required (HH:MM or HH:MM:SS)");
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(tob)) throw new Error("tob must be HH:MM or HH:MM:SS");
  if (!place) throw new Error("place is required");

  const out: BirthInput = { dob, tob, place };
  if (typeof body.event === "string" && body.event.trim()) out.event = body.event.trim();
  if (Array.isArray(body.events) && body.events.every((x) => typeof x === "string")) {
    out.events = body.events.map((s) => s.trim()).filter(Boolean);
  }
  if (body.mode === "timeline") out.mode = "timeline";
  if (body.mode === "now") out.mode = "now";
  if (typeof body.limit === "number" && Number.isFinite(body.limit)) {
    out.limit = Math.max(1, Math.min(200, Math.floor(body.limit)));
  }
  return out;
}

function parseDobTob(dob: string, tob: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const [y, m, d] = dob.split("-").map((x) => Number(x));
  const parts = tob.split(":").map((x) => Number(x));
  const [hh, mm, ss] = [parts[0], parts[1], parts[2] ?? 0];
  if (![y, m, d, hh, mm, ss].every((n) => Number.isFinite(n))) throw new Error("invalid dob/tob");
  return { year: y, month: m, day: d, hour: hh, minute: mm, second: ss };
}

function defaultRepoRoot() {
  return process.env.NODE_ENV === "production" ? "/app" : join(process.cwd(), "..");
}

function getLordEn(lordId: number): string | null {
  const m: Record<number, string> = {
    0: "Sun",
    1: "Moon",
    2: "Mars",
    3: "Mercury",
    4: "Jupiter",
    5: "Venus",
    6: "Saturn",
    7: "Rahu",
    8: "Ketu",
  };
  return m[lordId] ?? null;
}

function parseDateMaybe(s: string | null): number | null {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

function findActiveLord<T extends { lord: number; start: string; end: string | null }>(
  rows: T[],
  nowMs: number
): number | null {
  for (const r of rows) {
    const startMs = parseDateMaybe(r.start);
    const endMs = parseDateMaybe(r.end);
    if (startMs == null) continue;
    const afterStart = nowMs >= startMs;
    const beforeEnd = endMs == null ? true : nowMs < endMs;
    if (afterStart && beforeEnd) return r.lord;
  }
  return null;
}

function isAntaraRow(v: unknown): v is { maha: number; bhukti: number; lord: number; start: string; end: string | null } {
  if (!isRecord(v)) return false;
  return typeof v.maha === "number" && typeof v.bhukti === "number" && typeof v.lord === "number" && typeof v.start === "string";
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

async function runSemanticPython(payload: Record<string, unknown>): Promise<unknown> {
  const repoRoot = defaultRepoRoot();
  const pythonBin = process.env.HOROSCOPE_PYTHON ?? "python3";
  const semanticCwd = join(repoRoot, "semantic");
  const env = { ...process.env, PYTHONPATH: `${semanticCwd}${process.env.PYTHONPATH ? `:${process.env.PYTHONPATH}` : ""}` };

  const stdinJson = JSON.stringify(payload);
  const result = await new Promise<{ ok: boolean; stdout: string; stderr: string; code: number | null }>((resolve) => {
    const child = spawn(pythonBin, ["-m", "semantic_engine.semantic_api"], {
      cwd: semanticCwd,
      stdio: ["pipe", "pipe", "pipe"],
      env,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (ok: boolean, code: number | null) => {
      if (settled) return;
      settled = true;
      resolve({ ok, stdout, stderr, code });
    };
    child.stdout?.on("data", (c: Buffer) => (stdout += c.toString("utf8")));
    child.stderr?.on("data", (c: Buffer) => (stderr += c.toString("utf8")));
    child.on("close", (code) => finish(code === 0, code));
    child.on("error", (err) => {
      stderr += String(err);
      finish(false, -1);
    });
    child.stdin?.write(stdinJson, "utf8");
    child.stdin?.end();
  });

  if (!result.ok) {
    throw new Error((result.stderr || `semantic python failed (exit ${result.code})`).slice(0, 2000));
  }
  return JSON.parse(result.stdout);
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let input: BirthInput;
  try {
    input = parseBirthInput(body);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Validation failed" }, { status: 400 });
  }

  try {
    const birth = parseDobTob(input.dob, input.tob);
    const place = await photonLookup(input.place);
    const tz = await timezoneLookup(place.lat, place.lng);

    // Reuse existing horoscope contract by calling the internal /api/horoscope route via python directly is hard
    // (it already spawns python). Instead, we call horoscope.py via the existing /api/horoscope endpoint.
    // Here, we just reconstruct the same payload and call that endpoint from the server.
    const horoscopeRes = await fetch(new URL("/api/horoscope", request.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ birth, place: { name: place.name, lat: place.lat, lng: place.lng, tz }, transit: null }),
    });
    if (!horoscopeRes.ok) {
      const detail = (await horoscopeRes.json().catch(() => ({}))) as Record<string, unknown>;
      return Response.json({ error: "horoscope failed", detail }, { status: 502 });
    }
    const chartUnknown = (await horoscopeRes.json()) as unknown;
    const chart = isRecord(chartUnknown) ? chartUnknown : {};
    const v = isRecord(chart.vimsottari) ? chart.vimsottari : null;
    if (!v || !Array.isArray(v.mahadasha) || !Array.isArray(v.bhukti) || !Array.isArray(v.antara)) {
      return Response.json({ error: "horoscope response missing vimsottari dashas" }, { status: 502 });
    }

    const nowMs = Date.now();
    const mahaId = findActiveLord(v.mahadasha, nowMs);
    const bhuktiId = findActiveLord(v.bhukti, nowMs);
    const antaraId = findActiveLord(v.antara, nowMs);

    const mahadasha = mahaId == null ? null : getLordEn(mahaId);
    const bhukti = bhuktiId == null ? null : getLordEn(bhuktiId);
    const antara = antaraId == null ? null : getLordEn(antaraId);

    if (!mahadasha || !bhukti) {
      return Response.json({ error: "could not determine current mahadasha/bhukti" }, { status: 502 });
    }

    const mode = input.mode ?? "now";
    let semantic: unknown;
    if (mode === "timeline") {
      if (!input.event) {
        return Response.json({ error: "event is required for mode=timeline" }, { status: 400 });
      }
      const antaraRows = Array.isArray(v.antara) ? v.antara.filter(isAntaraRow) : [];
      const future = antaraRows
        .map((r) => {
          const startMs = parseDateMaybe(r.start);
          return { r, startMs };
        })
        .filter((x) => x.startMs != null && (x.startMs as number) >= nowMs)
        .sort((a, b) => (a.startMs as number) - (b.startMs as number))
        .slice(0, Math.max(25, input.limit ?? 60));

      const periods: Array<Record<string, unknown>> = [];
      for (const { r } of future) {
        const maha = getLordEn(r.maha);
        const bhuk = getLordEn(r.bhukti);
        const ant = getLordEn(r.lord);
        if (!maha || !bhuk) continue;
        periods.push({ start: r.start, end: r.end, mahadasha: maha, bhukti: bhuk, antara: ant });
      }

      semantic = await runSemanticPython({
        event: input.event,
        periods,
        limit: input.limit ?? 20,
        includeVectors: false,
      });
    } else {
      const semanticPayload: Record<string, unknown> = { mahadasha, bhukti };
      if (antara) semanticPayload.antara = antara;
      if (input.event) semanticPayload.event = input.event;
      if (input.events) semanticPayload.events = input.events;
      semantic = await runSemanticPython(semanticPayload);
    }

    return Response.json({
      input,
      resolved: { birth, place: { ...place, tz } },
      activeDasha: { mahadasha, bhukti, antara },
      semantic,
      chart,
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "semantic failed" }, { status: 500 });
  }
}
