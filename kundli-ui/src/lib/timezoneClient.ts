/** Uses same-origin `/api/timezone` (timeapi.io on the server). */
export async function fetchUtcOffsetHours(
  lat: number,
  lng: number
): Promise<number | null> {
  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
    });
    const res = await fetch(`/api/timezone?${params}`);
    const data = (await res.json()) as { offsetHours?: number; error?: string };
    if (
      !res.ok ||
      typeof data.offsetHours !== "number" ||
      !Number.isFinite(data.offsetHours)
    ) {
      return null;
    }
    return data.offsetHours;
  } catch {
    return null;
  }
}
