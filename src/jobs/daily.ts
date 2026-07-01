import { prisma, disconnect } from "../db.js";
import { collectSreality } from "../collectors/sreality.js";
import { collectIdnes } from "../collectors/idnes.js";
import { ingest } from "../ingest/ingest.js";
import { markRemoved } from "./markRemoved.js";
import type { RawListing } from "../core/types.js";

const COLLECTORS: Array<{ name: string; run: () => Promise<RawListing[]> }> = [
  { name: "sreality", run: collectSreality },
  { name: "idnes", run: collectIdnes },
];

/**
 * Denní běh: pro každý zdroj stáhni → ulož, pak označ zmizelé jako removed.
 * Spouštěj přes cron, např.:  0 4 * * *  cd /app && npm run collect
 */
export async function runDaily(opts: { dryRun?: boolean } = {}): Promise<void> {
  const now = new Date();
  console.log(`\n=== Sběr ${now.toISOString()} ${opts.dryRun ? "(DRY RUN)" : ""} ===`);

  for (const c of COLLECTORS) {
    const run = await prisma.collectRun.create({
      data: { source: c.name, startedAt: now },
    });
    try {
      const raw = await c.run();
      console.log(`[${c.name}] staženo ${raw.length} inzerátů`);

      if (opts.dryRun) {
        await prisma.collectRun.update({
          where: { id: run.id },
          data: { finishedAt: new Date(), fetched: raw.length, note: "dry-run" },
        });
        continue;
      }

      const res = await ingest(raw, now);
      await prisma.collectRun.update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          fetched: res.fetched,
          created: res.created,
          updated: res.updated,
          priceChanges: res.priceChanges,
          errors: res.errors,
        },
      });
      console.log(
        `[${c.name}] nových ${res.created}, aktualizováno ${res.updated}, ` +
          `změn ceny ${res.priceChanges}, chyb ${res.errors}`,
      );
    } catch (err) {
      console.error(`[${c.name}] běh selhal:`, err);
      await prisma.collectRun.update({
        where: { id: run.id },
        data: { finishedAt: new Date(), errors: 1, note: String(err) },
      });
    }
  }

  if (!opts.dryRun) {
    const removed = await markRemoved(now);
    console.log(`Označeno jako removed (odhad prodeje/stažení): ${removed}`);
  }
}

// Spuštění z CLI: tsx src/jobs/daily.ts [--dry-run]
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  runDaily({ dryRun: process.argv.includes("--dry-run") })
    .then(disconnect)
    .catch(async (err) => {
      console.error(err);
      await disconnect();
      process.exit(1);
    });
}
