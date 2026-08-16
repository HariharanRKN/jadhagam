import type { SavedKundali } from "@/lib/kundalis/types";

export type BirthFormValues = {
  id?: string;
  name: string;
  gender: string;
  birthDate: string;
  birthTime: string;
  placeName: string;
  lat: string;
  lng: string;
  tz: string;
  family: boolean;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function savedKundaliToFormValues(item: SavedKundali): BirthFormValues {
  const { birth, place } = item;
  return {
    id: item.id,
    name: item.name ?? "",
    gender: item.gender ?? "",
    birthDate: `${birth.year}-${pad2(birth.month)}-${pad2(birth.day)}`,
    birthTime: `${pad2(birth.hour)}:${pad2(birth.minute)}`,
    placeName: place.name,
    lat: String(place.lat),
    lng: String(place.lng),
    tz: String(place.tz),
    family: item.family,
  };
}

export function formValuesToSavePayload(values: BirthFormValues) {
  const [y, mo, d] = values.birthDate.split("-").map(Number);
  const [hh, mm] = values.birthTime.split(":").map(Number);
  return {
    id: values.id,
    family: values.family,
    name: values.name.trim() || undefined,
    gender: values.gender || undefined,
    birth: {
      year: y,
      month: mo,
      day: d,
      hour: hh,
      minute: mm,
      second: 0,
    },
    place: {
      name: values.placeName.trim(),
      lat: parseFloat(values.lat),
      lng: parseFloat(values.lng),
      tz: parseFloat(values.tz),
    },
  };
}

export function formatSavedKundaliLabel(item: SavedKundali) {
  const title = item.name?.trim() || "Unnamed";
  const { birth } = item;
  const date = `${birth.year}-${pad2(birth.month)}-${pad2(birth.day)}`;
  const time = `${pad2(birth.hour)}:${pad2(birth.minute)}`;
  return `${title} · ${date} ${time} · ${item.place.name}`;
}
