import express from "express";
import cors from "cors";
import helmet from "helmet";
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
import { usageRouter } from "./routes/usage";
import { settingsRouter } from "./routes/settings";
import { meRouter } from "./routes/me";
import {
  dashboardAuth,
  authRateLimit,
  generalRateLimit,
  actionRateLimit,
  warnOnWeakPassword,
  requireRole,
} from "./middleware/auth";
import { ipAllowlist, ipAllowlistActive } from "./middleware/ip-allowlist";
import { startScheduler } from "./jobs/scheduler";

function createApp(): express.Express {
  const app = express();

  // If we're behind a reverse proxy (Caddy/nginx/Cloudflare), trust X-Forwarded-For
  // so rate-limit + IP allowlist see the real client, not 127.0.0.1.
  if (process.env.TRUST_PROXY) {
    app.set("trust proxy", process.env.TRUST_PROXY);
  }

  // Security headers. Frontend is same-origin so a restrictive CSP works.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // Tailwind-generated classes + vite inline styles need 'unsafe-inline'.
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "blob:"],
          // We call same-origin /api + optional Slack webhook.
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: "no-referrer" },
    })
  );

  // Lock CORS to explicit allowlist. Reflecting any Origin with credentials
  // enabled would let any site read API responses when a user has dashboard
  // basic-auth cached.
  const allowedOrigins = [
    `http://localhost:${config.port}`,
    `http://127.0.0.1:${config.port}`,
    "http://localhost:5173",
    ...(process.env.CORS_EXTRA_ORIGIN ? process.env.CORS_EXTRA_ORIGIN.split(",") : []),
  ];
  app.use(
    cors({
      origin: (origin, cb) => {
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

  // IP allowlist applies broadly (not to /health or /webhooks which Meta needs to hit).
  // Webhooks and auth callback do not require basic auth.
  const allowlist = ipAllowlist();

  app.use("/webhooks", webhooksRouter);
  app.use("/auth", allowlist, authRateLimit, authRouter);

  app.get("/health", (_req, res) => {
    res.json({ ok: true, version: "0.1.0" });
  });

  // Prometheus scrape endpoint — IP allowlist still applies.
  app.use("/metrics", allowlist, metricsRouter);

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
    checks.ipAllowlist = {
      ok: true,
      detail: ipAllowlistActive() ? "active" : "not set (open to any IP)",
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

  // Dashboard API — protected. Layered defense: IP allowlist → general rate
  // limit → basic auth (which audits per-attempt).
  app.use("/api", allowlist, generalRateLimit, dashboardAuth);
  // Extra tight limit on action-taking endpoints to cap blast radius of
  // a compromised or misbehaving session.
  app.use(["/api/comments/*/action", "/api/comments/bulk-action"], actionRateLimit);

  // Role-based access control. Order matters — always register role gates
  // BEFORE the actual router mount.
  //
  //   - admin     → unrestricted
  //   - moderator → read everything + hide/keep/reply + reclassify; cannot
  //                 delete comments, manage accounts/rules/templates/
  //                 settings, run retention/bulk-reclassify, see raw usage.
  //   - viewer    → read-only everywhere.
  //
  // We gate by METHOD on the routers where admin separation is clean
  // (accounts, rules, templates, settings, admin). For comments we gate
  // per-action in the route handler (moderator may Hide/Keep/Reply, but
  // not Delete).
  app.use("/api/me", meRouter);
  // Viewer is read-only — block any write on any API.
  app.use("/api", (req, _res, next) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
    return requireRole("admin", "moderator")(req, _res, next);
  });
  // Admin-only surface area.
  app.use("/api/accounts", requireRole("admin"), accountsRouter);
  app.use("/api/rules", requireRole("admin"), rulesRouter);
  app.use("/api/templates", requireRole("admin"), templatesRouter);
  app.use("/api/settings", requireRole("admin"), settingsRouter);
  app.use("/api/admin", requireRole("admin"), adminRouter);

  // Shared surface (read for viewer; write for admin+moderator).
  app.use("/api/comments", commentsRouter);
  app.use("/api/audit", auditRouter);
  app.use("/api/stats", statsRouter);
  app.use("/api/usage", usageRouter);

  // Serve built frontend if present.
  const frontendDist = path.resolve(__dirname, "../../frontend/dist");
  if (fs.existsSync(frontendDist)) {
    app.use(allowlist, dashboardAuth);
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
  warnOnWeakPassword();
  const app = createApp();
  app.listen(config.port, () => {
    logger.info("server listening", {
      port: config.port,
      ipAllowlist: ipAllowlistActive(),
      replyKillSwitch: "check /api/settings",
    });
  });
  startScheduler();
}

main().catch((err) => {
  logger.error("fatal", { err: String(err) });
  process.exit(1);
});
