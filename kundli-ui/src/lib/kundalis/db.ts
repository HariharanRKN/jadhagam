import { mkdir } from "fs/promises";
import { dirname, join } from "path";
import { DatabaseSync } from "node:sqlite";
import { createClient, type Client, type InValue } from "@libsql/client";

const IS_PROD = process.env.NODE_ENV === "production";

export type QueryRow = Record<string, unknown>;

export type KundaliDb = {
  remote: boolean;
  exec(sql: string): Promise<void>;
  run(sql: string, args?: InValue[]): Promise<{ changes: number }>;
  get(sql: string, args?: InValue[]): Promise<QueryRow | undefined>;
  all(sql: string, args?: InValue[]): Promise<QueryRow[]>;
  close(): void;
};

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS kundalis (
      id TEXT PRIMARY KEY,
      family INTEGER NOT NULL DEFAULT 0,
      name TEXT,
      gender TEXT,
      birth_year INTEGER NOT NULL,
      birth_month INTEGER NOT NULL,
      birth_day INTEGER NOT NULL,
      birth_hour INTEGER NOT NULL,
      birth_minute INTEGER NOT NULL,
      birth_second INTEGER NOT NULL DEFAULT 0,
      place_name TEXT NOT NULL,
      place_lat REAL NOT NULL,
      place_lng REAL NOT NULL,
      place_tz REAL NOT NULL,
      fingerprint TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  `CREATE INDEX IF NOT EXISTS idx_kundalis_family ON kundalis(family)`,
  `CREATE INDEX IF NOT EXISTS idx_kundalis_updated ON kundalis(updated_at)`,
];

export function remoteDbUrl() {
  return (process.env.KUNDALI_DB_URL ?? "").trim();
}

export function dbPath() {
  return (
    process.env.KUNDALI_DB_PATH ??
    (IS_PROD
      ? "/var/data/saved_kundalis.sqlite"
      : join(process.cwd(), "..", "data", "saved_kundalis.sqlite"))
  );
}

function asRow(value: object): QueryRow {
  return { ...(value as QueryRow) };
}

function sqliteDb(database: DatabaseSync): KundaliDb {
  return {
    remote: false,
    async exec(sql: string) {
      database.exec(sql);
    },
    async run(sql: string, args: InValue[] = []) {
      const result = database.prepare(sql).run(...args);
      return { changes: Number(result.changes) };
    },
    async get(sql: string, args: InValue[] = []) {
      const row = database.prepare(sql).get(...args);
      return row ? asRow(row as object) : undefined;
    },
    async all(sql: string, args: InValue[] = []) {
      return (database.prepare(sql).all(...args) as object[]).map(asRow);
    },
    close() {
      database.close();
    },
  };
}

function libsqlDb(client: Client): KundaliDb {
  return {
    remote: true,
    async exec(sql: string) {
      await client.execute(sql);
    },
    async run(sql: string, args: InValue[] = []) {
      const result = await client.execute({ sql, args });
      return { changes: Number(result.rowsAffected) };
    },
    async get(sql: string, args: InValue[] = []) {
      const result = await client.execute({ sql, args });
      const row = result.rows[0];
      return row ? asRow(row) : undefined;
    },
    async all(sql: string, args: InValue[] = []) {
      const result = await client.execute({ sql, args });
      return result.rows.map((row) => asRow(row));
    },
    close() {
      client.close();
    },
  };
}

export async function initKundaliDb(): Promise<KundaliDb> {
  const url = remoteDbUrl();
  let db: KundaliDb;
  if (url) {
    const authToken = (process.env.KUNDALI_DB_AUTH_TOKEN ?? "").trim();
    db = libsqlDb(
      createClient({
        url,
        ...(authToken ? { authToken } : {}),
      })
    );
  } else {
    const path = dbPath();
    await mkdir(dirname(path), { recursive: true });
    const database = new DatabaseSync(path);
    database.exec("PRAGMA journal_mode = WAL");
    database.exec("PRAGMA busy_timeout = 5000");
    db = sqliteDb(database);
  }
  for (const sql of SCHEMA_STATEMENTS) {
    await db.exec(sql);
  }
  return db;
}
