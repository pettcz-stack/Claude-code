import { describe, it, expect, beforeEach, vi } from "vitest";

vi.hoisted(() => {
  process.env.TOKEN_ENCRYPTION_KEY = "a".repeat(64);
  process.env.DATABASE_URL = "file:./dev.db";
});

const state: {
  replyEnabled: boolean;
  comments: Record<string, unknown>;
  actions: Array<{ actionType: string; success: boolean; performedBy: string }>;
} = { replyEnabled: true, comments: {}, actions: [] };

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
      create: async ({ data }: { data: { actionType: string; success?: boolean; performedBy: string } }) => {
        state.actions.push({
          actionType: data.actionType,
          success: data.success ?? true,
          performedBy: data.performedBy,
        });
        return data;
      },
    },
  },
}));

vi.mock("../services/audit", () => ({ audit: async () => undefined }));
vi.mock("../services/feature-flags", () => ({ isReplyEnabled: async () => state.replyEnabled }));
vi.mock("../crypto", () => ({ decrypt: (s: string) => s }));

const graphCalls: string[] = [];
const googleCalls: string[] = [];

vi.mock("../meta/graph-client", () => ({
  graph: {
    hideComment: async () => {
      graphCalls.push("hide");
      return { success: true };
    },
    deleteComment: async () => {
      graphCalls.push("delete");
      return { success: true };
    },
    replyToComment: async () => {
      graphCalls.push("reply");
      return { id: "new-reply" };
    },
  },
  GraphApiError: class extends Error {},
}));

vi.mock("../google/api-client", () => ({
  google: {
    replyToReview: async () => {
      googleCalls.push("reply");
      return { ok: true };
    },
  },
}));

import { performAction } from "./actions";

function seedComment(id: string, source: "META" | "GOOGLE") {
  state.comments[id] = {
    id,
    platformCommentId: `pc-${id}`,
    sourceUrl: source === "GOOGLE" ? "https://maps.google.com/?cid=xxx" : null,
    post: {
      account: {
        source,
        platform: source === "GOOGLE" ? "GOOGLE" : "FB",
        accessTokenEncrypted: "tok",
      },
    },
  };
}

beforeEach(() => {
  state.replyEnabled = true;
  state.actions = [];
  state.comments = {};
  graphCalls.length = 0;
  googleCalls.length = 0;
});

describe("action routing per source", () => {
  it("Meta: hide/delete work", async () => {
    seedComment("m1", "META");
    expect((await performAction("m1", "hide", { performedBy: "op" })).success).toBe(true);
    expect((await performAction("m1", "delete", { performedBy: "op" })).success).toBe(true);
    expect(graphCalls).toEqual(["hide", "delete"]);
  });

  it("Google: hide is rejected as unsupported", async () => {
    seedComment("g1", "GOOGLE");
    const res = await performAction("g1", "hide", { performedBy: "op" });
    expect(res.success).toBe(false);
    expect(res.error).toContain("'hide' není pro zdroj GOOGLE");
    expect(graphCalls).toEqual([]);
    expect(googleCalls).toEqual([]);
  });

  it("Google: delete is rejected as unsupported", async () => {
    seedComment("g2", "GOOGLE");
    const res = await performAction("g2", "delete", { performedBy: "op" });
    expect(res.success).toBe(false);
    expect(res.error).toContain("'delete' není pro zdroj GOOGLE");
  });

  it("Google: reply goes to google.replyToReview (not graph)", async () => {
    seedComment("g3", "GOOGLE");
    const res = await performAction("g3", "reply", { performedBy: "op", replyMessage: "díky" });
    expect(res.success).toBe(true);
    expect(googleCalls).toEqual(["reply"]);
    expect(graphCalls).toEqual([]);
  });

  it("Google: flag_for_report succeeds without any external API call (operator does it manually)", async () => {
    seedComment("g4", "GOOGLE");
    const res = await performAction("g4", "flag_for_report", { performedBy: "op" });
    expect(res.success).toBe(true);
    expect(googleCalls).toEqual([]);
    expect(graphCalls).toEqual([]);
    const last = state.actions.at(-1);
    expect(last?.actionType).toBe("flag_for_report");
    expect(last?.success).toBe(true);
  });

  it("Meta: flag_for_report is rejected — Meta has native hide/delete", async () => {
    seedComment("m2", "META");
    const res = await performAction("m2", "flag_for_report", { performedBy: "op" });
    expect(res.success).toBe(false);
  });

  it("keep works on both sources (no API call)", async () => {
    seedComment("g5", "GOOGLE");
    seedComment("m3", "META");
    expect((await performAction("g5", "keep", { performedBy: "op" })).success).toBe(true);
    expect((await performAction("m3", "keep", { performedBy: "op" })).success).toBe(true);
    expect(graphCalls).toEqual([]);
    expect(googleCalls).toEqual([]);
  });
});
