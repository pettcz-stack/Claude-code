import { prisma } from '../db.js';
import { config } from '../config.js';
import { getCategoryMap, type CatType } from './categories.js';

export type ScoreBreakdown = {
  expectedMinutes: number;
  workMinutes: number; // aktivní práce (WORK + NEUTRAL)
  nonWorkMinutes: number; // aktivní mimopráce (NON_WORK)
  idleOnMinutes: number; // PC zapnutý, ale nečinnost (vč. zamčeno)
  pcOffMinutes: number; // měl pracovat, ale PC nebyl aktivní/zapnutý
  meetingMinutes: number; // DEMO odhad (porady) – nahradí Outlook (Fáze 3)
  // procenta z očekávaného fondu
  workPct: number;
  nonWorkPct: number;
  idlePct: number;
  pcOffPct: number;
  score: number; // = workPct
};

export type CategorySlice = { category: string; type: CatType; minutes: number };

export type UserScore = ScoreBreakdown & {
  userId: string;
  displayName: string | null;
  department: string | null;
  avgKpm: number;
  kpmPercentile: number; // „lepší než X % firmy"
  categories: CategorySlice[];
  topApp: string | null;
};

function countWorkdays(from: Date, to: Date): number {
  let days = 0;
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  while (d < to) {
    const dow = d.getUTCDay();
    if (dow >= 1 && dow <= 5) days++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return Math.max(days, 1);
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/** Spočítá skóre a rozpad jednoho uživatele za období. */
export async function computeUserScore(userId: string, from: Date, to: Date): Promise<UserScore> {
  const user = await prisma.monitoredUser.findUnique({
    where: { id: userId },
    select: { id: true, displayName: true, department: true },
  });
  const catMap = await getCategoryMap();

  const hourly = await prisma.activityHourly.findMany({
    where: { userId, hourStart: { gte: from, lt: to } },
  });

  let workMinutes = 0;
  let nonWorkMinutes = 0;
  let idleOnMinutes = 0;
  let totalKeystrokes = 0;
  const catMinutes = new Map<string, { type: CatType; minutes: number }>();
  const appActive = new Map<string, number>();

  for (const h of hourly) {
    idleOnMinutes += h.idleMinutes + h.lockedMinutes;
    totalKeystrokes += h.keystrokeTotal;
    const info = h.topApp ? catMap[h.topApp] : undefined;
    const type: CatType = info?.type ?? 'NEUTRAL';
    const category = info?.category ?? (h.topApp ? 'Ostatní' : 'Bez aktivity');
    if (type === 'NON_WORK') nonWorkMinutes += h.activeMinutes;
    else workMinutes += h.activeMinutes; // WORK + NEUTRAL

    const slice = catMinutes.get(category) ?? { type, minutes: 0 };
    slice.minutes += h.activeMinutes;
    catMinutes.set(category, slice);
    if (h.topApp) appActive.set(h.topApp, (appActive.get(h.topApp) ?? 0) + h.activeMinutes);
  }

  const expectedMinutes = countWorkdays(from, to) * config.expectedWorkHoursPerDay * 60;
  const trackedOnMinutes = workMinutes + nonWorkMinutes + idleOnMinutes;
  const pcOffMinutes = Math.max(expectedMinutes - trackedOnMinutes, 0);
  // DEMO: část „PC off" připíšeme poradám (nahradí Outlook). Jen ilustrace.
  const meetingMinutes = Math.round(pcOffMinutes * 0.35);

  const avgKpm = workMinutes + nonWorkMinutes > 0 ? totalKeystrokes / (workMinutes + nonWorkMinutes) : 0;
  const kpmPercentile = await kpmPercentileForUser(userId, from, to, avgKpm);

  let topApp: string | null = null;
  let best = -1;
  for (const [app, m] of appActive) if (m > best) ((best = m), (topApp = app));

  const categories: CategorySlice[] = Array.from(catMinutes.entries())
    .map(([category, v]) => ({ category, type: v.type, minutes: Math.round(v.minutes) }))
    .sort((a, b) => b.minutes - a.minutes);

  return {
    userId,
    displayName: user?.displayName ?? null,
    department: user?.department ?? null,
    expectedMinutes,
    workMinutes: Math.round(workMinutes),
    nonWorkMinutes: Math.round(nonWorkMinutes),
    idleOnMinutes: Math.round(idleOnMinutes),
    pcOffMinutes: Math.round(pcOffMinutes),
    meetingMinutes,
    workPct: pct(workMinutes, expectedMinutes),
    nonWorkPct: pct(nonWorkMinutes, expectedMinutes),
    idlePct: pct(idleOnMinutes, expectedMinutes),
    pcOffPct: pct(pcOffMinutes, expectedMinutes),
    score: pct(workMinutes, expectedMinutes),
    avgKpm: Math.round(avgKpm),
    kpmPercentile,
    categories,
    topApp,
  };
}

/** Percentil průměrného tempa psaní uživatele vůči ostatním („lepší než X %"). */
async function kpmPercentileForUser(userId: string, from: Date, to: Date, userKpm: number): Promise<number> {
  const users = await prisma.monitoredUser.findMany({ where: { active: true }, select: { id: true } });
  const kpms: number[] = [];
  for (const u of users) {
    const agg = await prisma.activityHourly.aggregate({
      where: { userId: u.id, hourStart: { gte: from, lt: to } },
      _sum: { keystrokeTotal: true, activeMinutes: true },
    });
    const active = agg._sum.activeMinutes ?? 0;
    const ks = agg._sum.keystrokeTotal ?? 0;
    if (active > 0) kpms.push(ks / active);
  }
  if (kpms.length <= 1) return 50;
  const lower = kpms.filter((k) => k < userKpm).length;
  return Math.round((lower / kpms.length) * 100);
}
