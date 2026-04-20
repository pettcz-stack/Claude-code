import { describe, it, expect, vi, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.TOKEN_ENCRYPTION_KEY = "a".repeat(64);
  process.env.DATABASE_URL = "file:./dev.db";
});

const state: {
  rows: Array<{
    feature: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    estCostUsd: number;
    createdAt: Date;
  }>;
  settings: Map<string, string>;
  notifyCalls: Array<{ title: string; severity: string }>;
} = { rows: [], settings: new Map(), notifyCalls: [] };

vi.mock("../db", () => ({
  prisma: {
    apiUsage: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { ...data, createdAt: new Date() } as typeof state.rows[number];
        state.rows.push(row);
        return row;
      },
      findMany: async ({ where }: { where: { createdAt: { gte: Date } } }) => {
        return state.rows.filter((r) => r.createdAt >= where.createdAt.gte);
      },
      aggregate: async ({ where }: { where: { createdAt: { gte: Date } } }) => {
        const rows = state.rows.filter((r) => r.createdAt >= where.createdAt.gte);
        return { _sum: { estCostUsd: rows.reduce((s, r) => s + r.estCostUsd, 0) } };
      },
    },
    setting: {
      findUnique: async ({ where }: { where: { key: string } }) => {
        const v = state.settings.get(where.key);
        return v === undefined ? null : { key: where.key, value: v };
      },
      upsert: async ({ where, create, update }: { where: { key: string }; create: { key: string; value: string }; update: { value: string } }) => {
        const existing = state.settings.get(where.key);
        if (existing === undefined) state.settings.set(where.key, create.value);
        else state.settings.set(where.key, update.value);
        return { key: where.key, value: state.settings.get(where.key) ?? "" };
      },
    },
  },
}));

vi.mock("./notify", () => ({
  notify: async (p: { title: string; severity: string }) => {
    state.notifyCalls.push({ title: p.title, severity: p.severity });
  },
}));

import { estimateCostUsd, recordUsage, summary } from "./usage";

beforeEach(() => {
  state.rows = [];
  state.settings.clear();
  state.notifyCalls = [];
});

describe("estimateCostUsd", () => {
  it("calculates haiku cost correctly", () => {
    // 1000 input + 500 output at haiku pricing: 1000 * 0.8e-6 + 500 * 4e-6
    const cost = estimateCostUsd({
      feature: "classify",
      model: "claude-haiku-4-5",
      inputTokens: 1000,
      outputTokens: 500,
    });
    expect(cost).toBeCloseTo(0.0008 + 0.002, 6);
  });

  it("applies cache pricing for cached input", () => {
    const cost = estimateCostUsd({
      feature: "classify",
      model: "claude-haiku-4-5",
      inputTokens: 200,
      outputTokens: 100,
      cacheReadTokens: 1000,
      cacheCreationTokens: 0,
    });
    // 200 * 0.8e-6 + 100 * 4e-6 + 1000 * 0.08e-6
    expect(cost).toBeCloseTo(0.00016 + 0.0004 + 0.00008, 6);
  });

  it("falls back on unknown model", () => {
    const cost = estimateCostUsd({
      feature: "classify",
      model: "claude-imaginary-99",
      inputTokens: 1000,
      outputTokens: 100,
    });
    expect(cost).toBeGreaterThan(0);
  });
});

describe("recordUsage + summary", () => {
  it("records and aggregates by feature, model, day", async () => {
    await recordUsage({
      feature: "classify",
      model: "claude-haiku-4-5",
      inputTokens: 1000,
      outputTokens: 100,
    });
    await recordUsage({
      feature: "suggest_reply",
      model: "claude-sonnet-4-6",
      inputTokens: 800,
      outputTokens: 200,
    });

    const s = await summary(30);
    expect(s.byFeature).toHaveLength(2);
    expect(s.byModel).toHaveLength(2);
    expect(s.totalUsd).toBeGreaterThan(0);
    expect(s.todayUsd).toBeGreaterThan(0);
    expect(s.perDay).toHaveLength(1);
  });

  it("fires alert once when threshold crossed within the month", async () => {
    state.settings.set("usage_alert_usd", "0.001");
    await recordUsage({
      feature: "classify",
      model: "claude-haiku-4-5",
      inputTokens: 10000,
      outputTokens: 2000, // cost well above $0.001
    });
    expect(state.notifyCalls).toHaveLength(1);
    expect(state.notifyCalls[0].severity).toBe("warn");
    expect(state.notifyCalls[0].title).toContain("$0.00");
  });

  it("does not fire the alert twice in the same month", async () => {
    state.settings.set("usage_alert_usd", "0.001");
    await recordUsage({
      feature: "classify",
      model: "claude-haiku-4-5",
      inputTokens: 10000,
      outputTokens: 2000,
    });
    await recordUsage({
      feature: "classify",
      model: "claude-haiku-4-5",
      inputTokens: 10000,
      outputTokens: 2000,
    });
    expect(state.notifyCalls).toHaveLength(1);
  });

  it("does not fire alert when no threshold is set", async () => {
    await recordUsage({
      feature: "classify",
      model: "claude-haiku-4-5",
      inputTokens: 100_000,
      outputTokens: 50_000,
    });
    expect(state.notifyCalls).toHaveLength(0);
  });
});
