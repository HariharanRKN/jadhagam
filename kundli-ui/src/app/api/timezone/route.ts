import type { NextRequest } from "next/server";

/**
 * Resolves UTC offset (hours) for coordinates via timeapi.io (server-side; no Google).
 */
export async function GET(request: NextRequest) {
  const latS = request.nextUrl.searchParams.get("lat");
  const lngS = request.nextUrl.searchParams.get("lng");
  if (latS == null || lngS == null) {
    return Response.json({ error: "lat and lng required" }, { status: 400 });
  }
  const lat = Number(latS);
  const lng = Number(lngS);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ error: "invalid coordinates" }, { status: 400 });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return Response.json({ error: "coordinates out of range" }, { status: 400 });
  }

  const url = new URL("https://timeapi.io/api/TimeZone/coordinate");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
      return Response.json({ error: "timezone lookup failed" }, { status: 502 });
    }
    const data = (await res.json()) as {
      currentUtcOffset?: { seconds?: number };
    };
    const seconds = data.currentUtcOffset?.seconds;
    if (typeof seconds !== "number" || !Number.isFinite(seconds)) {
      return Response.json({ error: "no offset in response" }, { status: 502 });
    }
    return Response.json({ offsetHours: seconds / 3600 });
  } catch {
    return Response.json({ error: "timezone unreachable" }, { status: 502 });
  }
}
