import { prisma } from '../db.js';
import { demoUserWhere } from './demoFilter.js';
import { deptWhere } from './accessControl.js';

export type IntegrityFlag = {
  type: 'MOUSE_JIGGLER' | 'KEYBOARD_WEIGHT' | 'NO_APP_SWITCH' | 'ROBOTIC_REGULARITY';
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

  // Bereme jen výrazně aktivní intervaly (>= 30 s aktivní z 60 s intervalu = aspoň půlka).
  // Pozn.: dříve >= 120 s, ale agent posílá 60s intervaly → nikdy se to netriggerlo.
  const active = intervals.filter((i) => i.activeSeconds >= 30);
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

  // Optimalizace: místo 1991 sekvenčních findMany volání (= 1991 SQLite roundtripů)
  // načteme všechny intervaly za období jedním dotazem a v JS rozdělíme per-user.
  // Pro 1991 uživatelů × 72 h × ~32 intervalů/h ~ 4.5M intervalů — moc pro paměť.
  // Filtrujeme přímo v SQL na active >= 30 (matchuje filtr v computeIntegrity)
  // a ořeže to na ~10-20% intervalů.
  const userIdSet = new Set(users.map((u) => u.id));
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

  const alerts = [];
  for (const u of users) {
    const active = byUser.get(u.id) ?? [];
    const r = computeIntegrityFromIntervals(u.id, active);
    if (r.flags.length > 0) {
      alerts.push({ userId: u.id, displayName: u.displayName, department: u.department, riskScore: r.riskScore, suspicious: r.suspicious, flags: r.flags });
    }
  }
  alerts.sort((a, b) => b.riskScore - a.riskScore);
  return alerts;
}

/** Synchronní jádro integrity – přijme už načtené intervaly. Pro bulk path. */
export function computeIntegrityFromIntervals(
  userId: string,
  active: Array<{ intervalStart: Date; intervalSeconds: number; activeSeconds: number; keystrokeCount: number; mouseEvents: number; foregroundApp: string | null }>,
): IntegrityResult {
  const flags: IntegrityFlag[] = [];
  const minutesOf = (n: number) => Math.round((n * 5));

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
