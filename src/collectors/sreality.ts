import { request } from "undici";
import { config } from "../config.js";
import type { RawListing } from "../core/types.js";

const API = "https://www.sreality.cz/api/cs/v2/estates";

/** Kombinace, které procházíme. main: 1=byt 2=dům 3=pozemek; type: 1=prodej 2=pronájem. */
const COMBOS: Array<{ main: number; type: number }> = [
  { main: 1, type: 1 }, // byty prodej
  { main: 1, type: 2 }, // byty pronájem
  { main: 2, type: 1 }, // domy prodej
  { main: 3, type: 1 }, // pozemky prodej
];

const SLUG_TYPE: Record<number, string> = { 1: "prodej", 2: "pronajem" };
const SLUG_MAIN: Record<number, string> = {
  1: "byt",
  2: "dum",
  3: "pozemek",
  4: "komercni",
  5: "ostatni",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface SrealityEstate {
  hash_id?: number;
  name?: string;
  price?: number;
  gps?: { lat?: number; lon?: number };
  seo?: { locality?: string };
  locality?: string;
  category_main_cb?: number;
  category_type_cb?: number;
}

/** Postaví best-effort odkaz na detail. Sreality redirectuje podle hash_id na konci. */
function detailUrl(e: SrealityEstate, main: number, type: number): string {
  const t = SLUG_TYPE[type] ?? "prodej";
  const m = SLUG_MAIN[main] ?? "byt";
  const loc = (e.seo?.locality ?? "nemovitost").toString();
  return `https://www.sreality.cz/detail/${t}/${m}/_/${loc}/${e.hash_id}`;
}

async function fetchPage(
  main: number,
  type: number,
  page: number,
): Promise<SrealityEstate[]> {
  const url =
    `${API}?category_main_cb=${main}&category_type_cb=${type}` +
    `&per_page=60&page=${page}`;
  const res = await request(url, {
    method: "GET",
    headers: {
      "User-Agent": config.collect.userAgent,
      Accept: "application/json",
    },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Sreality API ${res.statusCode} pro ${url}`);
  }
  const body = (await res.body.json()) as {
    _embedded?: { estates?: SrealityEstate[] };
  };
  return body._embedded?.estates ?? [];
}

/**
 * Stáhne inzeráty ze Sreality. Šetrně: prodleva mezi requesty, max počet stránek
 * z configu. Respektuj rozumnou frekvenci — toto je neoficiální API.
 */
export async function collectSreality(): Promise<RawListing[]> {
  const out: RawListing[] = [];
  for (const { main, type } of COMBOS) {
    for (let page = 1; page <= config.collect.maxPages; page++) {
      let estates: SrealityEstate[];
      try {
        estates = await fetchPage(main, type, page);
      } catch (err) {
        console.warn(`[sreality] chyba na main=${main} type=${type} page=${page}:`, err);
        break; // přeruš tuhle kombinaci, pokračuj další
      }
      if (estates.length === 0) break; // konec stránkování

      for (const e of estates) {
        if (e.hash_id == null) continue;
        out.push({
          source: "sreality",
          externalId: String(e.hash_id),
          url: detailUrl(e, main, type),
          title: e.name ?? "",
          // 0 nebo 1 u Sreality typicky znamená "cena na vyžádání"
          price: e.price && e.price > 1 ? e.price : null,
          locality: e.seo?.locality ?? e.locality ?? null,
          lat: e.gps?.lat ?? null,
          lon: e.gps?.lon ?? null,
          rawCategoryMain: main,
          rawCategoryType: type,
          areaM2: null, // plocha se dopočítá z názvu při normalizaci
        });
      }
      await sleep(config.collect.delayMs);
    }
  }
  return out;
}
