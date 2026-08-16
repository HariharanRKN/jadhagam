import { readFile, rename } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import type { SavedKundali, SavedKundaliInput } from "./types";
import {
  dbPath,
  initKundaliDb,
  type KundaliDb,
  type QueryRow,
} from "./db";

const IS_PROD = process.env.NODE_ENV === "production";

type KundaliRow = {
  id: string;
  family: number;
  name: string | null;
  gender: string | null;
  birth_year: number;
  birth_month: number;
  birth_day: number;
  birth_hour: number;
  birth_minute: number;
  birth_second: number;
  place_name: string;
  place_lat: number;
  place_lng: number;
  place_tz: number;
  fingerprint: string;
  created_at: string;
  updated_at: string;
};

let db: KundaliDb | null = null;
let opening: Promise<KundaliDb> | null = null;
let writeChain: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export { dbPath };

function jsonStorePath() {
  return (
    process.env.KUNDALI_STORE_PATH ??
    (IS_PROD
      ? "/var/data/saved_kundalis.json"
      : join(process.cwd(), "..", "data", "saved_kundalis.json"))
  );
}

function extraJsonMigratePaths() {
  const paths = [jsonStorePath()];
  if (IS_PROD) {
    paths.push("/app/data/saved_kundalis.json");
  }
  return [...new Set(paths)];
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

function parseJsonStore(raw: string): SavedKundali[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || !Array.isArray(parsed.kundalis)) return [];
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
    return kundalis;
  } catch {
    return [];
  }
}

function num(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function textOrNull(v: unknown) {
  if (v == null || v === "") return null;
  return String(v);
}

function asKundaliRow(row: QueryRow): KundaliRow {
  return {
    id: String(row.id),
    family: num(row.family),
    name: textOrNull(row.name),
    gender: textOrNull(row.gender),
    birth_year: num(row.birth_year),
    birth_month: num(row.birth_month),
    birth_day: num(row.birth_day),
    birth_hour: num(row.birth_hour),
    birth_minute: num(row.birth_minute),
    birth_second: num(row.birth_second),
    place_name: String(row.place_name ?? ""),
    place_lat: num(row.place_lat),
    place_lng: num(row.place_lng),
    place_tz: num(row.place_tz),
    fingerprint: String(row.fingerprint ?? ""),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function rowToKundali(row: KundaliRow): SavedKundali {
  return {
    id: row.id,
    family: Boolean(row.family),
    name: row.name,
    gender: row.gender,
    birth: {
      year: row.birth_year,
      month: row.birth_month,
      day: row.birth_day,
      hour: row.birth_hour,
      minute: row.birth_minute,
      second: row.birth_second,
    },
    place: {
      name: row.place_name,
      lat: row.place_lat,
      lng: row.place_lng,
      tz: row.place_tz,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const INSERT_SQL = `INSERT INTO kundalis (
        id, family, name, gender,
        birth_year, birth_month, birth_day, birth_hour, birth_minute, birth_second,
        place_name, place_lat, place_lng, place_tz,
        fingerprint, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const UPDATE_SQL = `UPDATE kundalis SET
        family = ?, name = ?, gender = ?,
        birth_year = ?, birth_month = ?, birth_day = ?,
        birth_hour = ?, birth_minute = ?, birth_second = ?,
        place_name = ?, place_lat = ?, place_lng = ?, place_tz = ?,
        fingerprint = ?, updated_at = ?
      WHERE id = ?`;

function insertArgs(item: SavedKundali) {
  return [
    item.id,
    item.family ? 1 : 0,
    item.name,
    item.gender,
    item.birth.year,
    item.birth.month,
    item.birth.day,
    item.birth.hour,
    item.birth.minute,
    item.birth.second,
    item.place.name,
    item.place.lat,
    item.place.lng,
    item.place.tz,
    fingerprint(item),
    item.createdAt,
    item.updatedAt,
  ];
}

function updateArgs(item: SavedKundali) {
  return [
    item.family ? 1 : 0,
    item.name,
    item.gender,
    item.birth.year,
    item.birth.month,
    item.birth.day,
    item.birth.hour,
    item.birth.minute,
    item.birth.second,
    item.place.name,
    item.place.lat,
    item.place.lng,
    item.place.tz,
    fingerprint(item),
    item.updatedAt,
    item.id,
  ];
}

async function migrateJsonIfNeeded(database: KundaliDb) {
  if (database.remote) return;
  const countRow = await database.get("SELECT COUNT(*) AS n FROM kundalis");
  if (num(countRow?.n) > 0) return;

  for (const path of extraJsonMigratePaths()) {
    let raw: string;
    try {
      raw = await readFile(path, "utf8");
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") continue;
      throw err;
    }
    const items = parseJsonStore(raw);
    if (items.length === 0) continue;
    for (const item of items) {
      try {
        await database.run(INSERT_SQL, insertArgs(item));
      } catch {
        /* skip duplicate ids/fingerprints from a messy JSON file */
      }
    }
    try {
      await rename(path, `${path}.migrated`);
    } catch {
      /* keep the JSON if rename is not allowed */
    }
    return;
  }
}

async function openDb(): Promise<KundaliDb> {
  if (db) return db;
  if (!opening) {
    opening = (async () => {
      const database = await initKundaliDb();
      await migrateJsonIfNeeded(database);
      db = database;
      return database;
    })().catch((err) => {
      opening = null;
      throw err;
    });
  }
  return opening;
}

async function getRowById(database: KundaliDb, id: string) {
  const row = await database.get("SELECT * FROM kundalis WHERE id = ?", [id]);
  return row ? asKundaliRow(row) : undefined;
}

async function getRowByFingerprint(database: KundaliDb, print: string) {
  const row = await database.get("SELECT * FROM kundalis WHERE fingerprint = ?", [
    print,
  ]);
  return row ? asKundaliRow(row) : undefined;
}

export async function listKundalis(filter?: { family?: boolean }) {
  const database = await openDb();
  const rows =
    filter?.family === true
      ? await database.all(
          "SELECT * FROM kundalis WHERE family = 1 ORDER BY updated_at DESC"
        )
      : await database.all("SELECT * FROM kundalis ORDER BY updated_at DESC");
  return rows.map((row) => rowToKundali(asKundaliRow(row)));
}

export async function getKundali(id: string) {
  const database = await openDb();
  const row = await getRowById(database, id);
  return row ? rowToKundali(row) : null;
}

export async function upsertKundali(input: SavedKundaliInput): Promise<SavedKundali> {
  return withLock(async () => {
    const database = await openDb();
    const now = new Date().toISOString();
    const name = input.name?.trim() ? input.name.trim().slice(0, 200) : null;
    const gender = input.gender?.trim()
      ? input.gender.trim().slice(0, 64)
      : null;
    const family = Boolean(input.family);
    const print = fingerprint({ name, birth: input.birth, place: input.place });

    let existing = input.id ? await getRowById(database, input.id) : undefined;
    if (!existing) existing = await getRowByFingerprint(database, print);

    if (existing) {
      const updated: SavedKundali = {
        ...rowToKundali(existing),
        family,
        name,
        gender,
        birth: input.birth,
        place: input.place,
        updatedAt: now,
      };
      await database.run(UPDATE_SQL, updateArgs(updated));
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
    await database.run(INSERT_SQL, insertArgs(created));
    return created;
  });
}

export async function patchKundali(
  id: string,
  patch: { family?: boolean; name?: string | null; gender?: string | null }
) {
  return withLock(async () => {
    const database = await openDb();
    const existing = await getRowById(database, id);
    if (!existing) return null;
    const current = rowToKundali(existing);
    const updated: SavedKundali = {
      ...current,
      family: patch.family ?? current.family,
      name:
        patch.name === undefined
          ? current.name
          : patch.name?.trim()
            ? patch.name.trim().slice(0, 200)
            : null,
      gender:
        patch.gender === undefined
          ? current.gender
          : patch.gender?.trim()
            ? patch.gender.trim().slice(0, 64)
            : null,
      updatedAt: new Date().toISOString(),
    };
    await database.run(UPDATE_SQL, updateArgs(updated));
    return updated;
  });
}

export async function deleteKundali(id: string) {
  return withLock(async () => {
    const database = await openDb();
    const result = await database.run("DELETE FROM kundalis WHERE id = ?", [id]);
    return result.changes > 0;
  });
}

/** Test helper: drop the cached connection so a new path can be opened. */
export function closeKundaliStore() {
  db?.close();
  db = null;
  opening = null;
}
