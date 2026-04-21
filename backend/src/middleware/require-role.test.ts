import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.hoisted(() => {
  process.env.TOKEN_ENCRYPTION_KEY = "a".repeat(64);
  process.env.DASHBOARD_USERS = "alice:aLongEnoughPass!:admin,bob:aLongEnoughPass!:moderator,carol:aLongEnoughPass!:viewer";
});

vi.mock("../services/audit", () => ({ audit: async () => undefined }));

import { requireRole } from "./auth";

function fakeAuth(user: string) {
  return (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as unknown as { auth?: { user: string } }).auth = { user };
    next();
  };
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.get("/admin-only", fakeAuth("alice"), requireRole("admin"), (_req, res) => res.json({ ok: true }));
  app.get("/admin-only-mod-tries", fakeAuth("bob"), requireRole("admin"), (_req, res) => res.json({ ok: true }));
  app.get("/admin-only-viewer-tries", fakeAuth("carol"), requireRole("admin"), (_req, res) => res.json({ ok: true }));
  app.get("/mod-or-admin/:user", (req, res, next) => fakeAuth(req.params.user)(req, res, next), requireRole("admin", "moderator"), (_req, res) => res.json({ ok: true }));
  return app;
}

beforeEach(() => {
  // Reset so mocks / modules stay aligned
});

describe("requireRole middleware", () => {
  it("allows admin through admin-only route", async () => {
    const res = await request(buildApp()).get("/admin-only");
    expect(res.status).toBe(200);
  });

  it("denies moderator on admin-only route", async () => {
    const res = await request(buildApp()).get("/admin-only-mod-tries");
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("forbidden");
  });

  it("denies viewer on admin-only route", async () => {
    const res = await request(buildApp()).get("/admin-only-viewer-tries");
    expect(res.status).toBe(403);
  });

  it("allows admin on admin-or-moderator route", async () => {
    const res = await request(buildApp()).get("/mod-or-admin/alice");
    expect(res.status).toBe(200);
  });

  it("allows moderator on admin-or-moderator route", async () => {
    const res = await request(buildApp()).get("/mod-or-admin/bob");
    expect(res.status).toBe(200);
  });

  it("denies viewer on admin-or-moderator route", async () => {
    const res = await request(buildApp()).get("/mod-or-admin/carol");
    expect(res.status).toBe(403);
  });
});
