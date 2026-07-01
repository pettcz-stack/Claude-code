import { prisma, disconnect } from "../db.js";
import { config } from "../config.js";
import { fetchCenoveUdajeDleKu } from "../collectors/cuzk/wsdp.js";
import { parseCenoveUdaje } from "../collectors/cuzk/parse.js";
import { ingestRealizedPrices } from "../ingest/realizedPrices.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Stáhne realizované ceny z katastru pro cílová katastrální území
 * (CUZK_TARGET_KU) přes WSDP, naparsuje a uloží.
 *
 * Doporučené použití:
 *  - jednorázově pro historii (data ČÚZK jsou od 1. 1. 2014),
 *  - pak periodicky (např. měsíčně) pro nová řízení — dedup přes rawKey
 *    zajistí, že se uloží jen nové záznamy.
 *
 * Spuštění:  npm run collect:cuzk
 */
export async function runCuzk(): Promise<void> {
  const kus = config.cuzk.targetKuCodes;
  if (kus.length === 0) {
    console.warn(
      "Není zadané žádné katastrální území. Nastav CUZK_TARGET_KU (kódy oddělené čárkou).",
    );
    return;
  }

  console.log(`\n=== ČÚZK cenové údaje: ${kus.length} katastrálních území ===`);
  const run = await prisma.collectRun.create({ data: { source: "cuzk" } });
  let fetched = 0;
  let created = 0;
  let errors = 0;

  for (const ku of kus) {
    try {
      const xml = await fetchCenoveUdajeDleKu(ku);
      const records = parseCenoveUdaje(xml);
      const res = await ingestRealizedPrices(records);
      fetched += res.fetched;
      created += res.created;
      errors += res.errors;
      console.log(
        `[cuzk] KÚ ${ku}: záznamů ${res.fetched}, nových ${res.created}, ` +
          `duplicit ${res.skipped}, chyb ${res.errors}`,
      );
    } catch (err) {
      console.error(`[cuzk] KÚ ${ku} selhalo:`, err);
      errors++;
    }
    await sleep(config.cuzk.delayMs);
  }

  await prisma.collectRun.update({
    where: { id: run.id },
    data: { finishedAt: new Date(), fetched, created, errors },
  });
  console.log(`Hotovo: nových ${created}, chyb ${errors}.`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  runCuzk()
    .then(disconnect)
    .catch(async (err) => {
      console.error(err);
      await disconnect();
      process.exit(1);
    });
}
