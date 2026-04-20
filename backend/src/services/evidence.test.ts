import { describe, it, expect, vi, beforeEach } from "vitest";

interface MockEvidence {
  id: string;
  commentId: string;
  category: string;
  contentHash: string;
  snapshotJson: string;
  permalinkAtCapture: string | null;
}

vi.mock("../db", () => {
  const store: { evidence: MockEvidence[]; comment: unknown } = { evidence: [], comment: null };
  return {
    prisma: {
      comment: {
        findUnique: async () => store.comment,
      },
      evidence: {
        create: async ({ data }: { data: Omit<MockEvidence, "id"> }) => {
          const ev = { id: `ev-${store.evidence.length + 1}`, ...data };
          store.evidence.push(ev);
          return ev;
        },
      },
      __store: store,
    },
  };
});

import { captureEvidence } from "./evidence";
import * as db from "../db";

beforeEach(() => {
  // @ts-expect-error test-only
  db.prisma.__store.evidence.length = 0;
  // @ts-expect-error test-only
  db.prisma.__store.comment = null;
});

function setComment(c: Record<string, unknown>) {
  // @ts-expect-error test-only
  db.prisma.__store.comment = c;
}

describe("captureEvidence", () => {
  it("creates snapshot for brand_attack with deterministic hash", async () => {
    setComment({
      id: "c1",
      text: "ALBIXON je podvod a krade peníze!",
      authorName: "A",
      authorId: "1",
      createdAtPlatform: new Date("2026-01-01T00:00:00Z"),
      platformCommentId: "plat-1",
      post: {
        platformPostId: "p1",
        permalink: "https://fb.com/x",
        contentPreview: "Bazén novinky",
        account: { platform: "FB", pageName: "ALBIXON", pageId: "page-1" },
      },
      classifications: [
        {
          category: "brand_attack",
          confidence: 0.9,
          reasoning: "Obvinění bez důkazu.",
          recommendedAction: "review",
          modelUsed: "claude-sonnet-4-6",
          classifiedAt: new Date("2026-01-01T00:05:00Z"),
        },
      ],
    });
    const id = await captureEvidence("c1", "brand_attack");
    expect(id).toBeTruthy();

    // @ts-expect-error test-only
    const store = db.prisma.__store.evidence as MockEvidence[];
    expect(store).toHaveLength(1);
    expect(store[0].contentHash).toMatch(/^[a-f0-9]{64}$/);
    const snap = JSON.parse(store[0].snapshotJson);
    expect(snap.text).toBe("ALBIXON je podvod a krade peníze!");
    expect(snap.classification.category).toBe("brand_attack");
    expect(store[0].permalinkAtCapture).toBe("https://fb.com/x");
  });

  it("skips capture for non-sensitive categories", async () => {
    setComment({
      id: "c2",
      text: "Super bazén!",
      authorName: "B",
      post: { account: { platform: "FB", pageName: "X", pageId: "p" } },
      classifications: [],
    });
    const id = await captureEvidence("c2", "positive");
    expect(id).toBeNull();

    // @ts-expect-error test-only
    expect(db.prisma.__store.evidence).toHaveLength(0);
  });

  it("captures vulgarity too", async () => {
    setComment({
      id: "c3",
      text: "xxx",
      authorName: "C",
      post: { account: { platform: "IG", pageName: "Y", pageId: "p" } },
      classifications: [
        {
          category: "vulgarity",
          confidence: 0.95,
          reasoning: "Vulgarismus.",
          recommendedAction: "hide",
          modelUsed: "claude-haiku-4-5",
          classifiedAt: new Date(),
        },
      ],
    });
    const id = await captureEvidence("c3", "vulgarity");
    expect(id).toBeTruthy();
  });
});
