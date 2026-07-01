import type { RawListing } from "../core/types.js";

/**
 * Reality.idnes nemá veřejné JSON API jako Sreality — data jsou v HTML.
 * Spolehlivý scraper vyžaduje parsování HTML (cheerio) a je křehký vůči
 * změnám layoutu, proto je do MVP zatím záměrně NEIMPLEMENTOVÁN.
 *
 * Až bude potřeba: stáhnout výpisové stránky
 *   https://reality.idnes.cz/s/prodej/byty/
 * projít stránkování, z každé karty vytáhnout odkaz, cenu, lokalitu, plochu
 * a vrátit RawListing se source="idnes". Zbytek pipeline (normalize → ingest)
 * funguje beze změny — stačí dodržet tvar RawListing.
 */
export async function collectIdnes(): Promise<RawListing[]> {
  console.warn("[idnes] collector zatím neimplementován — vracím prázdno.");
  return [];
}
