import { spawn } from "node:child_process";

export type PythonRunResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
};

type RunPythonOptions = {
  args: string[];
  cwd: string;
  input?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
};

/**
 * Render free instances have 512MB. Each PyJHora spawn can take hundreds of MB,
 * so never overlap two Python engines in this Node process.
 */
let queue: Promise<void> = Promise.resolve();

export function runPython(options: RunPythonOptions): Promise<PythonRunResult> {
  const job = () => spawnOnce(options);
  const pending = queue.then(job, job);
  queue = pending.then(
    () => undefined,
    () => undefined
  );
  return pending;
}

function spawnOnce(options: RunPythonOptions): Promise<PythonRunResult> {
  const timeoutMs = options.timeoutMs ?? 90_000;
  return new Promise((resolve) => {
    const child = spawn(options.args[0], options.args.slice(1), {
      cwd: options.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: options.env ?? { ...process.env },
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (ok: boolean, code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok, stdout, stderr, code });
    };
    const timer = setTimeout(() => {
      stderr += `\npython timed out after ${timeoutMs}ms`;
      child.kill("SIGKILL");
      finish(false, -1);
    }, timeoutMs);
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
    if (options.input) child.stdin?.write(options.input, "utf8");
    child.stdin?.end();
  });
}
