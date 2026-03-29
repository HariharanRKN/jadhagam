import type { NextRequest } from "next/server";

/** Default public demo server; for heavy use host your own — see https://github.com/komoot/photon */
const DEFAULT_PHOTON = "https://photon.komoot.io";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return Response.json({ features: [] as unknown[] });
  }

  const rawLimit = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(rawLimit)
    ? Math.min(15, Math.max(1, Math.floor(rawLimit)))
    : 8;

  const base = (process.env.PHOTON_API_URL ?? DEFAULT_PHOTON).replace(/\/$/, "");
  const url = `${base}/api/?q=${encodeURIComponent(q)}&limit=${limit}&lang=en`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return Response.json(
        { error: "Photon request failed", features: [] },
        { status: 502 }
      );
    }
    const data = (await res.json()) as { features?: unknown[] };
    return Response.json({ features: data.features ?? [] });
  } catch {
    return Response.json(
      { error: "Photon unreachable", features: [] },
      { status: 502 }
    );
  }
}
