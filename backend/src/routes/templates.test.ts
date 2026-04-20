import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

vi.hoisted(() => {
  process.env.TOKEN_ENCRYPTION_KEY = "a".repeat(64);
  process.env.DATABASE_URL = "file:./dev.db";
});

const store: Array<{
  id: string;
  name: string;
  category: string | null;
  body: string;
  language: string | null;
  enabled: boolean;
}> = [];

vi.mock("../db", () => ({
  prisma: {
    replyTemplate: {
      findMany: async ({ where, orderBy: _ }: { where: { enabled: boolean; OR?: unknown[] } }) => {
        let items = store.filter((t) => t.enabled === where.enabled);
        if (where.OR) {
          const or = where.OR as Array<{ category?: string | null }>;
          items = items.filter((t) =>
            or.some((c) => c.category === t.category || (c.category === null && t.category === null))
          );
        }
        return items;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const t = { id: `t${store.length + 1}`, enabled: true, ...data } as typeof store[number];
        store.push(t);
        return t;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const t = store.find((x) => x.id === where.id);
        if (!t) throw new Error("not found");
        Object.assign(t, data);
        return t;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const i = store.findIndex((x) => x.id === where.id);
        if (i < 0) throw new Error("not found");
        return store.splice(i, 1)[0];
      },
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const t = store.find((x) => x.id === where.id);
        if (!t) throw new Error("not found");
        return t;
      },
    },
  },
}));

vi.mock("../services/audit", () => ({ audit: async () => undefined }));
vi.mock("../middleware/auth", () => ({
  currentUser: () => "test@example.com",
}));

import { templatesRouter } from "./templates";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/templates", templatesRouter);
  return app;
}

beforeEach(() => {
  store.length = 0;
});

describe("templates route", () => {
  it("lists only enabled templates", async () => {
    store.push(
      { id: "t1", name: "A", category: null, body: "hi", language: "cs", enabled: true },
      { id: "t2", name: "B", category: null, body: "bye", language: "cs", enabled: false }
    );
    const res = await request(buildApp()).get("/api/templates");
    expect(res.status).toBe(200);
    expect(res.body.map((t: { id: string }) => t.id)).toEqual(["t1"]);
  });

  it("filters by category (with null-category fallback)", async () => {
    store.push(
      { id: "t1", name: "General", category: null, body: "hello", language: "cs", enabled: true },
      { id: "t2", name: "Positive", category: "positive", body: "ty", language: "cs", enabled: true },
      { id: "t3", name: "Spam", category: "spam", body: "go", language: "cs", enabled: true }
    );
    const res = await request(buildApp()).get("/api/templates?category=positive");
    expect(res.status).toBe(200);
    const ids = res.body.map((t: { id: string }) => t.id).sort();
    expect(ids).toEqual(["t1", "t2"]);
  });

  it("creates a valid template", async () => {
    const res = await request(buildApp())
      .post("/api/templates")
      .send({ name: "New", body: "Hi {author}", category: "neutral", language: "cs" });
    expect(res.status).toBe(200);
    expect(res.body.id).toBeTruthy();
    expect(store).toHaveLength(1);
  });

  it("rejects invalid category", async () => {
    const res = await request(buildApp())
      .post("/api/templates")
      .send({ name: "Bad", body: "x", category: "not_a_real_category" });
    expect(res.status).toBe(400);
  });

  it("renders template with variable substitution", async () => {
    store.push({
      id: "t1",
      name: "greet",
      category: null,
      body: "Dobrý den {author}, děkujeme.",
      language: "cs",
      enabled: true,
    });
    const res = await request(buildApp())
      .post("/api/templates/t1/render")
      .send({ vars: { author: "Jan Novák" } });
    expect(res.status).toBe(200);
    expect(res.body.rendered).toBe("Dobrý den Jan Novák, děkujeme.");
  });

  it("leaves unknown placeholders unchanged", async () => {
    store.push({ id: "t1", name: "x", category: null, body: "Hi {unknown}", language: null, enabled: true });
    const res = await request(buildApp()).post("/api/templates/t1/render").send({ vars: {} });
    expect(res.body.rendered).toBe("Hi {unknown}");
  });

  it("updates a template", async () => {
    store.push({ id: "t1", name: "x", category: null, body: "old", language: null, enabled: true });
    const res = await request(buildApp())
      .patch("/api/templates/t1")
      .send({ body: "new" });
    expect(res.status).toBe(200);
    expect(store[0].body).toBe("new");
  });

  it("deletes a template", async () => {
    store.push({ id: "t1", name: "x", category: null, body: "x", language: null, enabled: true });
    const res = await request(buildApp()).delete("/api/templates/t1");
    expect(res.status).toBe(200);
    expect(store).toHaveLength(0);
  });
});
