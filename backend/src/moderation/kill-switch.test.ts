import { describe, it, expect, beforeEach, vi } from "vitest";

vi.hoisted(() => {
  process.env.TOKEN_ENCRYPTION_KEY = "a".repeat(64);
  process.env.DATABASE_URL = "file:./dev.db";
});

const state: {
  replyEnabled: boolean;
  comments: Record<string, unknown>;
  actions: Array<{ actionType: string; success: boolean }>;
} = { replyEnabled: false, comments: {}, actions: [] };

vi.mock("../db", () => ({
  prisma: {
    comment: {
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const c = state.comments[where.id];
        if (!c) throw new Error("not found");
        return c;
      },
      update: async () => ({}),
    },
    action: {
      create: async ({ data }: { data: { actionType: string; success?: boolean } }) => {
        state.actions.push({ actionType: data.actionType, success: data.success ?? true });
        return data;
      },
    },
  },
}));

vi.mock("../services/audit", () => ({ audit: async () => undefined }));

vi.mock("../services/feature-flags", () => ({
  isReplyEnabled: async () => state.replyEnabled,
}));

vi.mock("../crypto", () => ({
  decrypt: (s: string) => s,
}));

const graphCalls: Array<{ fn: string }> = [];
vi.mock("../meta/graph-client", () => ({
  graph: {
    hideComment: async () => {
      graphCalls.push({ fn: "hide" });
      return { success: true };
    },
    deleteComment: async () => {
      graphCalls.push({ fn: "delete" });
      return { success: true };
    },
    replyToComment: async () => {
      graphCalls.push({ fn: "reply" });
      return { id: "new-reply" };
    },
  },
  GraphApiError: class extends Error {},
}));

import { performAction } from "./actions";

beforeEach(() => {
  state.replyEnabled = false;
  state.actions = [];
  graphCalls.length = 0;
  state.comments = {
    c1: {
      id: "c1",
      platformCommentId: "p1",
      post: { account: { accessTokenEncrypted: "tok" } },
    },
  };
});

describe("reply kill switch", () => {
  it("blocks reply when disabled — Graph API is NEVER called", async () => {
    const res = await performAction("c1", "reply", {
      performedBy: "test@example.com",
      replyMessage: "hello",
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain("kill switch");
    expect(graphCalls).toEqual([]);
    expect(state.actions.at(-1)?.success).toBe(false);
  });

  it("allows reply when enabled", async () => {
    state.replyEnabled = true;
    const res = await performAction("c1", "reply", {
      performedBy: "test@example.com",
      replyMessage: "hello",
    });
    expect(res.success).toBe(true);
    expect(graphCalls).toEqual([{ fn: "reply" }]);
  });

  it("does not affect hide", async () => {
    const res = await performAction("c1", "hide", { performedBy: "test@example.com" });
    expect(res.success).toBe(true);
    expect(graphCalls).toEqual([{ fn: "hide" }]);
  });

  it("does not affect delete", async () => {
    const res = await performAction("c1", "delete", { performedBy: "test@example.com" });
    expect(res.success).toBe(true);
    expect(graphCalls).toEqual([{ fn: "delete" }]);
  });
});
