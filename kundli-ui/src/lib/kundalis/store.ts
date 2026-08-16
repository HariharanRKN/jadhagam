import { mkdir, readFile, rename, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { randomUUID } from "crypto";
import type { SavedKundali, SavedKundaliInput } from "./types";

const IS_PROD = process.env.NODE_ENV === "production";

function storePath() {
  return (
    process.env.KUNDALI_STORE_PATH ??
    (IS_PROD
      ? "/app/data/saved_kundalis.json"
      : join(process.cwd(), "..", "data", "saved_kundalis.json"))
  );
}

type StoreFile = {
  kundalis: SavedKundali[];
};

let writeChain: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asBirth(v: unknown): SavedKundali["birth"] | null {
  if (!isRecord(v)) return null;
  const year = Number(v.year);
  const month = Number(v.month);
  const day = Number(v.day);
  const hour = Number(v.hour ?? 0);
  const minute = Number(v.minute ?? 0);
  const second = Number(v.second ?? 0);
  if (![year, month, day, hour, minute, second].every((n) => Number.isFinite(n))) {
    return null;
  }
  return { year, month, day, hour, minute, second };
}

function asPlace(v: unknown): SavedKundali["place"] | null {
  if (!isRecord(v)) return null;
  const name = String(v.name ?? "").trim();
  const lat = Number(v.lat);
  const lng = Number(v.lng);
  const tz = Number(v.tz);
  if (!name || ![lat, lng, tz].every((n) => Number.isFinite(n))) return null;
  return { name, lat, lng, tz };
}

function parseStore(raw: string): StoreFile {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || !Array.isArray(parsed.kundalis)) {
      return { kundalis: [] };
    }
    const kundalis: SavedKundali[] = [];
    for (const item of parsed.kundalis) {
      if (!isRecord(item)) continue;
      const birth = asBirth(item.birth);
      const place = asPlace(item.place);
      if (!birth || !place || typeof item.id !== "string") continue;
      kundalis.push({
        id: item.id,
        family: Boolean(item.family),
        name: item.name == null || item.name === "" ? null : String(item.name),
        gender:
          item.gender == null || item.gender === "" ? null : String(item.gender),
        birth,
        place,
        createdAt:
          typeof item.createdAt === "string"
            ? item.createdAt
            : new Date().toISOString(),
        updatedAt:
          typeof item.updatedAt === "string"
            ? item.updatedAt
            : new Date().toISOString(),
      });
    }
    return { kundalis };
  } catch {
    return { kundalis: [] };
  }
}

async function readStore(): Promise<StoreFile> {
  try {
    const raw = await readFile(storePath(), "utf8");
    return parseStore(raw);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { kundalis: [] };
    throw err;
  }
}

async function writeStore(store: StoreFile) {
  const path = storePath();
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  await rename(tmp, path);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function fingerprint(input: {
  name?: string | null;
  birth: SavedKundali["birth"];
  place: SavedKundali["place"];
}) {
  const name = (input.name ?? "").trim().toLowerCase();
  const { year, month, day, hour, minute } = input.birth;
  const lat = input.place.lat.toFixed(4);
  const lng = input.place.lng.toFixed(4);
  return `${name}|${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}|${lat},${lng}`;
}

export async function listKundalis(filter?: { family?: boolean }) {
  const store = await readStore();
  const items = store.kundalis
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (filter?.family === true) {
    return items.filter((item) => item.family);
  }
  return items;
}

export async function getKundali(id: string) {
  const store = await readStore();
  return store.kundalis.find((item) => item.id === id) ?? null;
}

export async function upsertKundali(input: SavedKundaliInput): Promise<SavedKundali> {
  return withLock(async () => {
    const store = await readStore();
    const now = new Date().toISOString();
    const name = input.name?.trim() ? input.name.trim().slice(0, 200) : null;
    const gender = input.gender?.trim()
      ? input.gender.trim().slice(0, 64)
      : null;
    const family = Boolean(input.family);
    const print = fingerprint({ name, birth: input.birth, place: input.place });

    let existing: SavedKundali | undefined;
    if (input.id) {
      existing = store.kundalis.find((item) => item.id === input.id);
    }
    if (!existing) {
      existing = store.kundalis.find(
        (item) => fingerprint(item) === print
      );
    }

    if (existing) {
      const updated: SavedKundali = {
        ...existing,
        family,
        name,
        gender,
        birth: input.birth,
        place: input.place,
        updatedAt: now,
      };
      store.kundalis = store.kundalis.map((item) =>
        item.id === existing!.id ? updated : item
      );
      await writeStore(store);
      return updated;
    }

    const created: SavedKundali = {
      id: randomUUID(),
      family,
      name,
      gender,
      birth: input.birth,
      place: input.place,
      createdAt: now,
      updatedAt: now,
    };
    store.kundalis.unshift(created);
    await writeStore(store);
    return created;
  });
}

export async function patchKundali(
  id: string,
  patch: { family?: boolean; name?: string | null; gender?: string | null }
) {
  return withLock(async () => {
    const store = await readStore();
    const existing = store.kundalis.find((item) => item.id === id);
    if (!existing) return null;
    const updated: SavedKundali = {
      ...existing,
      family: patch.family ?? existing.family,
      name:
        patch.name === undefined
          ? existing.name
          : patch.name?.trim()
            ? patch.name.trim().slice(0, 200)
            : null,
      gender:
        patch.gender === undefined
          ? existing.gender
          : patch.gender?.trim()
            ? patch.gender.trim().slice(0, 64)
            : null,
      updatedAt: new Date().toISOString(),
    };
    store.kundalis = store.kundalis.map((item) =>
      item.id === id ? updated : item
    );
    await writeStore(store);
    return updated;
  });
}

export async function deleteKundali(id: string) {
  return withLock(async () => {
    const store = await readStore();
    const before = store.kundalis.length;
    store.kundalis = store.kundalis.filter((item) => item.id !== id);
    if (store.kundalis.length === before) return false;
    await writeStore(store);
    return true;
  });
}
