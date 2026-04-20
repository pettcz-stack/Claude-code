import { prisma } from "../db";
import { logger } from "../utils/logger";
import { notify } from "./notify";

// Pricing per 1M tokens in USD (as of 2026-04). Bump when Anthropic changes.
// https://www.anthropic.com/pricing
const PRICING: Record<string, { in: number; out: number; cacheWrite: number; cacheRead: number }> = {
  "claude-haiku-4-5": { in: 0.8, out: 4, cacheWrite: 1, cacheRead: 0.08 },
  "claude-sonnet-4-6": { in: 3, out: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  "claude-opus-4-7": { in: 15, out: 75, cacheWrite: 18.75, cacheRead: 1.5 },
};

function priceFor(model: string): { in: number; out: number; cacheWrite: number; cacheRead: number } {
  if (PRICING[model]) return PRICING[model];
  // Fallback — use haiku pricing if model isn't known. Log loudly.
  logger.warn("unknown model pricing, falling back to haiku", { model });
  return PRICING["claude-haiku-4-5"];
}

export interface UsagePayload {
  feature: "classify" | "classify_smart" | "suggest_reply";
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  commentId?: string;
}

export function estimateCostUsd(u: UsagePayload): number {
  const p = priceFor(u.model);
  const cost =
    (u.inputTokens * p.in) / 1_000_000 +
    (u.outputTokens * p.out) / 1_000_000 +
    ((u.cacheCreationTokens ?? 0) * p.cacheWrite) / 1_000_000 +
    ((u.cacheReadTokens ?? 0) * p.cacheRead) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000; // 6 decimal places, USD
}

export async function recordUsage(u: UsagePayload): Promise<void> {
  const estCostUsd = estimateCostUsd(u);
  try {
    await prisma.apiUsage.create({
      data: {
        feature: u.feature,
        model: u.model,
        inputTokens: u.inputTokens,
        outputTokens: u.outputTokens,
        cacheCreationTokens: u.cacheCreationTokens ?? 0,
        cacheReadTokens: u.cacheReadTokens ?? 0,
        estCostUsd,
        commentId: u.commentId ?? null,
      },
    });
  } catch (err) {
    logger.warn("failed to record api usage", { err: String(err) });
    return;
  }

  await maybeAlertThreshold(estCostUsd);
}

/**
 * If a monthly spend threshold is configured and we just crossed it, fire a
 * one-shot notification (tracked via a Setting flag so we don't spam).
 */
async function maybeAlertThreshold(_lastCostUsd: number): Promise<void> {
  const thresholdRaw = await prisma.setting.findUnique({ where: { key: "usage_alert_usd" } });
  const threshold = Number(thresholdRaw?.value ?? "");
  if (!Number.isFinite(threshold) || threshold <= 0) return;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const agg = await prisma.apiUsage.aggregate({
    _sum: { estCostUsd: true },
    where: { createdAt: { gte: monthStart } },
  });
  const month = agg._sum.estCostUsd ?? 0;

  const alertKey = `usage_alerted_${monthStart.toISOString().slice(0, 7)}`;
  const already = await prisma.setting.findUnique({ where: { key: alertKey } });
  if (already) return;

  if (month >= threshold) {
    await prisma.setting.upsert({
      where: { key: alertKey },
      create: { key: alertKey, value: "1" },
      update: { value: "1" },
    });
    await notify({
      severity: "warn",
      title: `Spotřeba Claude API překročila $${threshold.toFixed(2)}`,
      text: `Za tento měsíc už jsi utratil ~$${month.toFixed(2)}. Threshold byl $${threshold.toFixed(2)}. Můžeš ho zvýšit v Admin → Token spotřeba, nebo omezit poll / hromadnou reklasifikaci.`,
    });
    logger.warn("usage alert fired", { month, threshold });
  }
}

export async function summary(windowDays = 30): Promise<{
  window: { days: number; since: string };
  totalUsd: number;
  todayUsd: number;
  monthUsd: number;
  byFeature: Array<{ feature: string; calls: number; usd: number; inputTokens: number; outputTokens: number }>;
  byModel: Array<{ model: string; calls: number; usd: number }>;
  perDay: Array<{ day: string; usd: number; calls: number }>;
  thresholdUsd: number | null;
}> {
  const since = new Date(Date.now() - windowDays * 24 * 3600 * 1000);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [rows, todayAgg, monthAgg, thresholdRaw] = await Promise.all([
    prisma.apiUsage.findMany({
      where: { createdAt: { gte: since } },
      select: {
        feature: true,
        model: true,
        inputTokens: true,
        outputTokens: true,
        estCostUsd: true,
        createdAt: true,
      },
    }),
    prisma.apiUsage.aggregate({ _sum: { estCostUsd: true }, where: { createdAt: { gte: todayStart } } }),
    prisma.apiUsage.aggregate({ _sum: { estCostUsd: true }, where: { createdAt: { gte: monthStart } } }),
    prisma.setting.findUnique({ where: { key: "usage_alert_usd" } }),
  ]);

  const byFeatureMap = new Map<string, { calls: number; usd: number; inputTokens: number; outputTokens: number }>();
  const byModelMap = new Map<string, { calls: number; usd: number }>();
  const perDayMap = new Map<string, { usd: number; calls: number }>();

  for (const r of rows) {
    const f = byFeatureMap.get(r.feature) ?? { calls: 0, usd: 0, inputTokens: 0, outputTokens: 0 };
    f.calls++;
    f.usd += r.estCostUsd;
    f.inputTokens += r.inputTokens;
    f.outputTokens += r.outputTokens;
    byFeatureMap.set(r.feature, f);

    const m = byModelMap.get(r.model) ?? { calls: 0, usd: 0 };
    m.calls++;
    m.usd += r.estCostUsd;
    byModelMap.set(r.model, m);

    const day = r.createdAt.toISOString().slice(0, 10);
    const d = perDayMap.get(day) ?? { usd: 0, calls: 0 };
    d.usd += r.estCostUsd;
    d.calls++;
    perDayMap.set(day, d);
  }

  const round = (n: number) => Math.round(n * 10_000) / 10_000;

  const thresholdVal = Number(thresholdRaw?.value ?? "");

  return {
    window: { days: windowDays, since: since.toISOString() },
    totalUsd: round(rows.reduce((s, r) => s + r.estCostUsd, 0)),
    todayUsd: round(todayAgg._sum.estCostUsd ?? 0),
    monthUsd: round(monthAgg._sum.estCostUsd ?? 0),
    byFeature: Array.from(byFeatureMap.entries()).map(([feature, v]) => ({
      feature,
      calls: v.calls,
      usd: round(v.usd),
      inputTokens: v.inputTokens,
      outputTokens: v.outputTokens,
    })),
    byModel: Array.from(byModelMap.entries()).map(([model, v]) => ({
      model,
      calls: v.calls,
      usd: round(v.usd),
    })),
    perDay: Array.from(perDayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, v]) => ({ day, usd: round(v.usd), calls: v.calls })),
    thresholdUsd: Number.isFinite(thresholdVal) && thresholdVal > 0 ? thresholdVal : null,
  };
}
