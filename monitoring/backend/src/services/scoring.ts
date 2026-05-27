import { prisma } from '../db.js';
import { config } from '../config.js';
import { getCategoryMap, type CatType } from './categories.js';
import { classifyActivity, getWebRules } from './classify.js';
import { getDeptRules } from './deptrules.js';
import { demoUserWhere } from './demoFilter.js';
import { deptWhere } from './accessControl.js';
import { getSettings } from './settings.js';
import { holidayWeekdaySet, absenceByUser, effectiveWorkdays } from './workcal.js';

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
  /**
   * Průměrné úhozy za minutu jen v intervalech kdy uživatel reálně psal
   * (>= 10 úhozů za 60s). Vylučuje pauzy ze srovnání – fér metrika.
   */
  typingKpm: number;
  /** Minuty (typing) – kolik času celkem strávil aktivním psaním. */
  typingMinutes: number;
  kpmPercentile: number; // „lepší než X % firmy"
  categories: CategorySlice[];
  topApp: string | null;
  monitorTypical: number; // nejčastější počet monitorů
  multiMonitorPct: number; // podíl času na 2+ monitorech
  keystrokeTotal: number; // úhozy celkem za období
  appSwitchesPerHour: number; // přepínání aplikací za hodinu (fragmentace pozornosti)
  scoreRaw: number; // skóre bez interpretace (vždy z plných dat)
  monitorAdjusted: boolean; // bylo skóre upraveno o handicap monitorů?
  vacationDays: number; // dny dovolené v období (z HR) – nezapočítané do fondu
  sickDays: number; // dny nemoci v období (z HR) – nezapočítané do fondu
  holidayDays: number; // státní svátky (Po–Pá) v období – nezapočítané do fondu
  siteDays: { site: string; days: number }[]; // kde pracoval (počet dní podle provozovny; „Mimo firmu")
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

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/** Rozdělení tempa psaní (úhozy/min) všech aktivních lidí za období – spočítá se jednou. */
export async function kpmCohort(from: Date, to: Date): Promise<number[]> {
  const activeUsers = await prisma.monitoredUser.findMany({ where: { active: true, ...(await demoUserWhere()) }, select: { id: true } });
  const activeIds = new Set(activeUsers.map((u) => u.id));
  const grouped = await prisma.activityHourly.groupBy({
    by: ['userId'],
    where: { hourStart: { gte: from, lt: to } },
    _sum: { keystrokeTotal: true, activeMinutes: true },
  });
  const kpms: number[] = [];
  for (const g of grouped) {
    if (!activeIds.has(g.userId)) continue;
    const mins = g._sum.activeMinutes ?? 0;
    if (mins > 0) kpms.push((g._sum.keystrokeTotal ?? 0) / mins);
  }
  return kpms;
}

function percentileOf(value: number, cohort: number[]): number {
  if (cohort.length <= 1) return 50;
  const lower = cohort.filter((k) => k < value).length;
  return Math.round((lower / cohort.length) * 100);
}

export type ScoreboardRow = {
  userId: string; displayName: string | null; department: string | null;
  score: number; scoreRaw: number; monitorAdjusted: boolean;
  workPct: number; nonWorkPct: number; idlePct: number; pcOffPct: number; avgKpm: number;
};

/** Žebříček skóre všech aktivních uživatelů – čte z denních souhrnů (rychlé nad roky dat). */
export async function scoreboardRows(from: Date, to: Date, department?: string | string[]): Promise<ScoreboardRow[]> {
  const users = await prisma.monitoredUser.findMany({
    where: { active: true, ...deptWhere(department), ...(await demoUserWhere()) },
    select: { id: true, displayName: true, department: true },
  });
  const ids = users.map((u) => u.id);
  const { interpretMonitors } = await getSettings();
  // Fond očekávaného času: clampnuty min(workdays × 8h, uplynule minuty od
  // prvni aktivity). Pred nasazenim agenta i v budoucnosti = 0. Pouzivame
  // skutecny timestamp intervalStart, ne pulnoc dne.
  const holidays = holidayWeekdaySet(from, to);
  const absMap = await absenceByUser(ids, from, to, holidays);
  const firstSeen = new Map<string, Date>();
  const minIntervals = await prisma.activityInterval.groupBy({
    by: ['userId'],
    where: { userId: { in: ids } },
    _min: { intervalStart: true },
  });
  for (const r of minIntervals) {
    if (!r._min.intervalStart) continue;
    firstSeen.set(r.userId, r._min.intervalStart > from ? r._min.intervalStart : from);
  }
  const now = Date.now();
  const expectedOf = (uid: string) => {
    const userFrom = firstSeen.get(uid) ?? from;
    const calendar = effectiveWorkdays(userFrom, to, holidays, absMap.get(uid)?.days) * config.expectedWorkHoursPerDay * 60;
    const elapsedMin = Math.max(0, (Math.min(to.getTime(), now) - userFrom.getTime()) / 60_000);
    return Math.min(calendar, elapsedMin);
  };

  const daily = await prisma.dailyStat.findMany({
    where: { userId: { in: ids }, date: { gte: from, lt: to } },
    select: { userId: true, workMin: true, nonWorkMin: true, idleMin: true, unknownMin: true, keystroke: true, monitorTop: true, domWorkCat: true },
  });
  type Agg = { work: number; nonwork: number; idle: number; unknown: number; ks: number; monDays: Map<number, number>; catMin: Map<string, number> };
  const byUser = new Map<string, Agg>();
  for (const d of daily) {
    let a = byUser.get(d.userId);
    if (!a) { a = { work: 0, nonwork: 0, idle: 0, unknown: 0, ks: 0, monDays: new Map(), catMin: new Map() }; byUser.set(d.userId, a); }
    a.work += d.workMin; a.nonwork += d.nonWorkMin; a.idle += d.idleMin; a.unknown += d.unknownMin; a.ks += d.keystroke;
    if (d.monitorTop > 0) a.monDays.set(d.monitorTop, (a.monDays.get(d.monitorTop) ?? 0) + 1);
    if (d.domWorkCat) a.catMin.set(d.domWorkCat, (a.catMin.get(d.domWorkCat) ?? 0) + d.workMin);
  }
  const clampPct = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

  const out: ScoreboardRow[] = [];
  for (const u of users) {
    const a = byUser.get(u.id) ?? { work: 0, nonwork: 0, idle: 0, unknown: 0, ks: 0, monDays: new Map(), catMin: new Map() };
    const adjExpected = Math.max(expectedOf(u.id) - a.unknown, 1);
    const scoreRaw = clampPct((a.work / adjExpected) * 100);
    // typický počet monitorů (nejčastější den) + dominantní pracovní kategorie
    let typical = 0, bd = -1; for (const [c, n] of a.monDays) if (n > bd) { bd = n; typical = c; }
    let domCat = '', bc = -1; for (const [c, m] of a.catMin) if (m > bc) { bc = m; domCat = c; }
    const adjust = interpretMonitors && typical >= 1 && typical < 3 && MULTI_MONITOR_BENEFIT_CATS.has(domCat);
    const score = adjust ? Math.min(100, Math.round(scoreRaw * monitorHandicapFactor(typical))) : scoreRaw;
    const pcOff = Math.max(adjExpected - (a.work + a.nonwork + a.idle), 0);
    out.push({
      userId: u.id, displayName: u.displayName, department: u.department,
      score, scoreRaw, monitorAdjusted: adjust,
      workPct: clampPct((a.work / adjExpected) * 100),
      nonWorkPct: clampPct((a.nonwork / adjExpected) * 100),
      idlePct: clampPct((a.idle / adjExpected) * 100),
      pcOffPct: clampPct((pcOff / adjExpected) * 100),
      avgKpm: a.work + a.nonwork > 0 ? Math.round(a.ks / (a.work + a.nonwork)) : 0,
    });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

/** Spočítá skóre a rozpad jednoho uživatele za období. */
export async function computeUserScore(userId: string, from: Date, to: Date, opts?: { interpretMonitors?: boolean; kpmCohort?: number[] }): Promise<UserScore> {
  const user = await prisma.monitoredUser.findUnique({
    where: { id: userId },
    select: { id: true, displayName: true, department: true },
  });
  const catMap = await getCategoryMap();
  const webRules = await getWebRules();
  const deptRules = await getDeptRules();
  const department = user?.department ?? null;

  // Počítáme z intervalů – klasifikace podle aplikace + titulku okna je přesnější
  // a rozliší práci/zábavu i uvnitř prohlížeče.
  const intervals = await prisma.activityInterval.findMany({
    where: { userId, intervalStart: { gte: from, lt: to } },
    orderBy: { intervalStart: 'asc' },
    select: { activeSeconds: true, idleSeconds: true, foregroundApp: true, windowTitle: true, keystrokeCount: true, monitorCount: true, typingMs: true, typingKeystrokeCount: true },
  });

  let workMinutes = 0;
  let nonWorkMinutes = 0;
  let unknownMinutes = 0; // nezařazeno – vyjmuto ze statistik
  let idleOnMinutes = 0;
  let totalKeystrokes = 0;
  // Tempo psaní:
  //  Faze 2 (preferovana): agent posila typingMs + typingKeystrokeCount per interval,
  //    measured precizne: kazdy uhoz-uhoz s gapem < 5s pocita do "typing session".
  //  Faze 1 (fallback): pro stare agenty (bez typingMs) bereme intervaly s >= 10
  //    uhozy a predpokladame ~60s typing per interval.
  let typingMsTotal = 0;            // suma agentovi typingMs (faze 2)
  let typingKeystrokesFromAgent = 0;
  let typingKeystrokes = 0;          // faze 1 fallback
  let typingIntervalMinutes = 0;     // faze 1 fallback
  const TYPING_INTERVAL_MIN_KEYS = 10;
  const catMinutes = new Map<string, { type: CatType; minutes: number }>();
  const appActive = new Map<string, number>();
  const monitorMinutes = new Map<number, number>(); // počet monitorů → aktivní minuty
  let appSwitches = 0;
  let prevApp: string | null = null;

  for (const it of intervals) {
    const activeMin = it.activeSeconds / 60;
    idleOnMinutes += it.idleSeconds / 60;
    totalKeystrokes += it.keystrokeCount;
    if (it.typingMs > 0) {
      // Faze 2: agent posila presny typing time
      typingMsTotal += it.typingMs;
      typingKeystrokesFromAgent += it.typingKeystrokeCount;
    } else if (it.keystrokeCount >= TYPING_INTERVAL_MIN_KEYS && activeMin > 0) {
      // Faze 1 fallback: pro stare agenty bez typingMs pole
      typingKeystrokes += it.keystrokeCount;
      typingIntervalMinutes += activeMin;
    }
    if (activeMin <= 0) continue;
    if (it.monitorCount && it.monitorCount > 0) {
      monitorMinutes.set(it.monitorCount, (monitorMinutes.get(it.monitorCount) ?? 0) + activeMin);
    }
    if (it.foregroundApp) {
      if (prevApp !== null && prevApp !== it.foregroundApp) appSwitches++;
      prevApp = it.foregroundApp;
    }

    const info = classifyActivity(catMap, webRules, it.foregroundApp, it.windowTitle, deptRules, department);
    if (info.type === 'NON_WORK') nonWorkMinutes += activeMin;
    else if (info.type === 'UNKNOWN') unknownMinutes += activeMin; // vyjmuto
    else workMinutes += activeMin; // WORK + NEUTRAL

    const slice = catMinutes.get(info.category) ?? { type: info.type, minutes: 0 };
    slice.minutes += activeMin;
    catMinutes.set(info.category, slice);
    if (it.foregroundApp) appActive.set(it.foregroundApp, (appActive.get(it.foregroundApp) ?? 0) + activeMin);
  }

  // Volno (svátek/dovolená/nemoc) se NEpočítá do fondu – nepracoval, protože měl volno.
  // Začátek = max(from, prvního intervalStart) – před nasazením agenta nepočítáme.
  const holidays = holidayWeekdaySet(from, to);
  const absInfo = (await absenceByUser([userId], from, to, holidays)).get(userId);
  const vacationDays = absInfo?.vacation ?? 0;
  const sickDays = absInfo?.sick ?? 0;
  const holidayDays = holidays.size;
  const firstInterval = await prisma.activityInterval.findFirst({
    where: { userId },
    orderBy: { intervalStart: 'asc' },
    select: { intervalStart: true },
  });
  const userFrom = firstInterval && firstInterval.intervalStart > from ? firstInterval.intervalStart : from;
  const effDays = effectiveWorkdays(userFrom, to, holidays, absInfo?.days);
  const calendarExpected = effDays * config.expectedWorkHoursPerDay * 60;
  // Clamp: nepocitej minuty pred prvni aktivitou ani v budoucnosti.
  const nowMs = Date.now();
  const elapsedMin = Math.max(0, (Math.min(to.getTime(), nowMs) - userFrom.getTime()) / 60_000);
  const expectedMinutesRaw = Math.min(calendarExpected, elapsedMin);
  // Kde pracoval – počet dní podle převažující provozovny (z denních souhrnů).
  const siteRows = await prisma.dailyStat.groupBy({
    by: ['site'], where: { userId, date: { gte: from, lt: to } }, _count: { _all: true },
  });
  const siteDays = siteRows
    .map((r) => ({ site: r.site ?? 'Mimo firmu', days: r._count._all }))
    .sort((a, b) => b.days - a.days);
  // Nezařazený čas se vyjme z fondu → nejde do + ani −.
  const expectedMinutes = Math.max(expectedMinutesRaw - unknownMinutes, 1);
  const trackedOnMinutes = workMinutes + nonWorkMinutes + idleOnMinutes;
  const pcOffMinutes = Math.max(expectedMinutes - trackedOnMinutes, 0);
  // DEMO: část „PC off" připíšeme poradám (nahradí Outlook). Jen ilustrace.
  const meetingMinutes = Math.round(pcOffMinutes * 0.35);

  // Klasicke prumerne KPM (vsechen cas) – muze byt zkresleno dlouhymi pauzami.
  const avgKpm = workMinutes + nonWorkMinutes > 0 ? totalKeystrokes / (workMinutes + nonWorkMinutes) : 0;
  // KPM jen behem skutecneho psani:
  //  - Faze 2 (typingMs z agenta): typingKeystrokes / (typingMs / 60000)
  //    presne, gap 5s, neredi se "kratkou pauzou" v 60s intervalu
  //  - Faze 1 fallback: stare agenty co neposilaji typingMs - heuristika
  //    intervaly s >= 10 uhozy
  let typingKpm = 0;
  let typingIntervalMinutesFinal = typingIntervalMinutes;
  if (typingMsTotal > 0) {
    const typingMinutes = typingMsTotal / 60_000;
    typingKpm = typingMinutes > 0 ? typingKeystrokesFromAgent / typingMinutes : 0;
    typingIntervalMinutesFinal = typingMinutes;
  } else if (typingIntervalMinutes > 0) {
    typingKpm = typingKeystrokes / typingIntervalMinutes;
  }
  // Cohort se spočítá jednou (předaný) → u žebříčku 100 lidí jen 1 dotaz místo 100.
  const cohort = opts?.kpmCohort ?? (await kpmCohort(from, to));
  const kpmPercentile = percentileOf(avgKpm, cohort);

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
    typingKpm: Math.round(typingKpm),
    typingMinutes: Math.round(typingIntervalMinutesFinal),
    kpmPercentile,
    categories,
    topApp,
    monitorTypical,
    multiMonitorPct,
    keystrokeTotal: totalKeystrokes,
    appSwitchesPerHour,
    scoreRaw,
    monitorAdjusted: adjust,
    vacationDays,
    sickDays,
    holidayDays,
    siteDays,
  };
}

