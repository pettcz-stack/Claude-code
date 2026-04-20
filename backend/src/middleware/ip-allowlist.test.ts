import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

const saved = process.env.ALLOWED_IPS;

beforeEach(() => {
  // Reset module cache so each test gets a fresh allowlist derived from env.
  vi.resetModules();
});

function buildApp(allowedIps?: string) {
  if (allowedIps === undefined) delete process.env.ALLOWED_IPS;
  else process.env.ALLOWED_IPS = allowedIps;
  return import("./ip-allowlist").then(({ ipAllowlist }) => {
    const app = express();
    app.use(ipAllowlist());
    app.get("/ping", (_req, res) => res.json({ ok: true }));
    return app;
  });
}

describe("ipAllowlist middleware", () => {
  it("is a no-op when ALLOWED_IPS is not set", async () => {
    const app = await buildApp(undefined);
    const res = await request(app).get("/ping");
    expect(res.status).toBe(200);
  });

  it("denies when the client IP does not match", async () => {
    const app = await buildApp("10.0.0.0/8");
    const res = await request(app).get("/ping");
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("ip_not_allowed");
  });

  it("allows exact IP match (IPv4)", async () => {
    const app = await buildApp("127.0.0.1,::1");
    const res = await request(app).get("/ping");
    expect(res.status).toBe(200);
  });

  it("allows CIDR match for loopback", async () => {
    const app = await buildApp("127.0.0.0/8");
    const res = await request(app).get("/ping");
    expect(res.status).toBe(200);
  });

  it("gracefully handles an invalid entry and denies all", async () => {
    const app = await buildApp("not-an-ip");
    const res = await request(app).get("/ping");
    expect(res.status).toBe(403);
  });

  it("ipAllowlistActive reflects env presence", async () => {
    process.env.ALLOWED_IPS = "127.0.0.1";
    const { ipAllowlistActive } = await import("./ip-allowlist");
    expect(ipAllowlistActive()).toBe(true);
  });
});

// Restore for subsequent test files in the same run.
if (saved === undefined) delete process.env.ALLOWED_IPS;
else process.env.ALLOWED_IPS = saved;
