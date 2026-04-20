import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { config, assertRuntimeConfig } from "./config";
import { logger } from "./utils/logger";
import { authRouter } from "./routes/auth";
import { accountsRouter } from "./routes/accounts";
import { commentsRouter } from "./routes/comments";
import { rulesRouter } from "./routes/rules";
import { auditRouter } from "./routes/audit";
import { statsRouter } from "./routes/stats";
import { webhooksRouter } from "./routes/webhooks";
import { adminRouter } from "./routes/admin";
import { metricsRouter } from "./routes/metrics";
import { templatesRouter } from "./routes/templates";
import { dashboardAuth } from "./middleware/auth";
import { startScheduler } from "./jobs/scheduler";

function createApp(): express.Express {
  const app = express();

  // Lock CORS to explicit allowlist. Reflecting any Origin with credentials
  // enabled would let any site read API responses when a user has dashboard
  // basic-auth cached.
  const allowedOrigins = [
    `http://localhost:${config.port}`,
    "http://localhost:5173", // vite dev server
    ...(process.env.CORS_EXTRA_ORIGIN ? process.env.CORS_EXTRA_ORIGIN.split(",") : []),
  ];
  app.use(
    cors({
      origin: (origin, cb) => {
        // Same-origin requests (no Origin header) are always allowed.
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new Error("Origin not allowed by CORS"));
      },
      credentials: true,
    })
  );

  // Capture raw body for webhook signature verification.
  app.use(
    express.json({
      limit: "1mb",
      verify: (req, _res, buf) => {
        (req as unknown as { rawBody: Buffer }).rawBody = buf;
      },
    })
  );

  // Webhooks and auth callback do not require basic auth.
  app.use("/webhooks", webhooksRouter);
  app.use("/auth", authRouter);

  app.get("/health", (_req, res) => {
    res.json({ ok: true, version: "0.1.0" });
  });

  // Deep readiness check — used by orchestrators and the Admin status page.
  app.get("/health/ready", async (_req, res) => {
    const checks: Record<string, { ok: boolean; detail?: string }> = {};
    try {
      const { prisma } = await import("./db");
      await prisma.$queryRawUnsafe("SELECT 1");
      checks.db = { ok: true };
    } catch (err) {
      checks.db = { ok: false, detail: String(err) };
    }
    checks.anthropicKey = { ok: Boolean(config.anthropic.apiKey) };
    checks.metaAppConfig = {
      ok: Boolean(config.meta.appId && config.meta.appSecret),
      detail:
        config.meta.appId && config.meta.appSecret
          ? undefined
          : "META_APP_ID or META_APP_SECRET missing; OAuth will not work",
    };
    checks.tokenEncryption = {
      ok: /^[0-9a-fA-F]{64}$/.test(config.security.tokenEncryptionKey),
    };

    try {
      const { prisma } = await import("./db");
      const active = await prisma.account.count({ where: { active: true } });
      checks.accounts = {
        ok: active > 0,
        detail: active === 0 ? "No active accounts — link one via /auth/start" : `${active} active`,
      };
    } catch {
      checks.accounts = { ok: false, detail: "unable to query accounts" };
    }

    const ok = Object.values(checks).every((c) => c.ok);
    res.status(ok ? 200 : 503).json({ ok, checks });
  });

  // Prometheus scrape endpoint — unprotected but restrict via network policy.
  app.use("/metrics", metricsRouter);

  // Dashboard API — protected.
  app.use("/api", dashboardAuth);
  app.use("/api/accounts", accountsRouter);
  app.use("/api/comments", commentsRouter);
  app.use("/api/rules", rulesRouter);
  app.use("/api/audit", auditRouter);
  app.use("/api/stats", statsRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/templates", templatesRouter);

  // Serve built frontend if present.
  const frontendDist = path.resolve(__dirname, "../../frontend/dist");
  if (fs.existsSync(frontendDist)) {
    app.use(dashboardAuth);
    app.use(express.static(frontendDist));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(frontendDist, "index.html"));
    });
  }

  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      logger.error("unhandled error", { err: String(err) });
      res.status(500).json({ error: "internal_error" });
    }
  );

  return app;
}

async function main(): Promise<void> {
  assertRuntimeConfig();
  const app = createApp();
  app.listen(config.port, () => {
    logger.info("server listening", { port: config.port });
  });
  startScheduler();
}

main().catch((err) => {
  logger.error("fatal", { err: String(err) });
  process.exit(1);
});
