import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  closeKundaliStore,
  deleteKundali,
  listKundalis,
  patchKundali,
  upsertKundali,
} from "../src/lib/kundalis/store.ts";

const dir = join(tmpdir(), `kundali-store-${process.pid}`);
const dbFile = join(dir, "saved_kundalis.sqlite");
const jsonFile = join(dir, "saved_kundalis.json");

process.env.NODE_ENV = "development";
delete process.env.KUNDALI_DB_URL;
delete process.env.KUNDALI_DB_AUTH_TOKEN;
process.env.KUNDALI_DB_PATH = dbFile;
process.env.KUNDALI_STORE_PATH = jsonFile;

const sampleBirth = {
  year: 1990,
  month: 5,
  day: 20,
  hour: 10,
  minute: 15,
  second: 0,
};
const samplePlace = {
  name: "Chennai",
  lat: 13.0827,
  lng: 80.2707,
  tz: 5.5,
};

async function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });

  await writeFile(
    jsonFile,
    JSON.stringify({
      kundalis: [
        {
          id: "legacy-1",
          family: true,
          name: "Legacy",
          gender: "female",
          birth: sampleBirth,
          place: samplePlace,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
    })
  );

  const migrated = await listKundalis({ family: true });
  await assert(migrated.length === 1, "expected JSON migration");
  await assert(migrated[0].id === "legacy-1", "expected legacy id");
  await assert(migrated[0].family === true, "expected family flag");

  closeKundaliStore();
  const afterReopen = await listKundalis();
  await assert(afterReopen.length === 1, "rows should survive reopen");

  const created = await upsertKundali({
    family: false,
    name: "New",
    birth: { ...sampleBirth, year: 1991 },
    place: samplePlace,
  });
  await assert(created.id.length > 0, "expected new id");

  const patched = await patchKundali(created.id, { family: true });
  await assert(patched?.family === true, "expected family patch");

  const family = await listKundalis({ family: true });
  await assert(family.length === 2, "expected two family rows");

  const removed = await deleteKundali(created.id);
  await assert(removed === true, "expected delete");
  await assert((await listKundalis()).length === 1, "expected one row left");

  closeKundaliStore();
  await rm(dir, { recursive: true, force: true });
  console.log("kundali sqlite store ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
