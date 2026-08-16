import type { SavedKundaliInput } from "./types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function validateKundaliInput(body: unknown): SavedKundaliInput {
  if (!isRecord(body)) throw new Error("Body must be a JSON object");
  const birth = body.birth;
  const place = body.place;
  if (!isRecord(birth) || !isRecord(place)) {
    throw new Error("birth and place must be objects");
  }
  const y = Number(birth.year);
  const mo = Number(birth.month);
  const d = Number(birth.day);
  const h = Number(birth.hour ?? 0);
  const mi = Number(birth.minute ?? 0);
  const s = Number(birth.second ?? 0);
  if (![y, mo, d, h, mi, s].every((n) => Number.isFinite(n))) {
    throw new Error("Invalid birth numbers");
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31) {
    throw new Error("birth month/day out of range");
  }
  if (h < 0 || h > 23 || mi < 0 || mi > 59 || s < 0 || s > 59) {
    throw new Error("birth time out of range");
  }
  const lat = Number(place.lat);
  const lng = Number(place.lng);
  const tz = Number(place.tz);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error("latitude must be between -90 and 90");
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error("longitude must be between -180 and 180");
  }
  if (!Number.isFinite(tz) || tz < -12 || tz > 14) {
    throw new Error("timezone offset must be between -12 and 14");
  }
  const placeName = String(place.name ?? "").trim();
  if (!placeName) throw new Error("place.name is required");

  const input: SavedKundaliInput = {
    birth: { year: y, month: mo, day: d, hour: h, minute: mi, second: s },
    place: { name: placeName, lat, lng, tz },
  };
  if (typeof body.id === "string" && body.id.trim()) {
    input.id = body.id.trim();
  }
  if (body.family != null) input.family = Boolean(body.family);
  if (body.name != null && String(body.name).trim()) {
    input.name = String(body.name).trim().slice(0, 200);
  }
  if (body.gender != null && String(body.gender).trim()) {
    input.gender = String(body.gender).trim().slice(0, 64);
  }
  return input;
}
