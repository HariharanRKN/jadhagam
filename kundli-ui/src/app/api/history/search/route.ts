import { spawn } from "child_process";
import { join } from "path";

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

  return await new Promise<{ ok: boolean; stdout: string; stderr: string; code: number | null }>((resolve) => {
    const child = spawn(py, [script, "--db", dbPath(), ...args], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (ok: boolean, code: number | null) => {
      if (settled) return;
      settled = true;
      resolve({ ok, stdout, stderr, code });
    };
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("close", (code) => finish(code === 0, code));
    child.on("error", (err) => {
      stderr += String(err);
      finish(false, -1);
    });
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
  const planets = searchParams.getAll("planet").map((value) => value.trim()).filter(Boolean);
  const rasi = searchParams.get("rasi")?.trim();
  const startDate = searchParams.get("startDate")?.trim();
  const endDate = searchParams.get("endDate")?.trim();

  if (!planets.length) {
    return Response.json({ error: "At least one planet is required" }, { status: 400 });
  }
  if (!rasi || !startDate || !endDate) {
    return Response.json(
      { error: "rasi, startDate, and endDate are required" },
      { status: 400 }
    );
  }

  const args = ["search-rasi", "--rasi", rasi, "--start-date", startDate, "--end-date", endDate];
  for (const planet of planets) {
    args.push("--planet", planet);
  }

  const result = await runHistoryCommand(args);
  if (!result.ok) {
    return Response.json(
      {
        error: "Historical search failed",
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
