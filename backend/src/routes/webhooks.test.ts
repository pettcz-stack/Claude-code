import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";
import express from "express";
import request from "supertest";

const { fetchAccountMock } = vi.hoisted(() => {
  process.env.META_APP_SECRET = "test-secret";
  process.env.META_WEBHOOK_VERIFY_TOKEN = "verify-abc";
  process.env.TOKEN_ENCRYPTION_KEY = "a".repeat(64);
  return { fetchAccountMock: vi.fn() };
});

vi.mock("../meta/fetcher", () => ({
  fetchAccount: fetchAccountMock,
}));

vi.mock("../db", () => ({
  prisma: {
    account: {
      findMany: async () => [{ id: "acc-1", pageId: "page-1", active: true }],
    },
    auditLog: { create: async () => ({}) },
  },
}));

vi.mock("../services/audit", () => ({ audit: async () => undefined }));

import { webhooksRouter } from "./webhooks";

function buildApp() {
  const app = express();
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as unknown as { rawBody: Buffer }).rawBody = buf;
      },
    })
  );
  app.use("/webhooks", webhooksRouter);
  return app;
}

function sign(body: string): string {
  return "sha256=" + crypto.createHmac("sha256", "test-secret").update(body).digest("hex");
}

beforeEach(() => {
  fetchAccountMock.mockReset();
  fetchAccountMock.mockResolvedValue(undefined);
});

describe("webhooks/meta", () => {
  it("GET verifies hub.challenge when token matches", async () => {
    const app = buildApp();
    const res = await request(app)
      .get("/webhooks/meta")
      .query({ "hub.mode": "subscribe", "hub.verify_token": "verify-abc", "hub.challenge": "xyz-123" });
    expect(res.status).toBe(200);
    expect(res.text).toBe("xyz-123");
  });

  it("GET rejects wrong verify token", async () => {
    const app = buildApp();
    const res = await request(app)
      .get("/webhooks/meta")
      .query({ "hub.mode": "subscribe", "hub.verify_token": "nope", "hub.challenge": "xyz" });
    expect(res.status).toBe(403);
  });

  it("POST accepts payload with valid signature and triggers fetch", async () => {
    const app = buildApp();
    const payload = {
      object: "page",
      entry: [{ id: "page-1", changes: [{ field: "feed", value: {} }] }],
    };
    const body = JSON.stringify(payload);
    const res = await request(app)
      .post("/webhooks/meta")
      .set("content-type", "application/json")
      .set("x-hub-signature-256", sign(body))
      .send(body);

    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchAccountMock).toHaveBeenCalledWith("acc-1");
  });

  it("POST rejects invalid signature", async () => {
    const app = buildApp();
    const payload = { object: "page", entry: [] };
    const body = JSON.stringify(payload);
    const res = await request(app)
      .post("/webhooks/meta")
      .set("content-type", "application/json")
      .set("x-hub-signature-256", "sha256=deadbeef")
      .send(body);

    expect(res.status).toBe(401);
    expect(fetchAccountMock).not.toHaveBeenCalled();
  });
});
