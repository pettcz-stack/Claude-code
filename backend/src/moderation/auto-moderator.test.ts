import { describe, it, expect, vi, beforeEach } from "vitest";

const actionCalls: Array<{ id: string; action: string; by: string }> = [];

vi.mock("../db", () => {
  const rules: Array<{ id: string; category: string; minConfidence: number; action: string; enabled: boolean; name: string }> = [];
  const settings = new Map<string, string>();
  const comments: Record<string, { id: string; authorId: string | null; authorName: string | null; classifications: Array<{ category: string; confidence: number }> }> = {};
  const listEntries: Array<{ kind: string; value: string }> = [];

  return {
    prisma: {
      setting: {
        findUnique: async ({ where }: { where: { key: string } }) => {
          const v = settings.get(where.key);
          return v === undefined ? null : { key: where.key, value: v };
        },
      },
      rule: {
        findMany: async ({ where }: { where: { enabled: boolean; category: string } }) =>
          rules.filter((r) => r.enabled === where.enabled && r.category === where.category),
      },
      comment: {
        findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
          const c = comments[where.id];
          if (!c) throw new Error("not found");
          return c;
        },
      },
      listEntry: {
        findMany: async ({ where }: { where: { kind: string } }) =>
          listEntries.filter((e) => e.kind === where.kind),
      },
      __rules: rules,
      __settings: settings,
      __comments: comments,
      __listEntries: listEntries,
    },
  };
});

vi.mock("./actions", () => ({
  performAction: async (id: string, action: string, opts: { performedBy: string }) => {
    actionCalls.push({ id, action, by: opts.performedBy });
    return { success: true };
  },
}));

import { runAutoModeration } from "./auto-moderator";
import * as db from "../db";

beforeEach(() => {
  actionCalls.length = 0;
  // @ts-expect-error test-only fields
  db.prisma.__rules.length = 0;
  // @ts-expect-error test-only fields
  db.prisma.__settings.clear();
  // @ts-expect-error test-only fields
  Object.keys(db.prisma.__comments).forEach((k) => delete db.prisma.__comments[k]);
  // @ts-expect-error test-only fields
  db.prisma.__listEntries.length = 0;
  process.env.AUTO_MODERATE_ENABLED = "true";
  process.env.AUTO_DELETE_SPAM_THRESHOLD = "0.9";
  process.env.AUTO_HIDE_VULGARITY_THRESHOLD = "0.85";
});

function seedComment(id: string, category: string, confidence: number, author: { name?: string; id?: string } = {}) {
  // @ts-expect-error test-only
  db.prisma.__comments[id] = {
    id,
    authorName: author.name ?? null,
    authorId: author.id ?? null,
    classifications: [{ category, confidence }],
  };
}

describe("auto-moderator", () => {
  it("auto-deletes high-confidence spam via default rule", async () => {
    seedComment("c1", "spam", 0.95);
    await runAutoModeration("c1");
    expect(actionCalls).toEqual([{ id: "c1", action: "delete", by: "auto:default-spam" }]);
  });

  it("auto-hides high-confidence vulgarity", async () => {
    seedComment("c2", "vulgarity", 0.9);
    await runAutoModeration("c2");
    expect(actionCalls).toEqual([{ id: "c2", action: "hide", by: "auto:default-vulgarity" }]);
  });

  it("refuses to auto-moderate brand_attack even at confidence 1.0", async () => {
    seedComment("c3", "brand_attack", 1.0);
    await runAutoModeration("c3");
    expect(actionCalls).toEqual([]);
  });

  it("refuses to auto-moderate legitimate_criticism", async () => {
    seedComment("c4", "legitimate_criticism", 1.0);
    await runAutoModeration("c4");
    expect(actionCalls).toEqual([]);
  });

  it("respects the pause flag", async () => {
    // @ts-expect-error test-only
    db.prisma.__settings.set("auto_moderation_paused", "true");
    seedComment("c5", "spam", 0.99);
    await runAutoModeration("c5");
    expect(actionCalls).toEqual([]);
  });

  it("skips whitelisted authors", async () => {
    // @ts-expect-error test-only
    db.prisma.__listEntries.push({ kind: "whitelist_author", value: "VIP User" });
    seedComment("c6", "spam", 0.99, { name: "VIP User" });
    await runAutoModeration("c6");
    expect(actionCalls).toEqual([]);
  });

  it("does nothing for confidence below threshold", async () => {
    seedComment("c7", "spam", 0.5);
    await runAutoModeration("c7");
    expect(actionCalls).toEqual([]);
  });

  it("auto-hides comments from blacklisted authors regardless of category", async () => {
    // @ts-expect-error test-only
    db.prisma.__listEntries.push({ kind: "blacklist_author", value: "Known Troll" });
    seedComment("cbl", "neutral", 0.9, { name: "Known Troll" });
    await runAutoModeration("cbl");
    expect(actionCalls).toEqual([{ id: "cbl", action: "hide", by: "auto:blacklist" }]);
  });

  it("does NOT auto-hide blacklisted author's legitimate_criticism", async () => {
    // @ts-expect-error test-only
    db.prisma.__listEntries.push({ kind: "blacklist_author", value: "Vocal Customer" });
    seedComment("cbl2", "legitimate_criticism", 0.95, { name: "Vocal Customer" });
    await runAutoModeration("cbl2");
    expect(actionCalls).toEqual([]);
  });

  it("uses custom rules in addition to defaults", async () => {
    // @ts-expect-error test-only
    db.prisma.__rules.push({
      id: "r1",
      name: "strict-spam",
      category: "spam",
      minConfidence: 0.7,
      action: "delete",
      enabled: true,
    });
    seedComment("c8", "spam", 0.75);
    await runAutoModeration("c8");
    expect(actionCalls).toEqual([{ id: "c8", action: "delete", by: "auto:strict-spam" }]);
  });
});
