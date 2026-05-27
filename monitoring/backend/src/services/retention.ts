import { prisma } from '../db.js';
import { getSettings } from './settings.js';
import { config } from '../config.js';

/**
 * Vícestupňové retention pro úsporu HDD:
 *
 *  1) ActivityInterval (raw) – nejhřmotnější tabulka. Smaže po N dnů.
 *     Default 30 dnů. Pro 1991 uživatelů to znamená ~7 GB v SQLite (vs.
 *     ~21 GB při 90 dnů). Detail aktivity je k dispozici v agregátech.
 *  2) DailyAppStat (per-uživatel-den souhrn apps/webů) – drží 540 dnů (~18 měs).
 *  3) DailyStat (per-uživatel-den skóre + KPM) – drží 540 dnů.
 *  4) AccessAudit – drží podle config.auditRetentionDays (default 365 dnů, GDPR).
 *
 * Po smazání běží SQLite/PostgreSQL VACUUM/ANALYZE aby se uvolnilo místo na disku
 * (jinak indexy a tabulky drží alokované stránky i po DELETE).
 */
export async function pruneOldIntervals(): Promise<{ deletedIntervals: number; days: number; deletedAggregates: number; deletedAudit: number }> {
  const { retentionDaysIntervals } = await getSettings();
  const aggCutoff = new Date(Date.now() - config.hourlyRetentionDays * 86_400_000);
  const auditCutoff = new Date(Date.now() - config.auditRetentionDays * 86_400_000);

  let deletedIntervals = 0;
  if (retentionDaysIntervals && retentionDaysIntervals > 0) {
    const cutoff = new Date(Date.now() - retentionDaysIntervals * 86_400_000);
    const r = await prisma.activityInterval.deleteMany({ where: { intervalStart: { lt: cutoff } } });
    deletedIntervals = r.count;
  }

  // Agregáty starší než 540 dnů – už nemají hodnotu pro audit (rok+ pryč).
  const aggResult = await prisma.$transaction([
    prisma.dailyAppStat.deleteMany({ where: { date: { lt: aggCutoff } } }),
    prisma.dailyStat.deleteMany({ where: { date: { lt: aggCutoff } } }),
    prisma.activityHourly.deleteMany({ where: { hourStart: { lt: aggCutoff } } }),
  ]);
  const deletedAggregates = aggResult.reduce((s, r) => s + r.count, 0);

  // Audit log retention (GDPR čl. 32: typicky 12 měsíců).
  const auditR = await prisma.accessAudit.deleteMany({ where: { createdAt: { lt: auditCutoff } } });

  return { deletedIntervals, days: retentionDaysIntervals, deletedAggregates, deletedAudit: auditR.count };
}

/**
 * VACUUM – SQLite po DELETE drží alokovaná místa na disku. VACUUM je vrátí OS.
 * PostgreSQL má autovacuum, manuální VACUUM ANALYZE doporučená 1× týdně.
 */
async function vacuumDatabase(): Promise<void> {
  try {
    if (config.databaseUrl.startsWith('file:') || config.databaseUrl.includes('sqlite')) {
      await prisma.$executeRawUnsafe('VACUUM;');
    } else {
      // PostgreSQL – VACUUM nelze v transakci, používáme ANALYZE který je rychlejší.
      await prisma.$executeRawUnsafe('ANALYZE;');
    }
  } catch (e) {
    console.error('[retention] VACUUM/ANALYZE selhal:', e);
  }
}

/** Naplánuje denní úklid (interval 24 h). První běh za 5 minut po startu. */
export function scheduleRetentionPruning(): void {
  const run = async () => {
    try {
      const r = await pruneOldIntervals();
      console.log(`[retention] smazáno ${r.deletedIntervals} intervalů (>${r.days} dní), ${r.deletedAggregates} starých agregátů, ${r.deletedAudit} auditních záznamů`);
      // VACUUM po větším úklidu – uvolnit místo na disku (SQLite drží alokované stránky i po DELETE).
      if (r.deletedIntervals > 1000 || r.deletedAggregates > 1000) {
        await vacuumDatabase();
        console.log('[retention] VACUUM/ANALYZE dokončen');
      }
    } catch (e) {
      console.error('[retention] chyba při úklidu:', e);
    }
  };
  setTimeout(run, 5 * 60 * 1000);
  setInterval(run, 24 * 60 * 60 * 1000);
}
