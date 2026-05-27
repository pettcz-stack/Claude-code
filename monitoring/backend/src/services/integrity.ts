import { prisma } from '../db.js';
import { demoUserWhere } from './demoFilter.js';
import { deptWhere } from './accessControl.js';

export type IntegrityFlag = {
  type: 'MOUSE_JIGGLER' | 'KEYBOARD_WEIGHT' | 'NO_APP_SWITCH' | 'ROBOTIC_REGULARITY'
      | 'PIRATED_SOFTWARE' | 'AFTER_HOURS_ACTIVITY';
  severity: 'high' | 'medium';
  detail: string;
  affectedMinutes: number;
};

export type IntegrityResult = {
  userId: string;
  riskScore: number; // 0–100
  suspicious: boolean;
  flags: IntegrityFlag[];
};

function cv(values: number[]): number {
  if (values.length < 2) return 1;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 1;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

/**
 * Detekce nepovolených praktik (simulátory myši/kláves, předmět na klávesnici,
 * absence přepínání aplikací, roboticky pravidelné vstupy). Pracuje nad
 * agregovanými intervaly – žádný obsah.
 */
export async function computeIntegrity(userId: string, from: Date, to: Date): Promise<IntegrityResult> {
  const intervals = await prisma.activityInterval.findMany({
    where: { userId, intervalStart: { gte: from, lt: to } },
    orderBy: { intervalStart: 'asc' },
    select: { intervalStart: true, intervalSeconds: true, activeSeconds: true, keystrokeCount: true, mouseEvents: true, foregroundApp: true },
  });

  // Bereme jen výrazně aktivní intervaly (>= 50 % intervalu aktivních).
  // Demo: 900s intervaly => >= 450 s; Production: 60s intervaly => >= 30 s.
  // Bez tohoto relativního přístupu by buď cheateři nefungovali (threshold 120
  // pro 60s) nebo by všichni vypadali aktivně (threshold 30 pro 900s).
  const active = intervals.filter((i) => i.activeSeconds * 2 >= i.intervalSeconds);
  const flags: IntegrityFlag[] = [];
  const minutesOf = (n: number) => Math.round((n * 5) ); // intervaly jsou ~5 min v demu; orientačně

  if (active.length >= 12) {
    const total = active.length;
    const mouseOnly = active.filter((i) => i.mouseEvents > 0 && i.keystrokeCount === 0);
    const keysOnly = active.filter((i) => i.keystrokeCount > 0 && i.mouseEvents === 0);
    const distinctApps = new Set(active.map((i) => i.foregroundApp ?? '')).size;

    // nejdelší souvislý běh stejné aplikace v rámci jedné seance
    // (mezera > 60 min mezi intervaly běh resetuje – nepřekračuje dny/přestávky)
    let longestSameApp = 1;
    let run = 1;
    for (let k = 1; k < active.length; k++) {
      const gapMin = (active[k].intervalStart.getTime() - active[k - 1].intervalStart.getTime()) / 60000;
      if (active[k].foregroundApp === active[k - 1].foregroundApp && gapMin <= 60) run++;
      else run = 1;
      longestSameApp = Math.max(longestSameApp, run);
    }

    const ksValues = active.filter((i) => i.keystrokeCount > 0).map((i) => i.keystrokeCount);
    const mouseValues = active.filter((i) => i.mouseEvents > 0).map((i) => i.mouseEvents);
    const ksCv = cv(ksValues);
    const mouseCv = cv(mouseValues);

    // A) Simulátor myši / mouse jiggler
    if (mouseOnly.length / total > 0.8 && distinctApps <= 1) {
      flags.push({
        type: 'MOUSE_JIGGLER',
        severity: 'high',
        detail: 'Dlouhodobý pohyb myši bez jediného úhozu a bez přepínání aplikací – pravděpodobně simulátor myši (mouse jiggler).',
        affectedMinutes: minutesOf(mouseOnly.length),
      });
    }

    // B) Předmět na klávesnici / simulátor kláves
    if (keysOnly.length / total > 0.8 && distinctApps <= 1 && ksCv < 0.15) {
      flags.push({
        type: 'KEYBOARD_WEIGHT',
        severity: 'high',
        detail: 'Trvalé psaní s nepřirozeně pravidelným tempem, bez myši a beze změny aplikace – pravděpodobně předmět na klávesnici nebo simulátor kláves.',
        affectedMinutes: minutesOf(keysOnly.length),
      });
    }

    // C) Žádné přepínání aplikací po velmi dlouhou dobu
    if (longestSameApp >= 24) {
      flags.push({
        type: 'NO_APP_SWITCH',
        severity: 'medium',
        detail: `Více než ${Math.round((longestSameApp * 5) / 60)} h souvislé aktivity bez jediného přepnutí aplikace – netypické pro běžnou práci.`,
        affectedMinutes: minutesOf(longestSameApp),
      });
    }

    // D) Roboticky pravidelné vstupy (nízká variabilita)
    if ((ksValues.length >= 12 && ksCv < 0.08) || (mouseValues.length >= 12 && mouseCv < 0.08)) {
      flags.push({
        type: 'ROBOTIC_REGULARITY',
        severity: 'medium',
        detail: 'Aktivita má strojově pravidelný vzor (téměř identické hodnoty po dlouhou dobu) – možná automatizace vstupu.',
        affectedMinutes: minutesOf(Math.max(ksValues.length, mouseValues.length)),
      });
    }
  }

  const riskScore = Math.min(100, flags.reduce((s, f) => s + (f.severity === 'high' ? 60 : 25), 0));
  return { userId, riskScore, suspicious: flags.some((f) => f.severity === 'high') || riskScore >= 50, flags };
}

/** Spustí detekci pro všechny aktivní uživatele a vrátí jen ty s nálezem. */
export async function detectAlerts(from: Date, to: Date, department?: string | string[]) {
  const users = await prisma.monitoredUser.findMany({
    where: { active: true, ...deptWhere(department), ...(await demoUserWhere()) },
    select: { id: true, displayName: true, department: true },
  });
  if (users.length === 0) return [];

  const userIdSet = new Set(users.map((u) => u.id));

  // 1) Bulk-load všech aktivních intervalů (pro mouse jiggler / keyboard bot / app switching)
  const intervals = await prisma.activityInterval.findMany({
    where: {
      userId: { in: users.map((u) => u.id) },
      intervalStart: { gte: from, lt: to },
      activeSeconds: { gte: 30 },
    },
    orderBy: { intervalStart: 'asc' },
    select: { userId: true, intervalStart: true, intervalSeconds: true, activeSeconds: true, keystrokeCount: true, mouseEvents: true, foregroundApp: true },
  });

  const byUser = new Map<string, typeof intervals>();
  for (const r of intervals) {
    if (!userIdSet.has(r.userId)) continue;
    let arr = byUser.get(r.userId);
    if (!arr) { arr = []; byUser.set(r.userId, arr); }
    arr.push(r);
  }

  // 2) Bulk-load pirátského SW použití (per-user součet active minutes na "Pirátský software")
  const piratedApps = await prisma.appCategory.findMany({
    where: { category: 'Pirátský software' },
    select: { appName: true },
  });
  const piratedSet = new Set(piratedApps.map((a) => a.appName));
  const piratedByUser = new Map<string, { minutes: number; apps: Set<string> }>();
  if (piratedSet.size > 0) {
    const piratedIntervals = await prisma.activityInterval.findMany({
      where: {
        userId: { in: users.map((u) => u.id) },
        intervalStart: { gte: from, lt: to },
        foregroundApp: { in: [...piratedSet] },
      },
      select: { userId: true, activeSeconds: true, foregroundApp: true },
    });
    for (const r of piratedIntervals) {
      if (!r.foregroundApp) continue;
      let info = piratedByUser.get(r.userId);
      if (!info) { info = { minutes: 0, apps: new Set() }; piratedByUser.set(r.userId, info); }
      info.minutes += r.activeSeconds / 60;
      info.apps.add(r.foregroundApp);
    }
  }

  // 3) Bulk-load after-hours aktivity (22:00 - 05:00 místního času) – přibližně přes UTC hodinu.
  // Europe/Prague je UTC+1/+2, tj. 22:00 lokálně = ~20:00-21:00 UTC. Pro detekci stačí hrubě.
  const afterHoursByUser = new Map<string, { minutes: number; nights: Set<string> }>();
  const afterHoursIntervals = await prisma.activityInterval.findMany({
    where: {
      userId: { in: users.map((u) => u.id) },
      intervalStart: { gte: from, lt: to },
      activeSeconds: { gte: 30 },
    },
    select: { userId: true, activeSeconds: true, intervalStart: true },
  });
  for (const r of afterHoursIntervals) {
    const localHour = (r.intervalStart.getUTCHours() + 2) % 24; // CET/CEST hrubý odhad
    if (localHour >= 21 || localHour < 5) {
      let info = afterHoursByUser.get(r.userId);
      if (!info) { info = { minutes: 0, nights: new Set() }; afterHoursByUser.set(r.userId, info); }
      info.minutes += r.activeSeconds / 60;
      info.nights.add(r.intervalStart.toISOString().slice(0, 10));
    }
  }

  const alerts = [];
  for (const u of users) {
    const active = byUser.get(u.id) ?? [];
    const r = computeIntegrityFromIntervals(u.id, active);

    // PIRATED_SOFTWARE flag — > 30 min nelicencovaného SW = high
    const pir = piratedByUser.get(u.id);
    if (pir && pir.minutes >= 30) {
      const sev: 'high' | 'medium' = pir.minutes >= 120 ? 'high' : 'medium';
      const apps = [...pir.apps].slice(0, 4).join(', ');
      r.flags.push({
        type: 'PIRATED_SOFTWARE',
        severity: sev,
        detail: `Použití nelicencovaného / pirátského software (${Math.round(pir.minutes)} min): ${apps}${pir.apps.size > 4 ? ' …' : ''}. Bezpečnostní a právní riziko – malware, audit licencí, GDPR.`,
        affectedMinutes: Math.round(pir.minutes),
      });
      r.riskScore = Math.min(100, r.riskScore + (sev === 'high' ? 70 : 35));
      if (sev === 'high') r.suspicious = true;
    }

    // AFTER_HOURS_ACTIVITY — > 4 noci za období s aktivitou po 21:00 = medium
    const ah = afterHoursByUser.get(u.id);
    if (ah && ah.nights.size >= 4 && ah.minutes >= 60) {
      r.flags.push({
        type: 'AFTER_HOURS_ACTIVITY',
        severity: 'medium',
        detail: `Aktivita mimo pracovní dobu: ${ah.nights.size} nocí, celkem ${Math.round(ah.minutes)} min po 21:00. Může jít o workaholic, ale i o data exfil nebo bota běžícího po směně.`,
        affectedMinutes: Math.round(ah.minutes),
      });
      r.riskScore = Math.min(100, r.riskScore + 20);
    }

    if (r.flags.length > 0) {
      alerts.push({ userId: u.id, displayName: u.displayName, department: u.department, riskScore: r.riskScore, suspicious: r.suspicious, flags: r.flags });
    }
  }
  alerts.sort((a, b) => b.riskScore - a.riskScore);
  return alerts;
}

/** Synchronní jádro integrity – přijme intervaly (jakékoli active úrovně) a sám si je vyfiltruje na >= 50 % active. */
export function computeIntegrityFromIntervals(
  userId: string,
  intervals: Array<{ intervalStart: Date; intervalSeconds: number; activeSeconds: number; keystrokeCount: number; mouseEvents: number; foregroundApp: string | null }>,
): IntegrityResult {
  const flags: IntegrityFlag[] = [];
  const minutesOf = (n: number) => Math.round((n * 5));
  // Relativní filter (funguje pro 60s i 900s intervaly)
  const active = intervals.filter((i) => i.activeSeconds * 2 >= i.intervalSeconds);

  if (active.length >= 12) {
    const total = active.length;
    const mouseOnly = active.filter((i) => i.mouseEvents > 0 && i.keystrokeCount === 0);
    const keysOnly = active.filter((i) => i.keystrokeCount > 0 && i.mouseEvents === 0);
    const distinctApps = new Set(active.map((i) => i.foregroundApp ?? '')).size;

    let longestSameApp = 1;
    let run = 1;
    for (let k = 1; k < active.length; k++) {
      const gapMin = (active[k].intervalStart.getTime() - active[k - 1].intervalStart.getTime()) / 60000;
      if (active[k].foregroundApp === active[k - 1].foregroundApp && gapMin <= 60) run++;
      else run = 1;
      longestSameApp = Math.max(longestSameApp, run);
    }

    const ksValues = active.filter((i) => i.keystrokeCount > 0).map((i) => i.keystrokeCount);
    const mouseValues = active.filter((i) => i.mouseEvents > 0).map((i) => i.mouseEvents);
    const ksCv = cv(ksValues);
    const mouseCv = cv(mouseValues);

    if (mouseOnly.length / total > 0.8 && distinctApps <= 1) {
      flags.push({ type: 'MOUSE_JIGGLER', severity: 'high', detail: 'Dlouhodobý pohyb myši bez jediného úhozu a bez přepínání aplikací – pravděpodobně simulátor myši (mouse jiggler).', affectedMinutes: minutesOf(mouseOnly.length) });
    }
    if (keysOnly.length / total > 0.8 && distinctApps <= 1 && ksCv < 0.15) {
      flags.push({ type: 'KEYBOARD_WEIGHT', severity: 'high', detail: 'Trvalé psaní s nepřirozeně pravidelným tempem, bez myši a beze změny aplikace – pravděpodobně předmět na klávesnici nebo simulátor kláves.', affectedMinutes: minutesOf(keysOnly.length) });
    }
    if (longestSameApp >= 24) {
      flags.push({ type: 'NO_APP_SWITCH', severity: 'medium', detail: `Více než ${Math.round((longestSameApp * 5) / 60)} h souvislé aktivity bez jediného přepnutí aplikace – netypické pro běžnou práci.`, affectedMinutes: minutesOf(longestSameApp) });
    }
    if ((ksValues.length >= 12 && ksCv < 0.08) || (mouseValues.length >= 12 && mouseCv < 0.08)) {
      flags.push({ type: 'ROBOTIC_REGULARITY', severity: 'medium', detail: 'Aktivita má strojově pravidelný vzor (téměř identické hodnoty po dlouhou dobu) – možná automatizace vstupu.', affectedMinutes: minutesOf(Math.max(ksValues.length, mouseValues.length)) });
    }
  }

  const riskScore = Math.min(100, flags.reduce((s, f) => s + (f.severity === 'high' ? 60 : 25), 0));
  return { userId, riskScore, suspicious: flags.some((f) => f.severity === 'high') || riskScore >= 50, flags };
}
