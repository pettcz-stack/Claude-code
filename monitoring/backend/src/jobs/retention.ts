import { prisma } from '../db.js';
import { config } from '../config.js';

/**
 * Maže stará data dle retenční politiky (NAVRH.md §6, §14):
 *  - syrové intervaly po `rawRetentionDays` (default 35)
 *  - hodinové agregáty po `hourlyRetentionDays` (default 540)
 *  - denní agregáty po `hourlyRetentionDays` (stejně dlouho – pořád PII)
 *  - audit přístupů po `auditRetentionDays` (default 365 – min. pro GDPR forenziku)
 * Soulad s GDPR (minimalizace, omezené uchování).
 */
export async function runRetention(): Promise<{ intervals: number; hourly: number; daily: number; dailyApps: number; audit: number }> {
  const now = Date.now();
  const rawCutoff = new Date(now - config.rawRetentionDays * 24 * 60 * 60 * 1000);
  const hourlyCutoff = new Date(now - config.hourlyRetentionDays * 24 * 60 * 60 * 1000);
  const dailyCutoff = new Date(now - config.hourlyRetentionDays * 24 * 60 * 60 * 1000);
  const auditCutoff = new Date(now - config.auditRetentionDays * 24 * 60 * 60 * 1000);

  const intervals = await prisma.activityInterval.deleteMany({ where: { intervalStart: { lt: rawCutoff } } });
  const hourly = await prisma.activityHourly.deleteMany({ where: { hourStart: { lt: hourlyCutoff } } });
  // DailyStat.date je DateTime (půlnoc daného dne). Bez retence by personalizovaná
  // statistika rostla věčně – GDPR čl. 5 odst. 1 písm. e) (omezené uchování).
  const daily = await prisma.dailyStat.deleteMany({ where: { date: { lt: dailyCutoff } } });
  const dailyApps = await prisma.dailyAppStat.deleteMany({ where: { date: { lt: dailyCutoff } } });
  // AccessAudit (kdo se kdy díval na čí data) – retence min. 1 rok pro doložení
  // čl. 32 + transparentnosti, pak smazat (osobní údaj o adminovi i o subjektu).
  const audit = await prisma.accessAudit.deleteMany({ where: { createdAt: { lt: auditCutoff } } });

  return { intervals: intervals.count, hourly: hourly.count, daily: daily.count, dailyApps: dailyApps.count, audit: audit.count };
}
