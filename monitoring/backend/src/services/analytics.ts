import { prisma } from '../db.js';
import { config } from '../config.js';
import { getCategoryMap, type CatType } from './categories.js';
import { classifyActivity, getWebRules } from './classify.js';
import { computeIntegrity } from './integrity.js';
import { computeUserScore, monitorHandicapFactor, MULTI_MONITOR_BENEFIT_CATS } from './scoring.js';
import { getSettings } from './settings.js';

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
      else if (info.type === 'UNKNOWN') { /* nezařazeno – vyjmuto */ }
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

// --- Přehled firmy a heatmapa využití ----------------------------------------

function countWorkdays(from: Date, to: Date): number {
  let n = 0;
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  while (d < to) {
    const dow = d.getUTCDay();
    if (dow >= 1 && dow <= 5) n++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return Math.max(n, 1);
}

type Acc = { work: number; nonwork: number; idle: number; unknown: number };

/** Agregace aktivních minut na uživatele z intervalů (jeden průchod). */
async function perUser(userIds: string[], from: Date, to: Date): Promise<Map<string, Acc>> {
  const catMap = await getCategoryMap();
  const webRules = await getWebRules();
  const rows = await prisma.activityInterval.findMany({
    where: { userId: { in: userIds }, intervalStart: { gte: from, lt: to } },
    select: { userId: true, activeSeconds: true, idleSeconds: true, foregroundApp: true, windowTitle: true },
  });
  const map = new Map<string, Acc>();
  for (const r of rows) {
    let a = map.get(r.userId);
    if (!a) (a = { work: 0, nonwork: 0, idle: 0, unknown: 0 }), map.set(r.userId, a);
    a.idle += r.idleSeconds / 60;
    const m = r.activeSeconds / 60;
    if (m > 0) {
      const info = classifyActivity(catMap, webRules, r.foregroundApp, r.windowTitle);
      if (info.type === 'NON_WORK') a.nonwork += m;
      else if (info.type === 'UNKNOWN') a.unknown += m; // vyjmuto ze statistik
      else a.work += m;
    }
  }
  return map;
}

const clampPct = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
const EMPTY_ACC: Acc = { work: 0, nonwork: 0, idle: 0, unknown: 0 };
/** Skóre uživatele s vyjmutím nezařazeného času z fondu. */
const userScorePct = (a: Acc, expected: number) => clampPct((a.work / Math.max(expected - a.unknown, 1)) * 100);

/**
 * Interpretace monitorů (volitelná): handicapový faktor na uživatele. Kdo má míň
 * monitorů u práce, které z nich těží, je v nevýhodě → jeho skóre se férově navýší.
 * Vrací prázdnou mapu, když je interpretace vypnutá (skóre se nemění). Nezasahuje do dat.
 */
async function monitorFactorMap(userIds: string[], from: Date, to: Date): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (userIds.length === 0) return out;
  const { interpretMonitors } = await getSettings();
  if (!interpretMonitors) return out;
  const catMap = await getCategoryMap();
  const webRules = await getWebRules();
  const rows = await prisma.activityInterval.findMany({
    where: { userId: { in: userIds }, intervalStart: { gte: from, lt: to } },
    select: { userId: true, foregroundApp: true, windowTitle: true, activeSeconds: true, monitorCount: true },
  });
  const workCat = new Map<string, Map<string, number>>(); // user → kategorie WORK → sekundy
  const monSec = new Map<string, Map<number, number>>(); // user → počet monitorů → sekundy
  for (const r of rows) {
    if (r.activeSeconds <= 0) continue;
    if (r.monitorCount && r.monitorCount > 0) {
      let mm = monSec.get(r.userId);
      if (!mm) (mm = new Map()), monSec.set(r.userId, mm);
      mm.set(r.monitorCount, (mm.get(r.monitorCount) ?? 0) + r.activeSeconds);
    }
    const { category, type } = classifyActivity(catMap, webRules, r.foregroundApp, r.windowTitle);
    if (type !== 'WORK' && type !== 'NEUTRAL') continue;
    let cm = workCat.get(r.userId);
    if (!cm) (cm = new Map()), workCat.set(r.userId, cm);
    cm.set(category, (cm.get(category) ?? 0) + r.activeSeconds);
  }
  const dominantOf = (m?: Map<string, number>) => {
    if (!m) return '';
    let best = '', sec = 0;
    for (const [c, s] of m) if (s > sec) ((sec = s), (best = c));
    return best;
  };
  const typicalOf = (m?: Map<number, number>) => {
    if (!m) return 0;
    let best = 0, sec = -1;
    for (const [c, s] of m) if (s > sec) ((sec = s), (best = c));
    return best;
  };
  for (const id of userIds) {
    const typical = typicalOf(monSec.get(id));
    const dom = dominantOf(workCat.get(id));
    if (typical >= 1 && typical < 3 && MULTI_MONITOR_BENEFIT_CATS.has(dom)) {
      out.set(id, monitorHandicapFactor(typical));
    }
  }
  return out;
}

export type OverviewResult = {
  kpi: {
    userCount: number;
    avgScore: number;
    avgScoreDelta: number | null;
    activeHours: number;
    nonWorkHours: number;
    idleHours: number;
    nonWorkPct: number;
    flaggedCount: number;
    onlineCount: number;
  };
  split: { work: number; nonwork: number; idle: number; pcoff: number }; // hodiny
  departments: { department: string; avgScore: number; activeHours: number; nonWorkPct: number; users: number }[];
  top: { userId: string; displayName: string | null; department: string | null; score: number }[];
  bottom: { userId: string; displayName: string | null; department: string | null; score: number }[];
};

export async function overview(from: Date, to: Date, department?: string): Promise<OverviewResult> {
  const users = await prisma.monitoredUser.findMany({
    where: { active: true, ...(department ? { department } : {}) },
    select: { id: true, displayName: true, department: true },
  });
  const ids = users.map((u) => u.id);
  const expected = countWorkdays(from, to) * config.expectedWorkHoursPerDay * 60;

  const cur = await perUser(ids, from, to);

  // Interpretace monitorů (volitelná) – handicapový faktor na uživatele.
  const factors = await monitorFactorMap(ids, from, to);
  const adjScore = (id: string, raw: number) => {
    const f = factors.get(id);
    return f ? clampPct(raw * f) : raw;
  };

  // předchozí stejně dlouhé období (pro deltu skóre)
  const span = to.getTime() - from.getTime();
  const prev = await perUser(ids, new Date(from.getTime() - span), from);
  const prevScore = (id: string) => adjScore(id, userScorePct(prev.get(id) ?? EMPTY_ACC, expected));

  let workSum = 0, nonworkSum = 0, idleSum = 0, pcoffSum = 0, scoreSum = 0;
  const perUserScore = new Map<string, number>();
  const deptMap = new Map<string, { score: number; active: number; nonwork: number; n: number }>();

  for (const u of users) {
    const a = cur.get(u.id) ?? EMPTY_ACC;
    const score = adjScore(u.id, userScorePct(a, expected));
    const adjExpected = Math.max(expected - a.unknown, 1);
    pcoffSum += Math.max(adjExpected - (a.work + a.nonwork + a.idle), 0);
    perUserScore.set(u.id, score);
    workSum += a.work; nonworkSum += a.nonwork; idleSum += a.idle; scoreSum += score;
    const dep = u.department ?? '—';
    const d = deptMap.get(dep) ?? { score: 0, active: 0, nonwork: 0, n: 0 };
    d.score += score; d.active += a.work; d.nonwork += a.nonwork; d.n++;
    deptMap.set(dep, d);
  }

  const n = Math.max(users.length, 1);
  const avgScore = Math.round(scoreSum / n);
  const prevAvg = Math.round(users.reduce((s, u) => s + prevScore(u.id), 0) / n);
  const avgScoreDelta = prev.size > 0 ? avgScore - prevAvg : null;

  // počet podezřelých (integrita)
  let flagged = 0;
  for (const u of users) {
    const r = await computeIntegrity(u.id, from, to);
    if (r.suspicious) flagged++;
  }

  const now = Date.now();
  const devices = await prisma.device.findMany({ where: { active: true }, select: { lastSeen: true } });
  const onlineCount = devices.filter((d) => d.lastSeen && now - new Date(d.lastSeen).getTime() < 5 * 60 * 1000).length;

  const ranked = users
    .map((u) => ({ userId: u.id, displayName: u.displayName, department: u.department, score: perUserScore.get(u.id) ?? 0 }))
    .sort((a, b) => b.score - a.score);

  const pcoffHours = pcoffSum / 60;

  return {
    kpi: {
      userCount: users.length,
      avgScore,
      avgScoreDelta,
      activeHours: Math.round(workSum / 60),
      nonWorkHours: Math.round(nonworkSum / 60),
      idleHours: Math.round(idleSum / 60),
      nonWorkPct: clampPct((nonworkSum / Math.max(workSum + nonworkSum, 1)) * 100),
      flaggedCount: flagged,
      onlineCount,
    },
    split: {
      work: Math.round(workSum / 60),
      nonwork: Math.round(nonworkSum / 60),
      idle: Math.round(idleSum / 60),
      pcoff: Math.round(pcoffHours),
    },
    departments: Array.from(deptMap.entries())
      .map(([department, d]) => ({
        department,
        avgScore: Math.round(d.score / d.n),
        activeHours: Math.round(d.active / 60),
        nonWorkPct: clampPct((d.nonwork / Math.max(d.active + d.nonwork, 1)) * 100),
        users: d.n,
      }))
      .sort((a, b) => b.avgScore - a.avgScore),
    top: ranked.slice(0, 5),
    bottom: ranked.slice(-5).reverse(),
  };
}

export type HeatmapResult = { matrix: number[][]; max: number };

/** Průměrné aktivní minuty podle dne v týdnu (0=Ne) × hodina (0–23). */
export async function heatmap(from: Date, to: Date, department?: string, userId?: string): Promise<HeatmapResult> {
  const userIds = userId
    ? [userId]
    : (
        await prisma.monitoredUser.findMany({
          where: { active: true, ...(department ? { department } : {}) },
          select: { id: true },
        })
      ).map((u) => u.id);

  const rows = await prisma.activityInterval.findMany({
    where: { userId: { in: userIds }, intervalStart: { gte: from, lt: to } },
    select: { intervalStart: true, activeSeconds: true },
  });

  // počet výskytů každého dne v týdnu v období (pro průměr na slot)
  const dowCount = new Array(7).fill(0);
  for (let t = from.getTime(); t < to.getTime(); t += 24 * 60 * 60 * 1000) {
    dowCount[new Date(t).getUTCDay()]++;
  }

  const sum: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
  for (const r of rows) {
    const d = new Date(r.intervalStart);
    sum[d.getUTCDay()][d.getUTCHours()] += r.activeSeconds / 60;
  }

  let max = 0;
  const matrix = sum.map((row, dow) =>
    row.map((v) => {
      const days = Math.max(dowCount[dow], 1);
      const avg = v / days; // průměrné aktivní minuty v daném slotu (napříč uživateli)
      max = Math.max(max, avg);
      return Math.round(avg);
    }),
  );
  return { matrix, max: Math.round(max) };
}

// --- Home Office vyhodnocení -------------------------------------------------

const dk = (d: Date) => new Date(d).toISOString().slice(0, 10);

export type HomeOfficeResult = {
  company: {
    usersWithHo: number;
    hoDays: number; officeDays: number;
    hoScore: number; officeScore: number;
    hoActiveHours: number; officeActiveHours: number;
    hoNonWorkPct: number; officeNonWorkPct: number;
  };
  byDept: { department: string; hoScore: number; officeScore: number; hoDays: number }[];
  perUser: { userId: string; displayName: string | null; department: string | null; hoDays: number; hoScore: number; officeScore: number; diff: number }[];
};

export async function homeOffice(from: Date, to: Date, department?: string): Promise<HomeOfficeResult> {
  const users = await prisma.monitoredUser.findMany({
    where: { active: true, ...(department ? { department } : {}) },
    select: { id: true, displayName: true, department: true },
  });
  const ids = users.map((u) => u.id);
  const expectedPerDay = config.expectedWorkHoursPerDay * 60;
  const totalWorkdays = countWorkdays(from, to);
  const catMap = await getCategoryMap();
  const webRules = await getWebRules();

  // HO dny z OKbase (Absence type HOME_OFFICE)
  const abs = await prisma.absence.findMany({
    where: { userId: { in: ids }, type: 'HOME_OFFICE', date: { gte: from, lt: to } },
    select: { userId: true, date: true },
  });
  const hoDaysByUser = new Map<string, Set<string>>();
  for (const a of abs) {
    let s = hoDaysByUser.get(a.userId);
    if (!s) (s = new Set()), hoDaysByUser.set(a.userId, s);
    s.add(dk(a.date));
  }

  const intervals = await prisma.activityInterval.findMany({
    where: { userId: { in: ids }, intervalStart: { gte: from, lt: to } },
    select: { userId: true, intervalStart: true, activeSeconds: true, foregroundApp: true, windowTitle: true },
  });

  type B = { work: number; nonwork: number };
  const acc = new Map<string, { ho: B; office: B }>();
  for (const u of ids) acc.set(u, { ho: { work: 0, nonwork: 0 }, office: { work: 0, nonwork: 0 } });
  for (const it of intervals) {
    const m = it.activeSeconds / 60;
    if (m <= 0) continue;
    const set = hoDaysByUser.get(it.userId);
    const isHO = set ? set.has(dk(it.intervalStart)) : false;
    const info = classifyActivity(catMap, webRules, it.foregroundApp, it.windowTitle);
    const a = acc.get(it.userId)!;
    const b = isHO ? a.ho : a.office;
    if (info.type === 'NON_WORK') b.nonwork += m;
    else if (info.type === 'UNKNOWN') { /* nezařazeno – vyjmuto */ }
    else b.work += m;
  }

  const score = (work: number, days: number) => (days > 0 ? clampPct((work / (days * expectedPerDay)) * 100) : 0);

  let cHoWork = 0, cOfficeWork = 0, cHoNon = 0, cOfficeNon = 0, cHoDays = 0, cOfficeDays = 0, usersWithHo = 0;
  const deptMap = new Map<string, { hoWork: number; officeWork: number; hoDays: number; officeDays: number }>();
  const perUser: HomeOfficeResult['perUser'] = [];

  for (const u of users) {
    const a = acc.get(u.id)!;
    const hoDays = hoDaysByUser.get(u.id)?.size ?? 0;
    const officeDays = Math.max(totalWorkdays - hoDays, 0);
    if (hoDays > 0) usersWithHo++;
    cHoWork += a.ho.work; cOfficeWork += a.office.work; cHoNon += a.ho.nonwork; cOfficeNon += a.office.nonwork;
    cHoDays += hoDays; cOfficeDays += officeDays;

    const dep = u.department ?? '—';
    const d = deptMap.get(dep) ?? { hoWork: 0, officeWork: 0, hoDays: 0, officeDays: 0 };
    d.hoWork += a.ho.work; d.officeWork += a.office.work; d.hoDays += hoDays; d.officeDays += officeDays;
    deptMap.set(dep, d);

    if (hoDays > 0) {
      const hoScore = score(a.ho.work, hoDays);
      const officeScore = score(a.office.work, officeDays);
      perUser.push({ userId: u.id, displayName: u.displayName, department: u.department, hoDays, hoScore, officeScore, diff: hoScore - officeScore });
    }
  }
  perUser.sort((x, y) => x.diff - y.diff); // největší propad na HO nahoře

  return {
    company: {
      usersWithHo,
      hoDays: cHoDays, officeDays: cOfficeDays,
      hoScore: score(cHoWork, cHoDays), officeScore: score(cOfficeWork, cOfficeDays),
      hoActiveHours: Math.round(cHoWork / 60), officeActiveHours: Math.round(cOfficeWork / 60),
      hoNonWorkPct: clampPct((cHoNon / Math.max(cHoWork + cHoNon, 1)) * 100),
      officeNonWorkPct: clampPct((cOfficeNon / Math.max(cOfficeWork + cOfficeNon, 1)) * 100),
    },
    byDept: Array.from(deptMap.entries())
      .map(([department, d]) => ({ department, hoScore: score(d.hoWork, d.hoDays), officeScore: score(d.officeWork, d.officeDays), hoDays: d.hoDays }))
      .filter((d) => d.hoDays > 0)
      .sort((a, b) => b.officeScore - a.officeScore),
    perUser,
  };
}

// --- Self-report pro zaměstnance (anonymizované srovnání) --------------------

export type SelfReport = {
  displayName: string | null;
  department: string | null;
  score: number;
  companyPercentile: number; // lepší než X % firmy
  deptPercentile: number; // lepší než X % oddělení
  kpmPercentile: number; // rychlejší v psaní než X %
  avgKpm: number;
  activeHours: number;
  nonWorkPct: number;
  monitorTypical: number;
  multiMonitorPct: number;
  appSwitchesPerHour: number;
  keystrokeTotal: number;
  caloriesTyping: number; // orientační kcal spálené psaním
  distanceMeters: number; // orientační „naťukaná" vzdálenost prstů
};

export async function selfReport(userId: string, from: Date, to: Date): Promise<SelfReport> {
  const users = await prisma.monitoredUser.findMany({ where: { active: true }, select: { id: true, department: true } });
  const ids = users.map((u) => u.id);
  const expected = countWorkdays(from, to) * config.expectedWorkHoursPerDay * 60;

  const scores = await perUser(ids, from, to);
  const { interpretMonitors } = await getSettings();
  const factors = await monitorFactorMap(ids, from, to);
  const scoreOf = (id: string) => {
    const raw = userScorePct(scores.get(id) ?? EMPTY_ACC, expected);
    const f = factors.get(id);
    return f ? clampPct(raw * f) : raw;
  };

  const me = await computeUserScore(userId, from, to, { interpretMonitors });
  const myScore = me.score;
  const myDept = users.find((u) => u.id === userId)?.department ?? null;

  const all = ids.map(scoreOf);
  const dept = users.filter((u) => u.department === myDept).map((u) => scoreOf(u.id));
  const pct = (arr: number[]) => (arr.length <= 1 ? 50 : Math.round((arr.filter((v) => v < myScore).length / arr.length) * 100));

  return {
    displayName: me.displayName,
    department: me.department,
    score: myScore,
    companyPercentile: pct(all),
    deptPercentile: pct(dept),
    kpmPercentile: me.kpmPercentile,
    avgKpm: me.avgKpm,
    activeHours: Math.round(me.workMinutes / 60),
    nonWorkPct: me.expectedMinutes ? Math.round((me.nonWorkMinutes / Math.max(me.workMinutes + me.nonWorkMinutes, 1)) * 100) : 0,
    monitorTypical: me.monitorTypical,
    multiMonitorPct: me.multiMonitorPct,
    appSwitchesPerHour: me.appSwitchesPerHour,
    keystrokeTotal: me.keystrokeTotal,
    // Orientační (zábavné) odhady – ne lékařské hodnoty.
    caloriesTyping: Math.round(me.keystrokeTotal * 0.0014),
    distanceMeters: Math.round(me.keystrokeTotal * 0.02),
  };
}

// --- Efektivita podle počtu monitorů -----------------------------------------

export type MonitorAdvice = {
  userId: string;
  displayName: string | null;
  department: string | null;
  monitors: number;
  dominantCategory: string;
  activeHours: number;
  reclaimHoursLow: number; // odhad „získaných" produktivních hodin/období (dolní mez studií)
  reclaimHoursHigh: number; // horní mez
};

export type MonitorsResult = {
  single: { users: number; avgScore: number; avgActiveHours: number };
  multi: { users: number; avgScore: number; avgActiveHours: number };
  perUser: { userId: string; displayName: string | null; department: string | null; monitors: number; score: number }[];
  // Interpretace (nezasahuje do dat): doporučení druhého monitoru pro typy práce,
  // které z něj mají dle studií prokazatelný přínos. upliftLow/High = rozsah +%.
  advice: { upliftLowPct: number; upliftHighPct: number; candidates: MonitorAdvice[] };
};

export async function monitorsComparison(from: Date, to: Date, department?: string): Promise<MonitorsResult> {
  const users = await prisma.monitoredUser.findMany({
    where: { active: true, ...(department ? { department } : {}) },
    select: { id: true, displayName: true, department: true },
  });
  const ids = users.map((u) => u.id);
  const expected = countWorkdays(from, to) * config.expectedWorkHoursPerDay * 60;
  const scores = await perUser(ids, from, to);

  // typický počet monitorů na uživatele (vážený aktivním časem)
  const rows = await prisma.activityInterval.findMany({
    where: { userId: { in: ids }, intervalStart: { gte: from, lt: to }, monitorCount: { not: null } },
    select: { userId: true, activeSeconds: true, monitorCount: true },
  });
  const monByUser = new Map<string, Map<number, number>>();
  for (const r of rows) {
    if (!r.monitorCount || r.activeSeconds <= 0) continue;
    let m = monByUser.get(r.userId);
    if (!m) (m = new Map()), monByUser.set(r.userId, m);
    m.set(r.monitorCount, (m.get(r.monitorCount) ?? 0) + r.activeSeconds);
  }
  const typicalOf = (id: string): number => {
    const m = monByUser.get(id);
    if (!m) return 1;
    let best = -1, count = 1;
    for (const [c, s] of m) if (s > best) ((best = s), (count = c));
    return count;
  };

  const perUserOut: MonitorsResult['perUser'] = [];
  const single: number[] = [], multi: number[] = [];
  const singleHours: number[] = [], multiHours: number[] = [];
  for (const u of users) {
    const score = userScorePct(scores.get(u.id) ?? EMPTY_ACC, expected);
    const hours = (scores.get(u.id)?.work ?? 0) / 60;
    const mon = typicalOf(u.id);
    perUserOut.push({ userId: u.id, displayName: u.displayName, department: u.department, monitors: mon, score });
    if (mon >= 2) { multi.push(score); multiHours.push(hours); } else { single.push(score); singleHours.push(hours); }
  }
  const avg = (a: number[]) => (a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : 0);

  // --- Interpretace: kandidáti na druhý monitor (čistě výpočet nad daty) ------
  const UPLIFT_LOW = 20, UPLIFT_HIGH = 35; // % dle studií (porovnávání/přepínání oken)
  const singleIds = perUserOut.filter((u) => u.monitors <= 1).map((u) => u.userId);
  const candidates: MonitorAdvice[] = [];
  if (singleIds.length > 0) {
    const catMap = await getCategoryMap();
    const webRules = await getWebRules();
    const appRows = await prisma.activityInterval.findMany({
      where: { userId: { in: singleIds }, intervalStart: { gte: from, lt: to } },
      select: { userId: true, foregroundApp: true, windowTitle: true, activeSeconds: true },
    });
    // dominantní WORK kategorie podle aktivních sekund
    const byUser = new Map<string, Map<string, number>>();
    for (const r of appRows) {
      if (r.activeSeconds <= 0) continue;
      const { category, type } = classifyActivity(catMap, webRules, r.foregroundApp, r.windowTitle);
      if (type !== 'WORK') continue;
      let m = byUser.get(r.userId);
      if (!m) (m = new Map()), byUser.set(r.userId, m);
      m.set(category, (m.get(category) ?? 0) + r.activeSeconds);
    }
    for (const u of perUserOut) {
      if (u.monitors > 1) continue;
      const m = byUser.get(u.userId);
      if (!m) continue;
      let domCat = '', domSec = 0;
      for (const [c, s] of m) if (s > domSec) ((domSec = s), (domCat = c));
      if (!MULTI_MONITOR_BENEFIT_CATS.has(domCat)) continue;
      const activeHours = (scores.get(u.userId)?.work ?? 0) / 60;
      if (activeHours < 1) continue; // bez reálné práce nemá smysl doporučovat
      candidates.push({
        userId: u.userId,
        displayName: u.displayName,
        department: u.department,
        monitors: u.monitors,
        dominantCategory: domCat,
        activeHours: Math.round(activeHours),
        reclaimHoursLow: Math.round(activeHours * (UPLIFT_LOW / 100)),
        reclaimHoursHigh: Math.round(activeHours * (UPLIFT_HIGH / 100)),
      });
    }
    candidates.sort((a, b) => b.reclaimHoursHigh - a.reclaimHoursHigh);
  }

  return {
    single: { users: single.length, avgScore: avg(single), avgActiveHours: avg(singleHours) },
    multi: { users: multi.length, avgScore: avg(multi), avgActiveHours: avg(multiHours) },
    perUser: perUserOut.sort((a, b) => b.monitors - a.monitors || b.score - a.score),
    advice: { upliftLowPct: UPLIFT_LOW, upliftHighPct: UPLIFT_HIGH, candidates },
  };
}

// --- Audit softwaru / licencí ------------------------------------------------

export type SoftwareItem = {
  app: string;
  category: string | null;
  type: string;
  activeHours: number;
  users: number; // kolik různých lidí appku reálně používalo
  usersPct: number; // % ze sledovaných
  licensed: boolean;
  seats: number | null;
  costPerSeat: number | null;
  utilizationPct: number | null; // users / seats
  wasteSeats: number | null; // nevyužité licence
  wasteCost: number | null; // měsíční plýtvání (CZK)
};

export type SoftwareAudit = {
  workforce: number;
  totalWasteCost: number; // součet měsíčního plýtvání u placených aplikací
  items: SoftwareItem[];
};

export async function softwareAudit(from: Date, to: Date, department?: string): Promise<SoftwareAudit> {
  const users = await prisma.monitoredUser.findMany({
    where: { active: true, ...(department ? { department } : {}) },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  const workforce = Math.max(users.length, 1);

  const rows = await prisma.activityInterval.findMany({
    where: { userId: { in: ids }, intervalStart: { gte: from, lt: to }, foregroundApp: { not: null } },
    select: { userId: true, activeSeconds: true, foregroundApp: true },
  });

  // app → { sekundy, set uživatelů }
  const usage = new Map<string, { sec: number; users: Set<string> }>();
  for (const r of rows) {
    if (!r.foregroundApp || r.activeSeconds <= 0) continue;
    let u = usage.get(r.foregroundApp);
    if (!u) (u = { sec: 0, users: new Set() }), usage.set(r.foregroundApp, u);
    u.sec += r.activeSeconds;
    u.users.add(r.userId);
  }

  const cats = await prisma.appCategory.findMany();
  const catByApp = new Map(cats.map((c) => [c.appName, c]));

  // Zahrň i placené aplikace s NULOVÝM použitím (největší plýtvání).
  const apps = new Set<string>([...usage.keys()]);
  for (const c of cats) if (c.licensed) apps.add(c.appName);

  let totalWasteCost = 0;
  const items: SoftwareItem[] = [];
  for (const app of apps) {
    const u = usage.get(app);
    const c = catByApp.get(app);
    const userCount = u ? u.users.size : 0;
    const seats = c?.seats ?? null;
    const cost = c?.costPerSeat ?? null;
    const licensed = c?.licensed ?? false;
    let utilizationPct: number | null = null;
    let wasteSeats: number | null = null;
    let wasteCost: number | null = null;
    if (licensed && seats && seats > 0) {
      utilizationPct = Math.round((userCount / seats) * 100);
      wasteSeats = Math.max(seats - userCount, 0);
      wasteCost = cost ? Math.round(wasteSeats * cost) : null;
      if (wasteCost) totalWasteCost += wasteCost;
    }
    items.push({
      app,
      category: c?.category ?? null,
      type: c?.type ?? 'NEUTRAL',
      activeHours: u ? Math.round(u.sec / 3600) : 0,
      users: userCount,
      usersPct: Math.round((userCount / workforce) * 100),
      licensed,
      seats,
      costPerSeat: cost,
      utilizationPct,
      wasteSeats,
      wasteCost,
    });
  }

  // Řazení: placené s největším plýtváním nahoře, pak dle využití.
  items.sort((a, b) => (b.wasteCost ?? -1) - (a.wasteCost ?? -1) || b.activeHours - a.activeHours);

  return { workforce, totalWasteCost, items };
}

// --- Náklady neproduktivního času -------------------------------------------

export type CostResult = {
  workforce: number;
  withRate: number; // kolik lidí má zadanou mzdu
  totals: { nonworkCost: number; idleCost: number; pcoffCost: number; wastedCost: number };
  perUser: {
    userId: string; displayName: string | null; department: string | null;
    hourlyRate: number | null;
    nonworkHours: number; idleHours: number; pcoffHours: number;
    wastedCost: number | null;
  }[];
};

export async function costAudit(from: Date, to: Date, department?: string): Promise<CostResult> {
  const users = await prisma.monitoredUser.findMany({
    where: { active: true, ...(department ? { department } : {}) },
    select: { id: true, displayName: true, department: true, hourlyRate: true },
  });
  const ids = users.map((u) => u.id);
  const expected = countWorkdays(from, to) * config.expectedWorkHoursPerDay * 60;
  const cur = await perUser(ids, from, to);

  let tNon = 0, tIdle = 0, tPcoff = 0, withRate = 0;
  const perUserOut: CostResult['perUser'] = [];
  for (const u of users) {
    const a = cur.get(u.id) ?? EMPTY_ACC;
    const adjExpected = Math.max(expected - a.unknown, 1);
    const pcoff = Math.max(adjExpected - (a.work + a.nonwork + a.idle), 0);
    const rate = u.hourlyRate ?? null;
    const nonworkHours = a.nonwork / 60, idleHours = a.idle / 60, pcoffHours = pcoff / 60;
    let wastedCost: number | null = null;
    if (rate != null) {
      withRate++;
      tNon += nonworkHours * rate; tIdle += idleHours * rate; tPcoff += pcoffHours * rate;
      wastedCost = Math.round((nonworkHours + idleHours + pcoffHours) * rate);
    }
    perUserOut.push({
      userId: u.id, displayName: u.displayName, department: u.department, hourlyRate: rate,
      nonworkHours: Math.round(nonworkHours), idleHours: Math.round(idleHours), pcoffHours: Math.round(pcoffHours),
      wastedCost,
    });
  }
  perUserOut.sort((a, b) => (b.wastedCost ?? -1) - (a.wastedCost ?? -1));

  return {
    workforce: users.length,
    withRate,
    totals: {
      nonworkCost: Math.round(tNon), idleCost: Math.round(tIdle), pcoffCost: Math.round(tPcoff),
      wastedCost: Math.round(tNon + tIdle + tPcoff),
    },
    perUser: perUserOut,
  };
}

// --- Export položek k zařazení (dávková klasifikace) -------------------------

export type ClassificationExport = {
  generatedAt: string;
  apps: { app: string; hours: number; type: CatType; category: string }[];
  titles: { title: string; hours: number; type: CatType; category: string }[];
};

/** Vyexportuje aplikace a titulky oken k zařazení (zejm. nezařazené UNKNOWN). */
export async function exportClassification(from: Date, to: Date, onlyUnknown = true): Promise<ClassificationExport> {
  const catMap = await getCategoryMap();
  const webRules = await getWebRules();
  const rows = await prisma.activityInterval.findMany({
    where: { intervalStart: { gte: from, lt: to } },
    select: { activeSeconds: true, foregroundApp: true, windowTitle: true },
  });
  const apps = new Map<string, number>();
  const titles = new Map<string, number>();
  for (const r of rows) {
    if (r.activeSeconds <= 0) continue;
    if (r.foregroundApp) apps.set(r.foregroundApp, (apps.get(r.foregroundApp) ?? 0) + r.activeSeconds);
    if (r.windowTitle) titles.set(r.windowTitle, (titles.get(r.windowTitle) ?? 0) + r.activeSeconds);
  }
  const mapApps = Array.from(apps.entries()).map(([app, sec]) => {
    const info = classifyActivity(catMap, webRules, app, null);
    return { app, hours: Math.round(sec / 3600), type: info.type, category: info.category };
  });
  const mapTitles = Array.from(titles.entries()).map(([title, sec]) => {
    const info = classifyActivity(catMap, webRules, null, title);
    return { title, hours: Math.round(sec / 3600), type: info.type, category: info.category };
  });
  const flt = (x: { type: CatType }) => (onlyUnknown ? x.type === 'UNKNOWN' : true);
  return {
    generatedAt: new Date().toISOString(),
    apps: mapApps.filter(flt).sort((a, b) => b.hours - a.hours),
    titles: mapTitles.filter(flt).sort((a, b) => b.hours - a.hours),
  };
}
