import { listKundalis, upsertKundali } from "@/lib/kundalis/store";
import { validateKundaliInput } from "@/lib/kundalis/validate";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const family = searchParams.get("family");
  const items = await listKundalis(
    family === "1" || family === "true" ? { family: true } : undefined
  );
  return Response.json({ kundalis: items });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let input;
  try {
    input = validateKundaliInput(body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Validation failed";
    return Response.json({ error: msg }, { status: 400 });
  }

  try {
    const saved = await upsertKundali(input);
    return Response.json({ kundali: saved });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Save failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}
