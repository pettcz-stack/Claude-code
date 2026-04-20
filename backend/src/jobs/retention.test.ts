import { describe, it, expect, vi, beforeEach } from "vitest";

interface MockComment {
  id: string;
  fetchedAt: Date;
  authorName: string | null;
  authorId: string | null;
  text: string;
}

vi.mock("../db", () => {
  const store: { comments: MockComment[] } = { comments: [] };
  return {
    prisma: {
      comment: {
        findMany: async ({
          where,
          take,
        }: {
          where: { fetchedAt: { lt: Date }; authorName: { not: null } };
          take: number;
        }) => {
          const cutoff = where.fetchedAt.lt.getTime();
          return store.comments
            .filter((c) => c.fetchedAt.getTime() < cutoff && c.authorName !== null)
            .slice(0, take)
            .map((c) => ({ id: c.id }));
        },
        updateMany: async ({ where, data }: { where: { id: { in: string[] } }; data: Partial<MockComment> }) => {
          let count = 0;
          for (const c of store.comments) {
            if (where.id.in.includes(c.id)) {
              Object.assign(c, data);
              count++;
            }
          }
          return { count };
        },
      },
      auditLog: { create: async () => ({}) },
      __store: store,
    },
  };
});

vi.mock("../services/audit", () => ({ audit: async () => undefined }));

import { runRetention } from "./retention";
import * as db from "../db";

beforeEach(() => {
  // @ts-expect-error test-only
  db.prisma.__store.comments.length = 0;
});

describe("runRetention", () => {
  it("anonymizes comments older than the cutoff", async () => {
    const old = new Date(Date.now() - 800 * 24 * 3600 * 1000);
    const recent = new Date(Date.now() - 10 * 24 * 3600 * 1000);
    // @ts-expect-error test-only
    db.prisma.__store.comments.push(
      { id: "old1", fetchedAt: old, authorName: "A", authorId: "1", text: "foo" },
      { id: "old2", fetchedAt: old, authorName: "B", authorId: "2", text: "bar" },
      { id: "new1", fetchedAt: recent, authorName: "C", authorId: "3", text: "baz" }
    );

    const count = await runRetention(730);
    expect(count).toBe(2);

    // @ts-expect-error test-only
    const store = db.prisma.__store.comments as MockComment[];
    expect(store.find((c) => c.id === "old1")?.authorName).toBeNull();
    expect(store.find((c) => c.id === "old1")?.text).toBe("[redacted — retention policy]");
    expect(store.find((c) => c.id === "new1")?.authorName).toBe("C");
  });

  it("does nothing when no candidates", async () => {
    const count = await runRetention(730);
    expect(count).toBe(0);
  });

  it("skips already-anonymized comments (authorName null)", async () => {
    const old = new Date(Date.now() - 800 * 24 * 3600 * 1000);
    // @ts-expect-error test-only
    db.prisma.__store.comments.push({
      id: "done",
      fetchedAt: old,
      authorName: null,
      authorId: null,
      text: "[redacted — retention policy]",
    });
    const count = await runRetention(730);
    expect(count).toBe(0);
  });
});
