import {
  deleteKundali,
  getKundali,
  patchKundali,
} from "@/lib/kundalis/store";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const kundali = await getKundali(id);
  if (!kundali) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ kundali });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Body must be a JSON object" }, { status: 400 });
  }
  const rec = body as Record<string, unknown>;
  const patch: { family?: boolean; name?: string | null; gender?: string | null } =
    {};
  if ("family" in rec) patch.family = Boolean(rec.family);
  if ("name" in rec) {
    patch.name = rec.name == null ? null : String(rec.name);
  }
  if ("gender" in rec) {
    patch.gender = rec.gender == null ? null : String(rec.gender);
  }

  try {
    const updated = await patchKundali(id, patch);
    if (!updated) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json({ kundali: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const ok = await deleteKundali(id);
  if (!ok) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
