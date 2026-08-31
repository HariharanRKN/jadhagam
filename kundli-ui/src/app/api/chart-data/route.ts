import { readFile } from "node:fs/promises";
import { join } from "node:path";
import defaultChart from "@/data/defaultChart.json";

/**
 * Bootstrap chart JSON. Prefer the generated public file when present so a
 * `--write-ui-data` refresh is visible; otherwise serve the bundled snapshot
 * so the home charts never depend on a static-file fetch that can fail.
 */
export async function GET() {
  const candidates = [
    join(process.cwd(), "public", "chart-data.json"),
    join(process.cwd(), "..", "kundli-ui", "public", "chart-data.json"),
    "/app/web/public/chart-data.json",
  ];
  for (const path of candidates) {
    try {
      const text = await readFile(path, "utf8");
      JSON.parse(text);
      return new Response(text, {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=60",
        },
      });
    } catch {
      /* try the next path */
    }
  }
  return Response.json(defaultChart);
}
