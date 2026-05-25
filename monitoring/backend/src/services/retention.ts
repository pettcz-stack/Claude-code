import { prisma } from '../db.js';
import { getSettings } from './settings.js';

/**
 * Smaže syrové intervaly aktivity starší než N dní (podle nastavení).
 * Agregáty (DailyStat, ActivityHourly, Score) zůstávají – ty drží statistiku
 * historicky, ale bez detailu titulků oken (= GDPR minimalizace dat).
 */
export async function pruneOldIntervals(): Promise<{ deletedIntervals: number; days: number }> {
  const { retentionDaysIntervals } = await getSettings();
  if (!retentionDaysIntervals || retentionDaysIntervals <= 0) return { deletedIntervals: 0, days: 0 };
  const cutoff = new Date(Date.now() - retentionDaysIntervals * 86_400_000);
  const r = await prisma.activityInterval.deleteMany({ where: { intervalStart: { lt: cutoff } } });
  return { deletedIntervals: r.count, days: retentionDaysIntervals };
}

/** Naplánuje denní úklid (interval 24 h). První běh za 5 minut po startu. */
export function scheduleRetentionPruning(): void {
  const run = async () => {
    try {
      const r = await pruneOldIntervals();
      if (r.deletedIntervals > 0) console.log(`[retention] smazáno ${r.deletedIntervals} intervalů starších než ${r.days} dní`);
    } catch (e) {
      console.error('[retention] chyba při úklidu:', e);
    }
  };
  setTimeout(run, 5 * 60 * 1000);
  setInterval(run, 24 * 60 * 60 * 1000);
}
