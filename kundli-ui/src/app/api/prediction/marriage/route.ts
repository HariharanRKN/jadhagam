import { buildMarriagePrediction } from "@/lib/prediction/events";
import type { MarriageLang } from "@/lib/prediction/events/marriageLocale";
import type { ChartDataPayload } from "@/types/chartData";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isChartDataPayload(v: unknown): v is ChartDataPayload {
  if (!isRecord(v)) return false;
  if (!isRecord(v.birth) || !isRecord(v.transit) || !Array.isArray(v.natalPlanets)) return false;
  if (!Array.isArray(v.transitPlanets) || !isRecord(v.vimsottari)) return false;
  return typeof v.birth.ascendantRasi === "number";
}

function parseLanguage(v: unknown): MarriageLang {
  return v === "ta" ? "ta" : "en";
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let chart: ChartDataPayload;
  let language: MarriageLang = "en";

  if (isChartDataPayload(body)) {
    chart = body;
  } else if (isRecord(body) && isChartDataPayload(body.chart)) {
    chart = body.chart as ChartDataPayload;
    language = parseLanguage(body.language);
  } else {
    return Response.json(
      { error: "Body must be ChartDataPayload or { chart, language?: \"en\"|\"ta\" }" },
      { status: 400 }
    );
  }

  return Response.json(buildMarriagePrediction(chart, language));
}
