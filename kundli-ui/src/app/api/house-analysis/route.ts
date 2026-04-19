import { buildAllHouseAnalyses } from "@/lib/prediction/house-analysis";
import type { ChartDataPayload } from "@/types/chartData";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isChartDataPayload(v: unknown): v is ChartDataPayload {
  if (!isRecord(v)) return false;
  if (!isRecord(v.birth) || !isRecord(v.transit) || !Array.isArray(v.natalPlanets)) return false;
  if (!isRecord(v.vimsottari)) return false;
  return typeof v.birth.ascendantRasi === "number";
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isChartDataPayload(body)) {
    return Response.json(
      { error: "Body must be a ChartDataPayload from /api/horoscope" },
      { status: 400 }
    );
  }

  return Response.json(buildAllHouseAnalyses(body));
}
