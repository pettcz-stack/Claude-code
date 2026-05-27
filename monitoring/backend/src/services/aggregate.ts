import { prisma } from '../db.js';
import { getCategoryMap } from './categories.js';
import { classifyActivity, getWebRules } from './classify.js';
import { computeIntegrity } from './integrity.js';
import { getSites, resolveSite } from './sites.js';
import { getDeptRules } from './deptrules.js';
import { floorToDay as tzFloorToDay, floorToHour as tzFloorToHour, addDays } from './tz.js';
import { isBrowser, extractSiteLabel } from './domain.js';

/** Zarovná čas na začátek hodiny (místní čas, Europe/Prague). */
export function floorToHour(d: Date): Date {
  return tzFloorToHour(d);
}

/** Zarovná čas na začátek dne (místní čas, Europe/Prague). */
export function floorToDay(d: Date): Date {
  return tzFloorToDay(d);
}

/**
 * Přepočítá denní souhrny (DailyStat) pro zadané dvojice (uživatel, den).
 * Klasifikuje intervaly stejnou logikou jako dashboard → čísla sedí, ale
 * dashboard pak čte jen pár řádků místo statisíců intervalů.
 */
export async function aggregateDays(pairs: { userId: string; day: Date }[]): Promise<number> {
  const unique = new Map<string, { userId: string; day: Date }>();
  for (const p of pairs) unique.set(`${p.userId}@${p.day.toISOString()}`, p);
  if (unique.size === 0) return 0;

  const catMap = await getCategoryMap();
  const webRules = await getWebRules();
  const sites = await getSites();
  const deptRules = await getDeptRules();
  // Oddělení každého dotčeného uživatele (kvůli přepisu typu podle oddělení).
  const userIds = [...new Set([...unique.values()].map((p) => p.userId))];
  const deptOf = new Map<string, string | null>(
    (await prisma.monitoredUser.findMany({ where: { id: { in: userIds } }, select: { id: true, department: true } }))
      .map((u) => [u.id, u.department]),
  );
  let written = 0;
  for (const { userId, day } of unique.values()) {
    const department = deptOf.get(userId) ?? null;
    const dayEnd = addDays(day, 1); // DST-safe (23/25h dny)
    const intervals = await prisma.activityInterval.findMany({
      where: { userId, intervalStart: { gte: day, lt: dayEnd } },
      select: { activeSeconds: true, idleSeconds: true, foregroundApp: true, windowTitle: true, keystrokeCount: true, monitorCount: true, clientIp: true, typingMs: true, typingKeystrokeCount: true },
    });
    if (intervals.length === 0) {
      await prisma.dailyStat.deleteMany({ where: { userId, date: day } });
      await prisma.dailyAppStat.deleteMany({ where: { userId, date: day } });
      continue;
    }

    let work = 0, nonwork = 0, idle = 0, unknown = 0, keystroke = 0, multiMon = 0, typingMs = 0, typingKs = 0;
    const catMin = new Map<string, number>();
    const monMin = new Map<number, number>();
    const locMin = new Map<string, number>(); // pracoviště → aktivní minuty ('' = mimo firmu)
    type AppAgg = { category: string; type: string; min: number };
    const appAgg = new Map<string, AppAgg>();
    const siteAgg = new Map<string, AppAgg>();
    // Browser detekce a "site label" extrahce viz services/domain.ts –
    // pokrývá Windows .exe i macOS jména ("Google Chrome", "Safari"), label
    // se snaží redukovat na doménu, jinak fallback na titulek (zkrácený).
    for (const it of intervals) {
      const aMin = it.activeSeconds / 60;
      idle += it.idleSeconds / 60;
      keystroke += it.keystrokeCount;
      typingMs += it.typingMs;
      typingKs += it.typingKeystrokeCount;
      if (aMin <= 0) continue;
      if (it.monitorCount && it.monitorCount > 0) {
        monMin.set(it.monitorCount, (monMin.get(it.monitorCount) ?? 0) + aMin);
        if (it.monitorCount >= 2) multiMon += aMin;
      }
      const loc = resolveSite(it.clientIp, sites) ?? '';
      locMin.set(loc, (locMin.get(loc) ?? 0) + aMin);
      const info = classifyActivity(catMap, webRules, it.foregroundApp, it.windowTitle, deptRules, department);
      if (info.type === 'NON_WORK') nonwork += aMin;
      else if (info.type === 'UNKNOWN') unknown += aMin;
      else { work += aMin; catMin.set(info.category, (catMin.get(info.category) ?? 0) + aMin); }
      // využití aplikací / webů
      if (it.foregroundApp) {
        const a = appAgg.get(it.foregroundApp) ?? { category: info.category, type: info.type, min: 0 };
        a.min += aMin; appAgg.set(it.foregroundApp, a);
        if (isBrowser(it.foregroundApp)) {
          const label = extractSiteLabel(it.foregroundApp, it.windowTitle);
          if (label) {
            const s = siteAgg.get(label) ?? { category: info.category, type: info.type, min: 0 };
            s.min += aMin; siteAgg.set(label, s);
          }
        }
      }
    }
    let monitorTop = 0, mb = -1; for (const [c, m] of monMin) if (m > mb) { mb = m; monitorTop = c; }
    let domWorkCat: string | null = null, db = -1; for (const [c, m] of catMin) if (m > db) { db = m; domWorkCat = c; }
    let site: string | null = null, sb = -1; for (const [c, m] of locMin) if (m > sb) { sb = m; site = c || null; }
    const integ = await computeIntegrity(userId, day, dayEnd);

    const data = { workMin: work, nonWorkMin: nonwork, idleMin: idle, unknownMin: unknown, keystroke, typingMs, typingKeystrokeCount: typingKs, monitorTop, multiMonitorMin: multiMon, domWorkCat, site, suspicious: integ.suspicious };
    await prisma.dailyStat.upsert({
      where: { userId_date: { userId, date: day } },
      create: { userId, date: day, ...data },
      update: data,
    });
    // přepiš denní využití aplikací/webů
    await prisma.dailyAppStat.deleteMany({ where: { userId, date: day } });
    const appRows = [
      ...Array.from(appAgg.entries()).map(([label, a]) => ({ userId, date: day, kind: 'APP', label, category: a.category, type: a.type, activeMin: a.min })),
      ...Array.from(siteAgg.entries()).map(([label, a]) => ({ userId, date: day, kind: 'SITE', label, category: a.category, type: a.type, activeMin: a.min })),
    ];
    if (appRows.length) await prisma.dailyAppStat.createMany({ data: appRows });
    written++;
  }
  return written;
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
  const n = await aggregateHours(pairs);
  await aggregateDays(intervals.map((i) => ({ userId: i.userId, day: floorToDay(i.intervalStart) })));
  return n;
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

/**
 * Cílená reagregace po změně klasifikačního pravidla. Místo `aggregateAll()`
 * (která projde miliony intervalů) přepočítá jen intervaly, kterých se
 * pravidlo skutečně dotýká:
 *
 *  - `appName`: intervaly s `foregroundApp == appName` (typicky `chrome.exe`)
 *  - `keyword`: intervaly s `windowTitle LIKE '%keyword%'` (případ webrule)
 *  - `department`: intervaly všech uživatelů v daném oddělení (deptrule)
 *
 * Pro demo (≤ 50 uživatelů × 30 dní) běžně < 100k řádků – < 2s.
 * Pro produkci 500 uživatelů × 90 dní s 1M intervalů: kdyby pravidlo
 * trefí 5 % (typický browser), je to 50k řádků = ~5s background job.
 *
 * Pokud nic z výše uvedeného nesedí (např. odstranění pravidla), fallback
 * na aggregateAll.
 */
export async function reaggregateByClassificationChange(opts: {
  appName?: string;
  keyword?: string;
  department?: string;
}): Promise<number> {
  const filters: { OR?: object[] } = {};
  const conditions: object[] = [];

  if (opts.appName) {
    conditions.push({ foregroundApp: opts.appName });
  }
  if (opts.keyword) {
    // SQLite & PostgreSQL: both support contains via Prisma's `contains`.
    conditions.push({ windowTitle: { contains: opts.keyword } });
  }
  if (opts.department) {
    const userIds = (
      await prisma.monitoredUser.findMany({
        where: { department: opts.department },
        select: { id: true },
      })
    ).map((u) => u.id);
    if (userIds.length > 0) conditions.push({ userId: { in: userIds } });
  }

  if (conditions.length === 0) {
    // Žádný cílený filter – musíme přepočítat vše. Fallback chovaní.
    return aggregateAll();
  }
  filters.OR = conditions;

  const rows = await prisma.activityInterval.findMany({
    where: filters,
    select: { userId: true, intervalStart: true },
  });
  return aggregateForIntervals(rows);
}
