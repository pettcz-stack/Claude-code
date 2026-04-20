import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

vi.hoisted(() => {
  process.env.TOKEN_ENCRYPTION_KEY = "a".repeat(64);
  process.env.DATABASE_URL = "file:./dev.db";
});

const state: {
  comments: Array<{ fetchedAt: Date; authorName: string | null; categories: string[] }>;
  actions: Array<{ performedAt: Date; actionType: string; fetchedAt: Date }>;
} = { comments: [], actions: [] };

vi.mock("../db", () => ({
  prisma: {
    comment: {
      count: async ({ where }: { where: { fetchedAt: { gte: Date } } }) =>
        state.comments.filter((c) => c.fetchedAt >= where.fetchedAt.gte).length,
      findMany: async ({ where, select: _ }: { where: Record<string, unknown>; select: unknown }) => {
        const since = (where.fetchedAt as { gte: Date }).gte;
        let items = state.comments.filter((c) => c.fetchedAt >= since);
        if ((where as { authorName?: { not: null } }).authorName) items = items.filter((c) => c.authorName !== null);
        if ((where as { classifications?: unknown }).classifications) {
          const classif = where.classifications as { some: { category: { in: string[] } } };
          const cats = classif.some.category.in;
          items = items.filter((c) => c.categories.some((x) => cats.includes(x)));
        }
        return items.map((c) => ({ authorName: c.authorName, fetchedAt: c.fetchedAt }));
      },
    },
    classification: {
      groupBy: async ({ where }: { where: { classifiedAt: { gte: Date } } }) => {
        const since = where.classifiedAt.gte;
        const cats = new Map<string, number>();
        for (const c of state.comments) {
          if (c.fetchedAt < since) continue;
          for (const cat of c.categories) cats.set(cat, (cats.get(cat) ?? 0) + 1);
        }
        return Array.from(cats.entries()).map(([category, count]) => ({ category, _count: count }));
      },
    },
    action: {
      count: async ({ where }: { where: { performedAt: { gte: Date } } }) =>
        state.actions.filter((a) => a.performedAt >= where.performedAt.gte).length,
      groupBy: async ({ where }: { where: { performedAt: { gte: Date } } }) => {
        const since = where.performedAt.gte;
        const cats = new Map<string, number>();
        for (const a of state.actions) {
          if (a.performedAt < since) continue;
          cats.set(a.actionType, (cats.get(a.actionType) ?? 0) + 1);
        }
        return Array.from(cats.entries()).map(([actionType, count]) => ({ actionType, _count: count }));
      },
      findMany: async ({ where }: { where: { performedAt: { gte: Date } } }) => {
        const since = where.performedAt.gte;
        return state.actions
          .filter((a) => a.performedAt >= since)
          .map((a) => ({ performedAt: a.performedAt, comment: { fetchedAt: a.fetchedAt } }));
      },
    },
  },
}));

import { statsRouter } from "./stats";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/stats", statsRouter);
  return app;
}

beforeEach(() => {
  state.comments = [];
  state.actions = [];
});

describe("stats route", () => {
  it("returns empty-but-valid overview when there is no data", async () => {
    const res = await request(buildApp()).get("/api/stats/overview?days=7");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      windowDays: 7,
      totalComments: 0,
      totalActions: 0,
      byCategory: [],
      byAction: [],
      topNegativeAuthors: [],
      perDay: [],
      avgResponseSeconds: 0,
    });
  });

  it("aggregates categories, daily buckets, top authors, avg response", async () => {
    const now = Date.now();
    const day1 = new Date(now - 4 * 24 * 3600 * 1000);
    const day2 = new Date(now - 1 * 24 * 3600 * 1000);

    state.comments = [
      { fetchedAt: day1, authorName: "Spammer", categories: ["spam"] },
      { fetchedAt: day1, authorName: "Troll", categories: ["vulgarity"] },
      { fetchedAt: day2, authorName: "Spammer", categories: ["spam"] },
      { fetchedAt: day2, authorName: "Happy", categories: ["positive"] },
    ];
    state.actions = [
      { performedAt: new Date(day1.getTime() + 60_000), actionType: "delete", fetchedAt: day1 },
      { performedAt: new Date(day2.getTime() + 120_000), actionType: "hide", fetchedAt: day2 },
    ];

    const res = await request(buildApp()).get("/api/stats/overview?days=7");
    expect(res.status).toBe(200);
    expect(res.body.totalComments).toBe(4);
    expect(res.body.totalActions).toBe(2);

    const catMap = Object.fromEntries(
      res.body.byCategory.map((b: { category: string; count: number }) => [b.category, b.count])
    );
    expect(catMap.spam).toBe(2);
    expect(catMap.vulgarity).toBe(1);
    expect(catMap.positive).toBe(1);

    const actionMap = Object.fromEntries(
      res.body.byAction.map((b: { actionType: string; count: number }) => [b.actionType, b.count])
    );
    expect(actionMap.delete).toBe(1);
    expect(actionMap.hide).toBe(1);

    expect(res.body.topNegativeAuthors[0].authorName).toBe("Spammer");
    expect(res.body.topNegativeAuthors[0].count).toBe(2);

    expect(res.body.perDay.length).toBe(2);
    expect(res.body.perDay.every((p: { day: string; count: number }) => /^\d{4}-\d{2}-\d{2}$/.test(p.day))).toBe(true);

    // 60s and 120s → avg ~90s
    expect(res.body.avgResponseSeconds).toBeGreaterThan(60);
    expect(res.body.avgResponseSeconds).toBeLessThan(150);
  });

  it("clamps days parameter to 90", async () => {
    const res = await request(buildApp()).get("/api/stats/overview?days=9999");
    expect(res.body.windowDays).toBe(90);
  });

  it("defaults to 7 days when days is missing or invalid", async () => {
    const res1 = await request(buildApp()).get("/api/stats/overview");
    expect(res1.body.windowDays).toBe(7);
    const res2 = await request(buildApp()).get("/api/stats/overview?days=abc");
    expect(res2.body.windowDays).toBe(7);
  });
});
