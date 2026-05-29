/* ──────────────────────────────────────────────────────────────────────────
 * NO AI / NO LLM POLICY: Tento soubor – stejně jako celý produkční backend –
 * NEVOLÁ žádné externí AI/LLM API. Všechny "predikce" jsou DETERMINISTICKÁ
 * pravidla nad agregovanými daty (sumy, průměry, percentily, kompozitní váhy).
 *
 * Pravidlo: monitoring/docs/ARCHITECTURE_NO_AI.md
 * CI lint:  tools/check-no-ai.mjs (běží jako "npm run lint:no-ai")
 * ────────────────────────────────────────────────────────────────────────── */
import { prisma } from '../db.js';
import { addDays, floorToDay, localDow } from './tz.js';
import { demoUserWhere } from './demoFilter.js';
import { deptWhere } from './accessControl.js';

/**
 * Risk signals — interpretovaná vrstva NAD raw skóre.
 *
 * Backend vrací STRUKTUROVANÉ KÓDY (ne texty). Frontend překládá přes i18n.
 * Tím funguje multi-language (cs / en / de / sk / pl) bez duplikace logiky.
 *
 * Reason kódy = identifikátor + parametry pro interpolaci. Např.:
 *   { code: 'AFTER_HOURS', params: { pct: 28 } }
 * Frontend si je přeloží do "Aktivita po 20:00 (28 % intervalů)" / EN ekv.
 */

/** Kód důvodu rizika (pro i18n překlad na frontend). */
export type ReasonCode =
  | 'AFTER_HOURS'         // {pct}
  | 'WEEKEND_WORK'        // {days}
  | 'SKIPPED_LUNCHES'     // {days, period}
  | 'OVER_ENGAGEMENT'     // {hoursPerDay}
  | 'DECLINING_TREND'     // {points}
  | 'COLLABORATION_DROP'  // {pct}
  | 'JOB_BROWSING'        // {count}
  | 'IMPROVING_TREND'     // {points}
  | 'CONSISTENT_HIGH'     // {avg}
  | 'NO_BURNOUT_SIGNS'
  | 'NO_FLIGHT_SIGNS'
  | 'STABLE_PERFORMANCE'
  | 'STABLE_VS_BASELINE'  // {avg}
  | 'TREND_VS_BASELINE';  // {delta, baseline}

export type Reason = { code: ReasonCode; params?: Record<string, number> };

export type InsightCode =
  | 'BURNOUT_HIGH'        // {name, score}
  | 'FLIGHT_RISK_HIGH'    // {name, score}
  | 'PERFORMANCE_DECLINING' // {name, points}
  | 'PERFORMANCE_BOOST';    // {name, score}

export type RiskSignals = {
  userId: string;
  displayName: string;
  department: string | null;
  baseline: {
    avgScore30d: number;
    avgWorkMin30d: number;
    sampleDays: number;
  };
  engagementTrend: {
    score: number; // procentní body delta vs baseline
    direction: 'improving' | 'declining' | 'stable';
    daysOfData: number;
    explainCode: Reason; // strukturovaná zpráva pro i18n
  };
  burnoutRisk: {
    score: number; // 0-100
    level: 'low' | 'moderate' | 'high';
    reasons: Reason[];
  };
  flightRisk: {
    score: number; // 0-100
    level: 'low' | 'moderate' | 'high';
    reasons: Reason[];
  };
  boostSignal: {
    score: number; // 0-100
    reasons: Reason[];
  };
};

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
  const baselineFrom = addDays(today, -30);
  const currentFrom = addDays(today, -7);

  const dailyStats = await prisma.dailyStat.findMany({
    where: { userId: { in: userIds }, date: { gte: baselineFrom, lt: today } },
    select: { userId: true, date: true, workMin: true, nonWorkMin: true, idleMin: true, unknownMin: true, suspicious: true },
  });

  const intervals = await prisma.activityInterval.findMany({
    where: { userId: { in: userIds }, intervalStart: { gte: baselineFrom, lt: today } },
    select: { userId: true, intervalStart: true, activeSeconds: true, intervalSeconds: true, foregroundApp: true, windowTitle: true },
  });

  const users = await prisma.monitoredUser.findMany({
    where: { id: { in: userIds } },
    select: { id: true, displayName: true, department: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const byUser = new Map<string, { daily: typeof dailyStats; intervals: typeof intervals }>();
  for (const id of userIds) byUser.set(id, { daily: [], intervals: [] });
  for (const r of dailyStats) byUser.get(r.userId)?.daily.push(r);
  for (const r of intervals) byUser.get(r.userId)?.intervals.push(r);

  const result = new Map<string, RiskSignals>();
  for (const uid of userIds) {
    const data = byUser.get(uid)!;
    const u = userMap.get(uid);
    if (!u) continue;
    result.set(uid, buildSignals(uid, u.displayName ?? 'unknown', u.department, data.daily, data.intervals, currentFrom));
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
): RiskSignals {
  // ── BASELINE (30 dní) ─────────────────────────────────────────────────
  const dailyScores = daily.map((d) => {
    const adjExp = Math.max(EXPECTED_DAY_MIN - d.unknownMin, 1);
    return Math.min(100, (d.workMin / adjExp) * 100);
  });
  const dailyWork = daily.map((d) => d.workMin);
  const avgScore30d = Math.round(avg(dailyScores));
  const avgWorkMin30d = Math.round(avg(dailyWork));

  // ── TREND VÝKONU (7 dní vs 30denní baseline) ─────────────────────────
  const recent = daily.filter((d) => d.date >= currentFrom);
  const recentScores = recent.map((d) => {
    const adjExp = Math.max(EXPECTED_DAY_MIN - d.unknownMin, 1);
    return Math.min(100, (d.workMin / adjExp) * 100);
  });
  const recentAvg = avg(recentScores);
  const trendDelta = Math.round(recentAvg - avgScore30d);
  let trendDirection: 'improving' | 'declining' | 'stable';
  if (trendDelta <= -8) trendDirection = 'declining';
  else if (trendDelta >= 8) trendDirection = 'improving';
  else trendDirection = 'stable';
  const explainCode: Reason = trendDelta === 0
    ? { code: 'STABLE_VS_BASELINE', params: { avg: avgScore30d } }
    : { code: 'TREND_VS_BASELINE', params: { delta: trendDelta, baseline: avgScore30d } };

  // ── RIZIKO VYHOŘENÍ ──────────────────────────────────────────────────
  const afterHoursCount = intervals.filter((it) => {
    const localHour = (it.intervalStart.getUTCHours() + 2) % 24;
    return (localHour >= 20 || localHour < 5) && it.activeSeconds * 2 >= it.intervalSeconds;
  }).length;
  const totalActiveIntervals = intervals.filter((it) => it.activeSeconds * 2 >= it.intervalSeconds).length;
  const afterHoursPct = totalActiveIntervals > 0 ? (afterHoursCount / totalActiveIntervals) * 100 : 0;
  const afterHoursScore = Math.min(100, afterHoursPct * 5);

  const weekendDays = new Set<string>();
  for (const it of intervals) {
    const dow = localDow(it.intervalStart);
    if ((dow === 0 || dow === 6) && it.activeSeconds * 2 >= it.intervalSeconds) {
      weekendDays.add(it.intervalStart.toISOString().slice(0, 10));
    }
  }
  const weekendScore = Math.min(100, weekendDays.size * 25);

  const last14Days = daily.filter((d) => d.date >= addDays(new Date(), -14));
  const skipLunchDays = last14Days.filter((d) => {
    const lunchIntervals = intervals.filter((it) => {
      const sameDay = it.intervalStart.toISOString().slice(0, 10) === d.date.toISOString().slice(0, 10);
      const localHour = (it.intervalStart.getUTCHours() + 2) % 24;
      return sameDay && localHour === 12 && it.activeSeconds * 2 >= it.intervalSeconds;
    });
    return d.workMin > 60 && lunchIntervals.length > 0;
  }).length;
  const lunchScore = Math.min(100, skipLunchDays * 12);

  const overEngagementScore = avgWorkMin30d > 420 ? Math.min(100, (avgWorkMin30d - 420) * 1.5) : 0;

  const burnoutScore = Math.round(
    afterHoursScore * 0.35 +
    weekendScore * 0.25 +
    lunchScore * 0.20 +
    overEngagementScore * 0.20,
  );
  const burnoutLevel: 'low' | 'moderate' | 'high' = burnoutScore >= 60 ? 'high' : burnoutScore >= 30 ? 'moderate' : 'low';
  const burnoutReasons: Reason[] = [];
  if (afterHoursScore >= 30) burnoutReasons.push({ code: 'AFTER_HOURS', params: { pct: Math.round(afterHoursPct) } });
  if (weekendDays.size >= 2) burnoutReasons.push({ code: 'WEEKEND_WORK', params: { days: weekendDays.size } });
  if (skipLunchDays >= 4) burnoutReasons.push({ code: 'SKIPPED_LUNCHES', params: { days: skipLunchDays, period: 14 } });
  if (overEngagementScore >= 30) burnoutReasons.push({ code: 'OVER_ENGAGEMENT', params: { hoursPerDay: Math.round(avgWorkMin30d / 60) } });
  if (burnoutReasons.length === 0) burnoutReasons.push({ code: 'NO_BURNOUT_SIGNS' });

  // ── RIZIKO ODCHODU ───────────────────────────────────────────────────
  const teamsKeywords = ['teams.exe', 'slack.exe'];
  const teamsIntervalsRecent = intervals.filter((it) => it.intervalStart >= currentFrom && it.foregroundApp && teamsKeywords.includes(it.foregroundApp)).length;
  const teamsIntervalsBaseline = intervals.filter((it) => it.intervalStart < currentFrom && it.foregroundApp && teamsKeywords.includes(it.foregroundApp)).length;
  const recentDays = Math.max(1, recent.length);
  const baselineDays = Math.max(1, daily.length - recent.length);
  const teamsRateRecent = teamsIntervalsRecent / recentDays;
  const teamsRateBaseline = teamsIntervalsBaseline / baselineDays;
  const collaborationDrop = teamsRateBaseline > 0 ? Math.max(0, (teamsRateBaseline - teamsRateRecent) / teamsRateBaseline) * 100 : 0;
  const collaborationScore = Math.min(100, collaborationDrop);

  const jobKeywords = ['linkedin', 'jobs.cz', 'prace.cz', 'profesia', 'startupjobs'];
  const jobSiteIntervals = intervals.filter((it) => {
    if (!it.windowTitle) return false;
    const t = it.windowTitle.toLowerCase();
    return jobKeywords.some((k) => t.includes(k));
  }).length;
  const jobBrowseScore = Math.min(100, jobSiteIntervals * 20);

  const engagementDeclineScore = trendDelta < 0 ? Math.min(100, -trendDelta * 4) : 0;

  const flightScore = Math.round(
    engagementDeclineScore * 0.45 +
    collaborationScore * 0.25 +
    jobBrowseScore * 0.30,
  );
  const flightLevel: 'low' | 'moderate' | 'high' = flightScore >= 60 ? 'high' : flightScore >= 30 ? 'moderate' : 'low';
  const flightReasons: Reason[] = [];
  if (engagementDeclineScore >= 30) flightReasons.push({ code: 'DECLINING_TREND', params: { points: trendDelta } });
  if (collaborationScore >= 30) flightReasons.push({ code: 'COLLABORATION_DROP', params: { pct: Math.round(collaborationDrop) } });
  if (jobBrowseScore >= 30) flightReasons.push({ code: 'JOB_BROWSING', params: { count: jobSiteIntervals } });
  if (flightReasons.length === 0) flightReasons.push({ code: 'NO_FLIGHT_SIGNS' });

  // ── POZITIVNÍ SIGNÁL ─────────────────────────────────────────────────
  const boostFromTrend = trendDelta > 0 ? Math.min(100, trendDelta * 5) : 0;
  const boostFromConsistency = avgScore30d >= 70 ? Math.min(100, (avgScore30d - 70) * 3) : 0;
  const boostScore = Math.round(boostFromTrend * 0.5 + boostFromConsistency * 0.5);
  const boostReasons: Reason[] = [];
  if (boostFromTrend >= 20) boostReasons.push({ code: 'IMPROVING_TREND', params: { points: trendDelta } });
  if (boostFromConsistency >= 20) boostReasons.push({ code: 'CONSISTENT_HIGH', params: { avg: avgScore30d } });
  if (boostReasons.length === 0) boostReasons.push({ code: 'STABLE_PERFORMANCE' });

  return {
    userId,
    displayName,
    department,
    baseline: { avgScore30d, avgWorkMin30d, sampleDays: daily.length },
    engagementTrend: {
      score: trendDelta,
      direction: trendDirection,
      daysOfData: recent.length,
      explainCode,
    },
    burnoutRisk: { score: burnoutScore, level: burnoutLevel, reasons: burnoutReasons.slice(0, 3) },
    flightRisk: { score: flightScore, level: flightLevel, reasons: flightReasons.slice(0, 3) },
    boostSignal: { score: boostScore, reasons: boostReasons.slice(0, 3) },
  };
}

/** Akční doporučení pro manažera. Pouze KÓDY + parametry – frontend překládá. */
export type Insight = {
  type: 'burnout' | 'flight' | 'declining' | 'boost';
  code: InsightCode;
  params: Record<string, number | string>;
  userId: string;
  displayName: string;
  department: string | null;
  severity: 'high' | 'medium';
  reasons: Reason[];
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
    if (sig.baseline.sampleDays < 7) continue;

    if (sig.burnoutRisk.score >= 60) {
      insights.push({
        type: 'burnout',
        code: 'BURNOUT_HIGH',
        params: { name: sig.displayName, score: sig.burnoutRisk.score },
        userId: sig.userId,
        displayName: sig.displayName,
        department: sig.department,
        severity: 'high',
        reasons: sig.burnoutRisk.reasons,
      });
    }
    if (sig.flightRisk.score >= 60) {
      insights.push({
        type: 'flight',
        code: 'FLIGHT_RISK_HIGH',
        params: { name: sig.displayName, score: sig.flightRisk.score },
        userId: sig.userId,
        displayName: sig.displayName,
        department: sig.department,
        severity: 'high',
        reasons: sig.flightRisk.reasons,
      });
    }
    if (sig.engagementTrend.direction === 'declining' && sig.engagementTrend.score <= -15 && sig.burnoutRisk.score < 60) {
      insights.push({
        type: 'declining',
        code: 'PERFORMANCE_DECLINING',
        params: { name: sig.displayName, points: sig.engagementTrend.score },
        userId: sig.userId,
        displayName: sig.displayName,
        department: sig.department,
        severity: 'medium',
        reasons: [sig.engagementTrend.explainCode],
      });
    }
    if (sig.boostSignal.score >= 70) {
      insights.push({
        type: 'boost',
        code: 'PERFORMANCE_BOOST',
        params: { name: sig.displayName, score: sig.boostSignal.score },
        userId: sig.userId,
        displayName: sig.displayName,
        department: sig.department,
        severity: 'medium',
        reasons: sig.boostSignal.reasons,
      });
    }
  }

  insights.sort((a, b) => (a.severity === 'high' ? 0 : 1) - (b.severity === 'high' ? 0 : 1));
  return insights.slice(0, 10);
}
