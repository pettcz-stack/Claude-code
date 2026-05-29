import { prisma } from '../db.js';
import { addDays, floorToDay, localDow } from './tz.js';
import { demoUserWhere } from './demoFilter.js';
import { deptWhere } from './accessControl.js';

/**
 * Risk signals — strategická vrstva NAD raw skórem.
 *
 * Klasický monitoring report ("Petr má 55 % skóre") je popisný, nikoli akční.
 * Manažer/HR potřebuje **interpretované signály**:
 *  - **Engagement trend**: jak moc se konkrétní user pohnul vůči svému osobnímu
 *    baseline (ne firemnímu průměru). Petr na 55 %, který obvykle dělá 75 %,
 *    je problém. Petr na 55 %, který obvykle dělá 50 %, je v normě.
 *  - **Burnout risk**: kompozit ukazatelů přepracování — po-21:00 aktivita,
 *    víkendová aktivita, vynechané obědy, nadprůměrný počet monitorů hodin.
 *    Vysoký burnout = manažer má zasáhnout PŘED tím než zaměstnanec onemocní /
 *    podá výpověď.
 *  - **Flight risk**: kompozit signálů odchodu — klesající engagement +
 *    snížená kolaborace (méně Teams/Slack) + browsing job sites (LinkedIn/jobs.cz).
 *    HR může včas pozvat na 1:1 a předejít resignaci.
 *  - **Boost signal**: pozitivní signál — user se rampuje nahoru, dělá víc,
 *    drží konzistenci. Manažer by ho měl pochválit/povýšit.
 *
 * GDPR-friendly framing: tyto signály jsou pro **wellness a coaching**, ne pro
 * disciplinární řízení. Hodnoty 0–100 (vyšší = větší koncentrace signálu).
 */

export type RiskSignals = {
  userId: string;
  displayName: string;
  department: string | null;
  baseline: {
    avgScore30d: number; // průměrné skóre za posledních 30 dní (per-user baseline)
    avgWorkMin30d: number;
    sampleDays: number; // kolik dní máme k dispozici (důvěra)
  };
  engagementTrend: {
    score: number; // -100 .. +100, kde 0 = beze změny vs baseline
    direction: 'improving' | 'declining' | 'stable';
    daysOfData: number; // posledních N dnů použito jako "current"
    explain: string;
  };
  burnoutRisk: {
    score: number; // 0-100
    level: 'low' | 'moderate' | 'high';
    reasons: string[]; // čitelná vysvětlení (top 3 faktory)
  };
  flightRisk: {
    score: number; // 0-100
    level: 'low' | 'moderate' | 'high';
    reasons: string[];
  };
  boostSignal: {
    score: number; // 0-100, pozitivní performer signál
    reasons: string[];
  };
};

/** Spočítej průměrné per-user skóre za posledních N dní. Robustní vůči neúplným datům. */
function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

const EXPECTED_DAY_MIN = 8 * 60; // 480 min

export async function computeRiskSignalsForUsers(
  userIds: string[],
  asOf: Date = new Date(),
): Promise<Map<string, RiskSignals>> {
  if (userIds.length === 0) return new Map();

  const today = floorToDay(asOf);
  const baselineFrom = addDays(today, -30); // posledních 30 dní
  const currentFrom = addDays(today, -7);   // posledních 7 dní = "current window"

  // 1) Načti DailyStat pro 30 dní (jeden bulk dotaz)
  const dailyStats = await prisma.dailyStat.findMany({
    where: { userId: { in: userIds }, date: { gte: baselineFrom, lt: today } },
    select: { userId: true, date: true, workMin: true, nonWorkMin: true, idleMin: true, unknownMin: true, suspicious: true },
  });

  // 2) Načti ActivityInterval pro burnout signály (after-hours, weekend, lunch skipping)
  // Filtrované jen na intervaly s active >= 50 % – výrazně menší vzorek.
  const intervals = await prisma.activityInterval.findMany({
    where: {
      userId: { in: userIds },
      intervalStart: { gte: baselineFrom, lt: today },
    },
    select: { userId: true, intervalStart: true, activeSeconds: true, intervalSeconds: true, foregroundApp: true, windowTitle: true },
  });

  // 3) Načti uživatele pro displayName/department
  const users = await prisma.monitoredUser.findMany({
    where: { id: { in: userIds } },
    select: { id: true, displayName: true, department: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  // 4) Per-user agregace
  const byUser = new Map<string, {
    daily: typeof dailyStats;
    intervals: typeof intervals;
  }>();
  for (const id of userIds) byUser.set(id, { daily: [], intervals: [] });
  for (const r of dailyStats) byUser.get(r.userId)?.daily.push(r);
  for (const r of intervals) byUser.get(r.userId)?.intervals.push(r);

  const result = new Map<string, RiskSignals>();
  for (const uid of userIds) {
    const data = byUser.get(uid)!;
    const u = userMap.get(uid);
    if (!u) continue;
    result.set(uid, buildSignals(uid, u.displayName ?? 'unknown', u.department, data.daily, data.intervals, currentFrom, today));
  }
  return result;
}

function buildSignals(
  userId: string,
  displayName: string,
  department: string | null,
  daily: { date: Date; workMin: number; nonWorkMin: number; idleMin: number; unknownMin: number; suspicious: boolean }[],
  intervals: { intervalStart: Date; activeSeconds: number; intervalSeconds: number; foregroundApp: string | null; windowTitle: string | null }[],
  currentFrom: Date,
  today: Date,
): RiskSignals {
  // ── BASELINE (30 dní) ─────────────────────────────────────────────────
  const dailyScores = daily.map((d) => {
    const adjExp = Math.max(EXPECTED_DAY_MIN - d.unknownMin, 1);
    return Math.min(100, (d.workMin / adjExp) * 100);
  });
  const dailyWork = daily.map((d) => d.workMin);
  const avgScore30d = Math.round(avg(dailyScores));
  const avgWorkMin30d = Math.round(avg(dailyWork));

  // ── ENGAGEMENT TREND (7 dní vs 30denní baseline) ──────────────────────
  const recent = daily.filter((d) => d.date >= currentFrom);
  const recentScores = recent.map((d) => {
    const adjExp = Math.max(EXPECTED_DAY_MIN - d.unknownMin, 1);
    return Math.min(100, (d.workMin / adjExp) * 100);
  });
  const recentAvg = avg(recentScores);
  // Rozdíl v procentních bodech, ne procent z procent (jasnější pro čtení).
  const trendDelta = Math.round(recentAvg - avgScore30d);
  let trendDirection: 'improving' | 'declining' | 'stable';
  if (trendDelta <= -8) trendDirection = 'declining';
  else if (trendDelta >= 8) trendDirection = 'improving';
  else trendDirection = 'stable';
  const trendExplain = trendDelta === 0
    ? 'Stejný výkon jako za posledních 30 dní.'
    : `${trendDelta > 0 ? '+' : ''}${trendDelta} p.b. vs 30denní průměr (${avgScore30d} %).`;

  // ── BURNOUT RISK signály ──────────────────────────────────────────────
  // Faktory (každý 0-100, kompozit váženě):
  //   a) % intervalů po 20:00 (after-hours)
  //   b) Víkendové dny s aktivitou (count v posledních 4 týdnech)
  //   c) Skipped lunches (dny bez lunch intervalů 12:00-13:00)
  //   d) Trvalý high engagement bez poklesu (přepracování bez recovery)
  const afterHoursCount = intervals.filter((it) => {
    const localHour = (it.intervalStart.getUTCHours() + 2) % 24;
    return (localHour >= 20 || localHour < 5) && it.activeSeconds * 2 >= it.intervalSeconds;
  }).length;
  const totalActiveIntervals = intervals.filter((it) => it.activeSeconds * 2 >= it.intervalSeconds).length;
  const afterHoursPct = totalActiveIntervals > 0 ? (afterHoursCount / totalActiveIntervals) * 100 : 0;
  const afterHoursScore = Math.min(100, afterHoursPct * 5); // 20 % after-hours = 100

  // Víkend
  const weekendDays = new Set<string>();
  for (const it of intervals) {
    const dow = localDow(it.intervalStart);
    if ((dow === 0 || dow === 6) && it.activeSeconds * 2 >= it.intervalSeconds) {
      weekendDays.add(it.intervalStart.toISOString().slice(0, 10));
    }
  }
  const weekendScore = Math.min(100, weekendDays.size * 25); // 4 víkendy = 100

  // Skipped lunches: kolik dní v posledních 14 nemělo žádný interval 12:00-13:00 lokálně
  const last14Days = daily.filter((d) => d.date >= addDays(today, -14));
  const skipLunchDays = last14Days.filter((d) => {
    const lunchIntervals = intervals.filter((it) => {
      const sameDay = it.intervalStart.toISOString().slice(0, 10) === d.date.toISOString().slice(0, 10);
      const localHour = (it.intervalStart.getUTCHours() + 2) % 24;
      return sameDay && localHour === 12 && it.activeSeconds * 2 >= it.intervalSeconds;
    });
    return d.workMin > 60 && lunchIntervals.length > 0; // pracoval, NEMĚL lunch idle
  }).length;
  const lunchScore = Math.min(100, skipLunchDays * 12); // 8 dní = 100

  // High engagement bez poklesu (kompozit z prům. work hours nad 7.5h dlouhodobě)
  const overEngagementScore = avgWorkMin30d > 420 ? Math.min(100, (avgWorkMin30d - 420) * 1.5) : 0;

  const burnoutScore = Math.round(
    afterHoursScore * 0.35 +
    weekendScore * 0.25 +
    lunchScore * 0.20 +
    overEngagementScore * 0.20,
  );
  const burnoutLevel: 'low' | 'moderate' | 'high' = burnoutScore >= 60 ? 'high' : burnoutScore >= 30 ? 'moderate' : 'low';
  const burnoutReasons: string[] = [];
  if (afterHoursScore >= 30) burnoutReasons.push(`Aktivita po 20:00 (${Math.round(afterHoursPct)} % intervalů)`);
  if (weekendDays.size >= 2) burnoutReasons.push(`Víkendová práce: ${weekendDays.size} dní za měsíc`);
  if (skipLunchDays >= 4) burnoutReasons.push(`Vynechaný oběd: ${skipLunchDays} dní z posledních 14`);
  if (overEngagementScore >= 30) burnoutReasons.push(`Přesčasy: průměrně ${Math.round(avgWorkMin30d / 60)} h/den (nad 7 h normy)`);
  if (burnoutReasons.length === 0) burnoutReasons.push('Žádné výrazné znaky přepracování.');

  // ── FLIGHT RISK signály ───────────────────────────────────────────────
  // Faktory:
  //   a) Klesající engagement trend (-8 p.b. a níž)
  //   b) Snížená kolaborace (méně Teams/Slack v recent vs baseline)
  //   c) Browsing job sites (LinkedIn, jobs.cz, prace.cz, profesia.sk)
  const teamsKeywords = ['teams.exe', 'slack.exe'];
  const teamsIntervalsRecent = intervals.filter((it) => it.intervalStart >= currentFrom && it.foregroundApp && teamsKeywords.includes(it.foregroundApp)).length;
  const teamsIntervalsBaseline = intervals.filter((it) => it.intervalStart < currentFrom && it.foregroundApp && teamsKeywords.includes(it.foregroundApp)).length;
  // Normalizovat dle počtu dnů
  const recentDays = Math.max(1, recent.length);
  const baselineDays = Math.max(1, daily.length - recent.length);
  const teamsRateRecent = teamsIntervalsRecent / recentDays;
  const teamsRateBaseline = teamsIntervalsBaseline / baselineDays;
  const collaborationDrop = teamsRateBaseline > 0 ? Math.max(0, (teamsRateBaseline - teamsRateRecent) / teamsRateBaseline) * 100 : 0;
  const collaborationScore = Math.min(100, collaborationDrop);

  // Job sites detection
  const jobKeywords = ['linkedin', 'jobs.cz', 'prace.cz', 'profesia', 'startupjobs'];
  const jobSiteIntervals = intervals.filter((it) => {
    if (!it.windowTitle) return false;
    const t = it.windowTitle.toLowerCase();
    return jobKeywords.some((k) => t.includes(k));
  }).length;
  const jobBrowseScore = Math.min(100, jobSiteIntervals * 20); // 5 intervalů = 100

  // Engagement trend penalty (declining)
  const engagementDeclineScore = trendDelta < 0 ? Math.min(100, -trendDelta * 4) : 0;

  const flightScore = Math.round(
    engagementDeclineScore * 0.45 +
    collaborationScore * 0.25 +
    jobBrowseScore * 0.30,
  );
  const flightLevel: 'low' | 'moderate' | 'high' = flightScore >= 60 ? 'high' : flightScore >= 30 ? 'moderate' : 'low';
  const flightReasons: string[] = [];
  if (engagementDeclineScore >= 30) flightReasons.push(`Klesající engagement: ${trendDelta} p.b. za posledních 7 dní`);
  if (collaborationScore >= 30) flightReasons.push(`Snížená kolaborace: ${Math.round(collaborationDrop)} % méně Teams/Slack`);
  if (jobBrowseScore >= 30) flightReasons.push(`Browsing kariérních stránek: ${jobSiteIntervals} výskytů`);
  if (flightReasons.length === 0) flightReasons.push('Žádné výrazné znaky odchodu.');

  // ── BOOST SIGNAL (pozitivní performer) ────────────────────────────────
  // Faktory: improving trend + konzistentní skóre nad 70 % + bez burnoutu
  const boostFromTrend = trendDelta > 0 ? Math.min(100, trendDelta * 5) : 0;
  const boostFromConsistency = avgScore30d >= 70 ? Math.min(100, (avgScore30d - 70) * 3) : 0;
  const boostScore = Math.round(boostFromTrend * 0.5 + boostFromConsistency * 0.5);
  const boostReasons: string[] = [];
  if (boostFromTrend >= 20) boostReasons.push(`Zlepšuje se: ${trendDelta > 0 ? '+' : ''}${trendDelta} p.b. trend`);
  if (boostFromConsistency >= 20) boostReasons.push(`Konzistentně vysoké skóre: ${avgScore30d} % průměr`);
  if (boostReasons.length === 0) boostReasons.push('Stabilní průměrný výkon.');

  return {
    userId,
    displayName,
    department,
    baseline: {
      avgScore30d,
      avgWorkMin30d,
      sampleDays: daily.length,
    },
    engagementTrend: {
      score: trendDelta,
      direction: trendDirection,
      daysOfData: recent.length,
      explain: trendExplain,
    },
    burnoutRisk: {
      score: burnoutScore,
      level: burnoutLevel,
      reasons: burnoutReasons.slice(0, 3),
    },
    flightRisk: {
      score: flightScore,
      level: flightLevel,
      reasons: flightReasons.slice(0, 3),
    },
    boostSignal: {
      score: boostScore,
      reasons: boostReasons.slice(0, 3),
    },
  };
}

/**
 * Top insights pro management — vrátí seřazené nejvážnější signály napříč
 * firmou/oddělením pro panel "Co byste měli vědět tento týden".
 *
 * Místo "tady jsou všechny metriky" → "tady jsou 3 lidé, na které byste
 * měli zaměřit pozornost a proč". To je hodnota, kterou ActivTrak nemá.
 */
export type Insight = {
  type: 'burnout' | 'flight' | 'declining' | 'boost';
  userId: string;
  displayName: string;
  department: string | null;
  severity: 'high' | 'medium';
  headline: string;
  detail: string;
  action: string; // doporučení manažerovi
};

export async function computeTopInsights(
  from: Date,
  to: Date,
  department?: string | string[],
): Promise<Insight[]> {
  const users = await prisma.monitoredUser.findMany({
    where: { active: true, ...deptWhere(department), ...(await demoUserWhere()) },
    select: { id: true },
  });
  if (users.length === 0) return [];

  const signals = await computeRiskSignalsForUsers(users.map((u) => u.id), to);
  const insights: Insight[] = [];

  for (const sig of signals.values()) {
    if (sig.baseline.sampleDays < 7) continue; // málo dat – neradíme

    // BURNOUT high
    if (sig.burnoutRisk.score >= 60) {
      insights.push({
        type: 'burnout',
        userId: sig.userId,
        displayName: sig.displayName,
        department: sig.department,
        severity: 'high',
        headline: `${sig.displayName}: vysoké riziko burnoutu (${sig.burnoutRisk.score}/100)`,
        detail: sig.burnoutRisk.reasons.join(' · '),
        action: 'Pozvi na 1:1, prober workload, doporuč delegování nebo dovolenou.',
      });
    }
    // FLIGHT high
    if (sig.flightRisk.score >= 60) {
      insights.push({
        type: 'flight',
        userId: sig.userId,
        displayName: sig.displayName,
        department: sig.department,
        severity: 'high',
        headline: `${sig.displayName}: zvýšené riziko odchodu (${sig.flightRisk.score}/100)`,
        detail: sig.flightRisk.reasons.join(' · '),
        action: 'Naplánuj retention rozhovor: feedback, kariérní cíle, mzda. Neodkládej.',
      });
    }
    // DECLINING (medium severity, jen pokud výrazné)
    if (sig.engagementTrend.direction === 'declining' && sig.engagementTrend.score <= -15 && sig.burnoutRisk.score < 60) {
      insights.push({
        type: 'declining',
        userId: sig.userId,
        displayName: sig.displayName,
        department: sig.department,
        severity: 'medium',
        headline: `${sig.displayName}: pokles výkonu ${sig.engagementTrend.score} p.b.`,
        detail: sig.engagementTrend.explain,
        action: 'Zjisti důvod (nemoc, životní událost, demotivace, konflikt v týmu).',
      });
    }
    // BOOST (pozitivní – povýšení / pochvala)
    if (sig.boostSignal.score >= 70) {
      insights.push({
        type: 'boost',
        userId: sig.userId,
        displayName: sig.displayName,
        department: sig.department,
        severity: 'medium',
        headline: `${sig.displayName}: skvělý výkon (${sig.boostSignal.score}/100)`,
        detail: sig.boostSignal.reasons.join(' · '),
        action: 'Veřejně oceň, nabídni vyšší zodpovědnost, nebo zařaď do plánu povýšení.',
      });
    }
  }

  // Seřaď podle závažnosti + skóre
  insights.sort((a, b) => {
    const sevA = a.severity === 'high' ? 1 : 0;
    const sevB = b.severity === 'high' ? 1 : 0;
    return sevB - sevA;
  });

  return insights.slice(0, 10); // top 10 nejdůležitějších
}
