import { prisma } from '../db.js';

/** Zarovná čas na začátek hodiny (UTC). */
export function floorToHour(d: Date): Date {
  const x = new Date(d);
  x.setUTCMinutes(0, 0, 0);
  return x;
}

type UserHour = { userId: string; hourStart: Date };

function keyOf(userId: string, hourStart: Date): string {
  return `${userId}@${hourStart.toISOString()}`;
}

/**
 * Přepočítá hodinové agregáty pro zadané dvojice (uživatel, hodina).
 * Idempotentní – výsledek závisí jen na aktuálních intervalech v dané hodině.
 */
export async function aggregateHours(pairs: UserHour[]): Promise<number> {
  // Deduplikace dvojic
  const unique = new Map<string, UserHour>();
  for (const p of pairs) unique.set(keyOf(p.userId, p.hourStart), p);

  let written = 0;
  for (const { userId, hourStart } of unique.values()) {
    const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
    const intervals = await prisma.activityInterval.findMany({
      where: { userId, intervalStart: { gte: hourStart, lt: hourEnd } },
    });

    if (intervals.length === 0) {
      // Žádná data → smaž případný osiřelý agregát.
      await prisma.activityHourly.deleteMany({ where: { userId, hourStart } });
      continue;
    }

    let activeSeconds = 0;
    let idleSeconds = 0;
    let lockedSeconds = 0;
    let keystrokeTotal = 0;
    let mouseTotal = 0;
    const appActive = new Map<string, number>();

    for (const it of intervals) {
      activeSeconds += it.activeSeconds;
      idleSeconds += it.idleSeconds;
      if (it.sessionLocked) lockedSeconds += it.intervalSeconds;
      keystrokeTotal += it.keystrokeCount;
      mouseTotal += it.mouseEvents;
      if (it.foregroundApp) {
        appActive.set(it.foregroundApp, (appActive.get(it.foregroundApp) ?? 0) + it.activeSeconds);
      }
    }

    let topApp: string | null = null;
    let best = -1;
    for (const [app, secs] of appActive) {
      if (secs > best) {
        best = secs;
        topApp = app;
      }
    }

    const activeMinutes = activeSeconds / 60;
    const avgKpm = activeMinutes > 0 ? keystrokeTotal / activeMinutes : 0;

    await prisma.activityHourly.upsert({
      where: { userId_hourStart: { userId, hourStart } },
      create: {
        userId,
        hourStart,
        activeMinutes,
        idleMinutes: idleSeconds / 60,
        lockedMinutes: lockedSeconds / 60,
        topApp,
        keystrokeTotal,
        mouseTotal,
        avgKpm,
      },
      update: {
        activeMinutes,
        idleMinutes: idleSeconds / 60,
        lockedMinutes: lockedSeconds / 60,
        topApp,
        keystrokeTotal,
        mouseTotal,
        avgKpm,
      },
    });
    written++;
  }
  return written;
}

/** Odvodí dotčené (uživatel, hodina) z intervalů a přepočítá je. */
export async function aggregateForIntervals(
  intervals: { userId: string; intervalStart: Date }[],
): Promise<number> {
  const pairs = intervals.map((i) => ({ userId: i.userId, hourStart: floorToHour(i.intervalStart) }));
  return aggregateHours(pairs);
}

/**
 * Přepočítá všechny hodiny, do kterých spadají intervaly za posledních `hoursBack`
 * hodin. Používá plánovaná úloha, aby dohnala pozdě doručená data.
 */
export async function aggregateRecent(hoursBack = 3): Promise<number> {
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  const rows = await prisma.activityInterval.findMany({
    where: { intervalStart: { gte: floorToHour(since) } },
    select: { userId: true, intervalStart: true },
  });
  return aggregateForIntervals(rows);
}

/** Přepočítá hodinové agregáty ze VŠECH existujících intervalů (backfill). */
export async function aggregateAll(): Promise<number> {
  const rows = await prisma.activityInterval.findMany({
    select: { userId: true, intervalStart: true },
  });
  return aggregateForIntervals(rows);
}
