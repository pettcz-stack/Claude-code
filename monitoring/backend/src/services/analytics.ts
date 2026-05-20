import { prisma } from '../db.js';
import { config } from '../config.js';
import { getCategoryMap, type CatType } from './categories.js';
import { classifyActivity, getWebRules } from './classify.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type TrendPoint = { date: string; score: number; workMinutes: number; nonWorkMinutes: number; idleMinutes: number };

/** Denní trend skóre pro uživatele (nebo průměr firmy, když userId chybí). */
export async function trend(from: Date, to: Date, userId?: string, department?: string): Promise<TrendPoint[]> {
  const catMap = await getCategoryMap();
  const webRules = await getWebRules();
  const expectedPerDay = config.expectedWorkHoursPerDay * 60;

  const userIds = userId
    ? [userId]
    : (
        await prisma.monitoredUser.findMany({
          where: { active: true, ...(department ? { department } : {}) },
          select: { id: true },
        })
      ).map((u) => u.id);

  const intervals = await prisma.activityInterval.findMany({
    where: { userId: { in: userIds }, intervalStart: { gte: from, lt: to } },
    select: { userId: true, intervalStart: true, activeSeconds: true, idleSeconds: true, foregroundApp: true, windowTitle: true },
  });

  // den -> uživatel -> {work, nonwork, idle}
  const perDay = new Map<string, Map<string, { work: number; nonwork: number; idle: number }>>();
  for (const it of intervals) {
    const dk = dayKey(it.intervalStart);
    let users = perDay.get(dk);
    if (!users) (users = new Map()), perDay.set(dk, users);
    let acc = users.get(it.userId);
    if (!acc) (acc = { work: 0, nonwork: 0, idle: 0 }), users.set(it.userId, acc);
    acc.idle += it.idleSeconds / 60;
    const m = it.activeSeconds / 60;
    if (m > 0) {
      const info = classifyActivity(catMap, webRules, it.foregroundApp, it.windowTitle);
      if (info.type === 'NON_WORK') acc.nonwork += m;
      else acc.work += m;
    }
  }

  const points: TrendPoint[] = [];
  for (let t = from.getTime(); t < to.getTime(); t += DAY_MS) {
    const dk = dayKey(new Date(t));
    const users = perDay.get(dk);
    if (!users || users.size === 0) {
      points.push({ date: dk, score: 0, workMinutes: 0, nonWorkMinutes: 0, idleMinutes: 0 });
      continue;
    }
    let work = 0;
    let nonwork = 0;
    let idle = 0;
    let scoreSum = 0;
    for (const a of users.values()) {
      work += a.work;
      nonwork += a.nonwork;
      idle += a.idle;
      scoreSum += Math.min(100, Math.round((a.work / expectedPerDay) * 100));
    }
    points.push({
      date: dk,
      score: Math.round(scoreSum / users.size),
      workMinutes: Math.round(work),
      nonWorkMinutes: Math.round(nonwork),
      idleMinutes: Math.round(idle),
    });
  }
  return points;
}

export type ActivityItem = { label: string; category: string; type: CatType; minutes: number };

/** Top aplikace a top weby (z titulků) za období. */
export async function topActivities(
  from: Date,
  to: Date,
  userId?: string,
  department?: string,
): Promise<{ apps: ActivityItem[]; sites: ActivityItem[] }> {
  const catMap = await getCategoryMap();
  const webRules = await getWebRules();

  const userIds = userId
    ? [userId]
    : (
        await prisma.monitoredUser.findMany({
          where: { active: true, ...(department ? { department } : {}) },
          select: { id: true },
        })
      ).map((u) => u.id);

  const intervals = await prisma.activityInterval.findMany({
    where: { userId: { in: userIds }, intervalStart: { gte: from, lt: to } },
    select: { activeSeconds: true, foregroundApp: true, windowTitle: true },
  });

  const apps = new Map<string, ActivityItem>();
  const sites = new Map<string, ActivityItem>();
  const BROWSERS = new Set(['chrome.exe', 'msedge.exe', 'firefox.exe']);

  for (const it of intervals) {
    const m = it.activeSeconds / 60;
    if (m <= 0 || !it.foregroundApp) continue;
    const info = classifyActivity(catMap, webRules, it.foregroundApp, it.windowTitle);

    const a = apps.get(it.foregroundApp) ?? { label: it.foregroundApp, category: info.category, type: info.type, minutes: 0 };
    a.minutes += m;
    apps.set(it.foregroundApp, a);

    if (BROWSERS.has(it.foregroundApp) && it.windowTitle) {
      const s = sites.get(it.windowTitle) ?? { label: it.windowTitle, category: info.category, type: info.type, minutes: 0 };
      s.minutes += m;
      sites.set(it.windowTitle, s);
    }
  }

  const round = (x: ActivityItem) => ({ ...x, minutes: Math.round(x.minutes) });
  const top = (map: Map<string, ActivityItem>, n: number) =>
    Array.from(map.values()).sort((a, b) => b.minutes - a.minutes).slice(0, n).map(round);

  return { apps: top(apps, 12), sites: top(sites, 12) };
}
