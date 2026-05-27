import crypto from 'node:crypto';
import { prisma } from '../db.js';

/**
 * GDPR čl. 20 (právo na přenositelnost) – posbírá všechna data, která o uživateli
 * v aplikaci máme. Vrací plain object, který lze serializovat do JSON pro stažení.
 *
 * Záměrně vrací **maximum informací** (intervaly, agregáty, absence, audit přístupů),
 * aby zaměstnanec / správce viděl reálně všechno, co je v DB. Bez filtrování.
 */
export async function exportUserData(userId: string): Promise<Record<string, unknown> | null> {
  const user = await prisma.monitoredUser.findUnique({ where: { id: userId } });
  if (!user) return null;

  const [intervals, hourly, daily, dailyApps, absences, calendarEvents, accessLog] = await Promise.all([
    prisma.activityInterval.findMany({
      where: { userId },
      orderBy: { intervalStart: 'desc' },
      take: 50000, // tvrdý strop, ale měl by stačit (35 dní × 1440 minut = ~50k)
    }),
    prisma.activityHourly.findMany({ where: { userId }, orderBy: { hourStart: 'desc' }, take: 20000 }),
    prisma.dailyStat.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
    prisma.dailyAppStat.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
    prisma.absence.findMany({ where: { userId } }),
    prisma.calendarEvent.findMany({ where: { userId } }),
    prisma.accessAudit.findMany({ where: { viewedUserId: userId }, orderBy: { createdAt: 'desc' }, take: 5000 }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    schema: 'focus-user-export/v1',
    user,
    activityIntervals: intervals,
    activityHourly: hourly,
    dailyStats: daily,
    dailyAppStats: dailyApps,
    absences,
    calendarEvents,
    accessAudit: accessLog,
    counts: {
      intervals: intervals.length,
      hourly: hourly.length,
      daily: daily.length,
      dailyApps: dailyApps.length,
      absences: absences.length,
      calendarEvents: calendarEvents.length,
      accessAuditEntries: accessLog.length,
    },
  };
}

/**
 * GDPR čl. 17 (právo na výmaz) – kompletně smaže veškerá identifikovatelná data
 * o zaměstnanci a pseudonymizuje jeho profil. Audit přístupů (kdo se na něj
 * v minulosti díval) **zůstává** – je to forenzní záznam plnění čl. 15 a 32 GDPR,
 * který se podle stanoviska EDPB nepovažuje za nadbytečný osobní údaj.
 *
 * Co se mažeme:
 *  - ActivityInterval (cascade přes onDelete: Cascade)
 *  - ActivityHourly (cascade)
 *  - DailyStat, DailyAppStat (cascade)
 *  - Absence, CalendarEvent (cascade)
 *
 * Co se pseudonymizuje (zůstává záznam, ale bez vazby na osobu):
 *  - MonitoredUser.sid → "deleted-<random hex>"
 *  - displayName → "Smazaný uživatel"
 *  - department → null
 *  - email → null
 *  - hourlyRate → null
 *  - active → false
 *
 * Cascade smaže související tabulky díky FK v schématu, ale pro jistotu mažeme
 * explicitně (test compatibility + transparent log).
 */
export async function eraseUser(userId: string): Promise<{ deleted: Record<string, number> } | null> {
  const user = await prisma.monitoredUser.findUnique({ where: { id: userId } });
  if (!user) return null;

  const counts = await prisma.$transaction(async (tx) => {
    const intervals = await tx.activityInterval.deleteMany({ where: { userId } });
    const hourly = await tx.activityHourly.deleteMany({ where: { userId } });
    const daily = await tx.dailyStat.deleteMany({ where: { userId } });
    const dailyApps = await tx.dailyAppStat.deleteMany({ where: { userId } });
    const absences = await tx.absence.deleteMany({ where: { userId } });
    const calendar = await tx.calendarEvent.deleteMany({ where: { userId } });

    const pseudonymSid = `deleted-${crypto.randomBytes(8).toString('hex')}`;
    await tx.monitoredUser.update({
      where: { id: userId },
      data: {
        sid: pseudonymSid,
        displayName: 'Smazaný uživatel',
        department: null,
        email: null,
        okbaseId: null,
        hourlyRate: null,
        active: false,
      },
    });

    return {
      activityIntervals: intervals.count,
      activityHourly: hourly.count,
      dailyStats: daily.count,
      dailyAppStats: dailyApps.count,
      absences: absences.count,
      calendarEvents: calendar.count,
    };
  });

  return { deleted: counts };
}
