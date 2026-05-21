import { prisma } from '../db.js';
import { config } from '../config.js';
import { getCategoryMap, type CatType } from './categories.js';
import { classifyActivity, getWebRules } from './classify.js';

export type ScoreBreakdown = {
  expectedMinutes: number;
  workMinutes: number; // aktivní práce (WORK + NEUTRAL)
  nonWorkMinutes: number; // aktivní mimopráce (NON_WORK)
  unknownMinutes: number; // nezařazeno – vyjmuto ze statistik
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
  monitorTypical: number; // nejčastější počet monitorů
  multiMonitorPct: number; // podíl času na 2+ monitorech
  keystrokeTotal: number; // úhozy celkem za období
  appSwitchesPerHour: number; // přepínání aplikací za hodinu (fragmentace pozornosti)
  scoreRaw: number; // skóre bez interpretace (vždy z plných dat)
  monitorAdjusted: boolean; // bylo skóre upraveno o handicap monitorů?
};

// Kategorie práce, kde druhý monitor prokazatelně pomáhá (porovnávání/přepínání oken).
export const MULTI_MONITOR_BENEFIT_CATS = new Set<string>([
  'Kancelář', 'Vývoj', 'Podnikový systém', 'Projektové řízení', 'Grafika', 'Práce – nástroje',
  'CRM', 'CAD / Konstrukce', 'Reporty',
]);

// Relativní pracovní kapacita podle počtu monitorů u práce, která z nich těží
// (dle studií +20–35 %). 1 monitor = výchozí, víc monitorů = větší kapacita.
function monitorCapacity(monitors: number): number {
  if (monitors >= 3) return 1.35;
  if (monitors === 2) return 1.25;
  return 1.0;
}

/**
 * Handicapový faktor: kdo má míň monitorů, je u takové práce v nevýhodě a jeho
 * skóre se férově navýší vůči nejlépe vybavenému (3 monitory). 1 monitor dostane
 * největší bonus, 3 monitory žádný. Nezasahuje do dat – jen interpretace skóre.
 */
export function monitorHandicapFactor(monitors: number): number {
  const capMax = 1.35;
  return capMax / monitorCapacity(monitors);
}

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
export async function computeUserScore(userId: string, from: Date, to: Date, opts?: { interpretMonitors?: boolean }): Promise<UserScore> {
  const user = await prisma.monitoredUser.findUnique({
    where: { id: userId },
    select: { id: true, displayName: true, department: true },
  });
  const catMap = await getCategoryMap();
  const webRules = await getWebRules();

  // Počítáme z intervalů – klasifikace podle aplikace + titulku okna je přesnější
  // a rozliší práci/zábavu i uvnitř prohlížeče.
  const intervals = await prisma.activityInterval.findMany({
    where: { userId, intervalStart: { gte: from, lt: to } },
    orderBy: { intervalStart: 'asc' },
    select: { activeSeconds: true, idleSeconds: true, foregroundApp: true, windowTitle: true, keystrokeCount: true, monitorCount: true },
  });

  let workMinutes = 0;
  let nonWorkMinutes = 0;
  let unknownMinutes = 0; // nezařazeno – vyjmuto ze statistik
  let idleOnMinutes = 0;
  let totalKeystrokes = 0;
  const catMinutes = new Map<string, { type: CatType; minutes: number }>();
  const appActive = new Map<string, number>();
  const monitorMinutes = new Map<number, number>(); // počet monitorů → aktivní minuty
  let appSwitches = 0;
  let prevApp: string | null = null;

  for (const it of intervals) {
    const activeMin = it.activeSeconds / 60;
    idleOnMinutes += it.idleSeconds / 60;
    totalKeystrokes += it.keystrokeCount;
    if (activeMin <= 0) continue;
    if (it.monitorCount && it.monitorCount > 0) {
      monitorMinutes.set(it.monitorCount, (monitorMinutes.get(it.monitorCount) ?? 0) + activeMin);
    }
    if (it.foregroundApp) {
      if (prevApp !== null && prevApp !== it.foregroundApp) appSwitches++;
      prevApp = it.foregroundApp;
    }

    const info = classifyActivity(catMap, webRules, it.foregroundApp, it.windowTitle);
    if (info.type === 'NON_WORK') nonWorkMinutes += activeMin;
    else if (info.type === 'UNKNOWN') unknownMinutes += activeMin; // vyjmuto
    else workMinutes += activeMin; // WORK + NEUTRAL

    const slice = catMinutes.get(info.category) ?? { type: info.type, minutes: 0 };
    slice.minutes += activeMin;
    catMinutes.set(info.category, slice);
    if (it.foregroundApp) appActive.set(it.foregroundApp, (appActive.get(it.foregroundApp) ?? 0) + activeMin);
  }

  const expectedMinutesRaw = countWorkdays(from, to) * config.expectedWorkHoursPerDay * 60;
  // Nezařazený čas se vyjme z fondu → nejde do + ani −.
  const expectedMinutes = Math.max(expectedMinutesRaw - unknownMinutes, 1);
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

  // Monitory: nejčastější počet (vážený aktivním časem) a podíl času na 2+ monitorech
  let monitorTypical = 0;
  let monitorBest = -1;
  let monitorTotal = 0;
  let multiMinutes = 0;
  for (const [count, min] of monitorMinutes) {
    monitorTotal += min;
    if (count >= 2) multiMinutes += min;
    if (min > monitorBest) ((monitorBest = min), (monitorTypical = count));
  }
  const multiMonitorPct = monitorTotal > 0 ? Math.round((multiMinutes / monitorTotal) * 100) : 0;
  const activeAll = workMinutes + nonWorkMinutes;
  const appSwitchesPerHour = activeAll > 0 ? Math.round((appSwitches / (activeAll / 60)) * 10) / 10 : 0;

  // Skóre z plných dat (vždy faktické).
  const scoreRaw = pct(workMinutes, expectedMinutes);
  // Interpretace (volitelná, nezasahuje do dat): u práce těžící z více monitorů
  // navýšíme skóre lidem v nevýhodě (míň monitorů) handicapovým faktorem.
  const dominantWork = categories.find((c) => c.type === 'WORK' || c.type === 'NEUTRAL');
  const benefits = !!dominantWork && MULTI_MONITOR_BENEFIT_CATS.has(dominantWork.category);
  const adjust = !!opts?.interpretMonitors && benefits && monitorTypical >= 1 && monitorTypical < 3;
  const score = adjust ? Math.min(100, Math.round(scoreRaw * monitorHandicapFactor(monitorTypical))) : scoreRaw;

  return {
    userId,
    displayName: user?.displayName ?? null,
    department: user?.department ?? null,
    expectedMinutes,
    workMinutes: Math.round(workMinutes),
    nonWorkMinutes: Math.round(nonWorkMinutes),
    unknownMinutes: Math.round(unknownMinutes),
    idleOnMinutes: Math.round(idleOnMinutes),
    pcOffMinutes: Math.round(pcOffMinutes),
    meetingMinutes,
    workPct: pct(workMinutes, expectedMinutes),
    nonWorkPct: pct(nonWorkMinutes, expectedMinutes),
    idlePct: pct(idleOnMinutes, expectedMinutes),
    pcOffPct: pct(pcOffMinutes, expectedMinutes),
    score,
    avgKpm: Math.round(avgKpm),
    kpmPercentile,
    categories,
    topApp,
    monitorTypical,
    multiMonitorPct,
    keystrokeTotal: totalKeystrokes,
    appSwitchesPerHour,
    scoreRaw,
    monitorAdjusted: adjust,
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
