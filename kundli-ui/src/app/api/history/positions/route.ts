import { join } from "path";
import { loadSkyRange } from "@/lib/history/readRange";
import { runPython } from "@/lib/runPython";

const IS_PROD = process.env.NODE_ENV === "production";

function scriptPath() {
  return process.env.HISTORY_DB_SCRIPT ??
    (IS_PROD
      ? "/app/scripts/history_db.py"
      : join(process.cwd(), "..", "scripts", "history_db.py"));
}

function pythonBin() {
  return process.env.HISTORY_DB_PYTHON ?? process.env.HOROSCOPE_PYTHON ?? "python3";
}

function dbPath() {
  return process.env.HISTORY_DB_PATH ??
    (IS_PROD
      ? "/app/data/planet_positions.sqlite"
      : join(process.cwd(), "..", "data", "planet_positions.sqlite"));
}

async function runHistoryCommand(args: string[]) {
  const script = scriptPath();
  const cwd = IS_PROD ? "/app" : join(process.cwd(), "..");
  const py = pythonBin();
  return runPython({
    args: [py, script, "--db", dbPath(), ...args],
    cwd,
    timeoutMs: 30_000,
  });
}

function parseLastJsonObject(stdout: string): unknown {
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
  throw new Error("No JSON object found in history command output");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start")?.trim();
  const end = searchParams.get("end")?.trim();
  if (start || end) {
    if (!start || !end || !/^\d{4}-\d{2}-\d{2}/.test(start) || !/^\d{4}-\d{2}-\d{2}/.test(end)) {
      return Response.json({ error: "start and end dates are required" }, { status: 400 });
    }
    try {
      const range = await loadSkyRange(start, end, searchParams.get("focus"));
      return Response.json(range);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "range lookup failed";
      return Response.json({ error: "Historical range lookup failed", detail }, { status: 500 });
    }
  }

  const date = searchParams.get("date")?.trim();
  if (!date) {
    return Response.json({ error: "date is required" }, { status: 400 });
  }

  const result = await runHistoryCommand(["position-on-date", "--date", date]);
  if (!result.ok) {
    return Response.json(
      {
        error: "Historical position lookup failed",
        detail: result.stderr.trim() || `exit ${result.code}`,
      },
      { status: 500 }
    );
  }

  try {
    return Response.json(parseLastJsonObject(result.stdout));
  } catch {
    return Response.json(
      { error: "Invalid history DB response", detail: result.stdout.slice(0, 500) },
      { status: 500 }
    );
  }
}
