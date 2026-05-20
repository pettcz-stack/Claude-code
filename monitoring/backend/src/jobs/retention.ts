import { prisma } from '../db.js';
import { config } from '../config.js';

/**
 * Maže stará data dle retenční politiky (NAVRH.md §6, §14):
 *  - syrové intervaly po `rawRetentionDays`
 *  - hodinové agregáty po `hourlyRetentionDays`
 * Soulad s GDPR (minimalizace, omezené uchování).
 */
export async function runRetention(): Promise<{ intervals: number; hourly: number }> {
  const now = Date.now();
  const rawCutoff = new Date(now - config.rawRetentionDays * 24 * 60 * 60 * 1000);
  const hourlyCutoff = new Date(now - config.hourlyRetentionDays * 24 * 60 * 60 * 1000);

  const intervals = await prisma.activityInterval.deleteMany({ where: { intervalStart: { lt: rawCutoff } } });
  const hourly = await prisma.activityHourly.deleteMany({ where: { hourStart: { lt: hourlyCutoff } } });

  return { intervals: intervals.count, hourly: hourly.count };
}
