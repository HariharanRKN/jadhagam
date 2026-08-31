import { existsSync } from "node:fs";
import { join } from "path";
import { runPython } from "@/lib/runPython";

const IS_PROD = process.env.NODE_ENV === "production";

function defaultHoroscopeRepoRoot() {
  return IS_PROD ? "/app" : join(process.cwd(), "..");
}

function resolveHoroscopeScript(repoRoot: string) {
  if (process.env.HOROSCOPE_SCRIPT) return process.env.HOROSCOPE_SCRIPT;
  const candidates = [
    join(repoRoot, "horoscope.py"),
    "/app/horoscope.py",
    join(process.cwd(), "..", "horoscope.py"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return IS_PROD ? "/app/horoscope.py" : join(process.cwd(), "..", "horoscope.py");
}

function resolvePython(repoRoot: string) {
  if (process.env.HOROSCOPE_PYTHON) return process.env.HOROSCOPE_PYTHON;
  const candidates = [
    join(repoRoot, ".venv", "bin", "python"),
    "/opt/venv/bin/python",
    "/opt/jadhagam-venv/bin/python",
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return "python3";
}

/**
 * Spawns local Python + PyJHora. Requires Python 3, Swiss Ephemeris, and jhora on the server.
 * Not supported on typical Vercel serverless (no bundled Python); use self-hosted Node or a separate API.
 */

function parseHoroscopeStdout(stdout: string): unknown {
  const lines = stdout.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line.startsWith("{")) continue;
    try {
      return JSON.parse(line) as unknown;
    } catch {
      continue;
    }
  }
  throw new Error("No JSON object found in Python stdout");
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validateBody(body: unknown): {
  name?: string;
  gender?: string;
  birth: { year: number; month: number; day: number; hour: number; minute: number; second: number };
  place: { name: string; lat: number; lng: number; tz: number };
  transit: string | null;
} {
  if (!isRecord(body)) throw new Error("Body must be a JSON object");
  const birth = body.birth;
  const place = body.place;
  if (!isRecord(birth) || !isRecord(place)) {
    throw new Error("birth and place must be objects");
  }
  const y = Number(birth.year);
  const mo = Number(birth.month);
  const d = Number(birth.day);
  const h = Number(birth.hour ?? 0);
  const mi = Number(birth.minute ?? 0);
  const s = Number(birth.second ?? 0);
  if (![y, mo, d, h, mi, s].every((n) => Number.isFinite(n))) {
    throw new Error("Invalid birth numbers");
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31) {
    throw new Error("birth month/day out of range");
  }
  if (h < 0 || h > 23 || mi < 0 || mi > 59 || s < 0 || s > 59) {
    throw new Error("birth time out of range");
  }
  const lat = Number(place.lat);
  const lng = Number(place.lng);
  const tz = Number(place.tz);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error("latitude must be between -90 and 90");
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error("longitude must be between -180 and 180");
  }
  if (!Number.isFinite(tz) || tz < -12 || tz > 14) {
    throw new Error("timezone offset must be between -12 and 14");
  }
  const placeName = String(place.name ?? "").trim();
  if (!placeName) throw new Error("place.name is required");

  let transit: string | null = null;
  if (body.transit != null && body.transit !== "") {
    transit = String(body.transit);
  }

  let name: string | undefined;
  if (body.name != null && String(body.name).trim()) {
    name = String(body.name).trim().slice(0, 200);
  }
  let gender: string | undefined;
  if (body.gender != null && String(body.gender).trim()) {
    gender = String(body.gender).trim().slice(0, 64);
  }

  return {
    name,
    gender,
    birth: { year: y, month: mo, day: d, hour: h, minute: mi, second: s },
    place: { name: placeName, lat, lng, tz },
    transit,
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let payload: ReturnType<typeof validateBody>;
  try {
    payload = validateBody(body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Validation failed";
    return Response.json({ error: msg }, { status: 400 });
  }

  const repoRoot = defaultHoroscopeRepoRoot();
  const scriptPath = resolveHoroscopeScript(repoRoot);
  const pythonBin = resolvePython(repoRoot);

  const stdinObj: Record<string, unknown> = {
    birth: payload.birth,
    place: payload.place,
    transit: payload.transit,
  };
  if (payload.name) stdinObj.name = payload.name;
  if (payload.gender) stdinObj.gender = payload.gender;

  const stdinJson = JSON.stringify(stdinObj);

  const result = await runPython({
    args: [pythonBin, scriptPath, "--stdin-ui"],
    cwd: repoRoot,
    input: stdinJson,
    timeoutMs: 90_000,
  });

  if (!result.ok) {
    const hint = result.stderr.trim().slice(0, 2000);
    return Response.json(
      {
        error: "Horoscope engine failed",
        detail: hint || `exit ${result.code}`,
      },
      { status: 500 }
    );
  }

  try {
    const data = parseHoroscopeStdout(result.stdout);
    return Response.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Parse error";
    return Response.json(
      {
        error: msg,
        detail: result.stdout.slice(0, 500),
      },
      { status: 500 }
    );
  }
}
