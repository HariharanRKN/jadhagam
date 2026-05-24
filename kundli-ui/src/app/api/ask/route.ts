import type { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

type AskBody = {
  dob: string;
  tob: string;
  place: string;
  questionText: string;
  category?: "Marriage" | "Relationship" | "Work" | "Money" | "Family";
  eventOverride?: string;
  mode?: "now" | "timeline";
  limit?: number;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseAskBody(body: unknown): AskBody {
  if (!isRecord(body)) throw new Error("Body must be a JSON object");
  const dob = String(body.dob ?? "").trim();
  const tob = String(body.tob ?? "").trim();
  const place = String(body.place ?? "").trim();
  const questionText = String(body.questionText ?? "").trim();
  const categoryRaw = body.category;
  const eventOverride = typeof body.eventOverride === "string" ? body.eventOverride.trim() : "";
  const modeRaw = body.mode;
  const limitRaw = body.limit;

  if (!dob) throw new Error("dob is required (YYYY-MM-DD)");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) throw new Error("dob must be YYYY-MM-DD");
  if (!tob) throw new Error("tob is required (HH:MM or HH:MM:SS)");
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(tob)) throw new Error("tob must be HH:MM or HH:MM:SS");
  if (!place) throw new Error("place is required");
  if (!questionText) throw new Error("questionText is required");

  const allowedCategories = new Set(["Marriage", "Relationship", "Work", "Money", "Family"]);
  const category =
    typeof categoryRaw === "string" && allowedCategories.has(categoryRaw) ? (categoryRaw as AskBody["category"]) : undefined;

  const mode = modeRaw === "now" || modeRaw === "timeline" ? modeRaw : undefined;
  const limit =
    typeof limitRaw === "number" && Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.floor(limitRaw))) : undefined;

  return { dob, tob, place, questionText, category, eventOverride: eventOverride || undefined, mode, limit };
}

function defaultRepoRoot() {
  return process.env.NODE_ENV === "production" ? "/app" : join(process.cwd(), "..");
}

async function loadEventKeys(): Promise<string[]> {
  const repoRoot = defaultRepoRoot();
  const eventsPath = join(repoRoot, "semantic", "semantic_engine", "ontology", "events.json");
  const raw = await readFile(eventsPath, "utf8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  return Object.keys(parsed).sort();
}

async function geminiChooseEvent(params: {
  questionText: string;
  category?: string;
  eventKeys: string[];
}): Promise<{ event: string; confidence: number; rationale: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const systemInstruction =
    "You map user astrology questions to one event key from a fixed allowlist. " +
    "Return ONLY JSON with keys: event (string), confidence (number 0..1), rationale (string). " +
    "event MUST be one of the provided event_keys. Do not invent new keys.";

  const userText =
    `category_hint: ${params.category ?? ""}\n` +
    `event_keys: ${params.eventKeys.join(", ")}\n` +
    `question: ${params.questionText}\n`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
    apiKey
  )}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: userText }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 256 },
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Gemini failed: ${res.status} ${txt.slice(0, 400)}`);
  }

  const data = (await res.json()) as unknown;
  const obj = isRecord(data) ? data : {};
  const candidates = Array.isArray(obj.candidates) ? obj.candidates : [];
  const c0 = isRecord(candidates[0]) ? candidates[0] : {};
  const content = isRecord(c0.content) ? c0.content : {};
  const parts = Array.isArray(content.parts) ? content.parts : [];
  const text =
    parts
      .map((p) => (isRecord(p) && typeof p.text === "string" ? p.text : ""))
      .join("")
      .trim() ?? "";

  // Gemini sometimes wraps JSON in markdown fences like ```json ... ```, or includes
  // extra prose around it. Extract the first JSON object we can find.
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const unfenced = (fenceMatch ? fenceMatch[1] : text).trim();
  const objectMatch = unfenced.match(/\{[\s\S]*\}/);
  const jsonText = (objectMatch ? objectMatch[0] : unfenced).trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    // Include a small snippet for debugging (avoid dumping huge text).
    const snippet = text.slice(0, 600).replace(/\s+/g, " ").trim();
    throw new Error(`Gemini response was not valid JSON. snippet=${snippet}`);
  }

  const parsedObj = isRecord(parsed) ? parsed : {};
  const event = typeof parsedObj.event === "string" ? parsedObj.event : "";
  const confidence = typeof parsedObj.confidence === "number" ? parsedObj.confidence : 0;
  const rationale = typeof parsedObj.rationale === "string" ? parsedObj.rationale : "";

  if (!event || !params.eventKeys.includes(event)) {
    throw new Error("Gemini returned an event outside allowlist");
  }

  return { event, confidence: Math.max(0, Math.min(1, confidence)), rationale: rationale.slice(0, 600) };
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let input: AskBody;
  try {
    input = parseAskBody(body);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Validation failed" }, { status: 400 });
  }

  let eventKeys: string[];
  try {
    eventKeys = await loadEventKeys();
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Failed to load event keys" }, { status: 500 });
  }

  let chosen: { event: string; confidence: number; rationale: string } | null = null;
  if (input.eventOverride && eventKeys.includes(input.eventOverride)) {
    chosen = { event: input.eventOverride, confidence: 1, rationale: "eventOverride" };
  } else {
    try {
      chosen = await geminiChooseEvent({
        questionText: input.questionText,
        category: input.category,
        eventKeys,
      });
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "Gemini mapping failed" }, { status: 502 });
    }
  }

  try {
    const semanticRes = await fetch(new URL("/api/semantic", request.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dob: input.dob,
        tob: input.tob,
        place: input.place,
        event: chosen.event,
        mode: input.mode ?? "timeline",
        limit: input.limit ?? 20,
      }),
    });
    const semanticJson = await semanticRes.json().catch(() => ({}));
    if (!semanticRes.ok) {
      return Response.json({ error: "semantic failed", detail: semanticJson }, { status: 502 });
    }

    return Response.json({
      input: { dob: input.dob, tob: input.tob, place: input.place, questionText: input.questionText, category: input.category },
      chosen,
      semantic: semanticJson,
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Ask failed" }, { status: 500 });
  }
}
