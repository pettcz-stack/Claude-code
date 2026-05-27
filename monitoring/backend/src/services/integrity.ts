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

  // Bereme jen výrazně aktivní intervaly (>= 2 min aktivní).
  const active = intervals.filter((i) => i.activeSeconds >= 120);
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
  const alerts = [];
  for (const u of users) {
    const r = await computeIntegrity(u.id, from, to);
    if (r.flags.length > 0) {
      alerts.push({ userId: u.id, displayName: u.displayName, department: u.department, riskScore: r.riskScore, suspicious: r.suspicious, flags: r.flags });
    }
  }
  alerts.sort((a, b) => b.riskScore - a.riskScore);
  return alerts;
}
