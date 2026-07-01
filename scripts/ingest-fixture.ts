import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ingest } from "../src/ingest/ingest.js";
import { disconnect } from "../src/db.js";
import type { RawListing } from "../src/core/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SLUG_TYPE: Record<number, string> = { 1: "prodej", 2: "pronajem" };
const SLUG_MAIN: Record<number, string> = { 1: "byt", 2: "dum", 3: "pozemek" };

interface Estate {
  hash_id: number;
  name: string;
  price: number;
  gps?: { lat: number; lon: number };
  seo?: { locality: string };
  category_main_cb: number;
  category_type_cb: number;
}

async function main() {
  const file = join(__dirname, "..", "fixtures", "sreality-sample.json");
  const estates = JSON.parse(await readFile(file, "utf8")) as Estate[];

  const raw: RawListing[] = estates.map((e) => ({
    source: "sreality",
    externalId: String(e.hash_id),
    url: `https://www.sreality.cz/detail/${SLUG_TYPE[e.category_type_cb]}/${SLUG_MAIN[e.category_main_cb]}/_/${e.seo?.locality}/${e.hash_id}`,
    title: e.name,
    price: e.price > 1 ? e.price : null,
    locality: e.seo?.locality ?? null,
    lat: e.gps?.lat ?? null,
    lon: e.gps?.lon ?? null,
    rawCategoryMain: e.category_main_cb,
    rawCategoryType: e.category_type_cb,
    areaM2: null,
  }));

  const res = await ingest(raw);
  console.log("Fixture naimportován:", res);
}

main()
  .then(disconnect)
  .catch(async (err) => {
    console.error(err);
    await disconnect();
    process.exit(1);
  });
