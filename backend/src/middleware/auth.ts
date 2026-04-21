import basicAuth from "express-basic-auth";
import rateLimit from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";
import { config, type Role } from "../config";
import { logger } from "../utils/logger";
import { audit } from "../services/audit";

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "rate_limited", detail: "Too many attempts; try again later." },
  skipSuccessfulRequests: false,
});

export const generalRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

export const actionRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

const COMMON_WEAK = new Set(["demo", "change-me", "admin", "password", "test", "123456", "1234", "passw0rd"]);

function passwordProblems(user: string, p: string): string[] {
  const problems: string[] = [];
  if (!p) problems.push("empty");
  if (COMMON_WEAK.has(p.toLowerCase())) problems.push("common/default");
  if (p.length < 12) problems.push(`only ${p.length} chars (≥12 required)`);
  if (p.toLowerCase() === user.toLowerCase()) problems.push("equals username");
  return problems;
}

export function warnOnWeakPassword(): void {
  const users = Object.entries(config.dashboard.users);
  if (users.length === 0) {
    const msg = "No dashboard users configured — set DASHBOARD_USERS or DASHBOARD_USERNAME+DASHBOARD_PASSWORD";
    if (process.env.NODE_ENV === "production") throw new Error(msg);
    logger.warn(msg);
    return;
  }

  const weak: Array<{ user: string; problems: string[] }> = [];
  for (const [user, u] of users) {
    const problems = passwordProblems(user, u.password);
    if (problems.length > 0) weak.push({ user, problems });
  }

  logger.info("dashboard users configured", {
    count: users.length,
    breakdown: users.map(([u, cfg]) => `${u}(${cfg.role})`),
  });

  // Every team should have at least one admin; otherwise nobody can manage
  // accounts / rules / reply kill switch. Refuse to boot — it's a misconfig.
  const hasAdmin = users.some(([_, u]) => u.role === "admin");
  if (!hasAdmin) {
    const msg = "DASHBOARD_USERS has no admin — at least one user must have role=admin";
    if (process.env.NODE_ENV === "production") throw new Error(msg);
    logger.warn(msg);
  }

  if (weak.length === 0) return;

  if (process.env.NODE_ENV === "production") {
    logger.error("weak dashboard password(s) — refusing to start in production", { weak });
    throw new Error(
      `Weak dashboard passwords: ${weak.map((w) => `${w.user} (${w.problems.join(", ")})`).join("; ")}. Set strong passwords (≥12 chars, not default) before running with NODE_ENV=production.`
    );
  }
  logger.warn("weak dashboard password(s) — NOT safe for public deploy", { weak });
}

// express-basic-auth wants a `user → password` map. We keep the password map
// in sync with the full user config at module load.
const passwordMap: Record<string, string> = Object.fromEntries(
  Object.entries(config.dashboard.users).map(([u, cfg]) => [u, cfg.password])
);

const basic = basicAuth({
  users: passwordMap,
  challenge: true,
  realm: "viktor-cistic",
  unauthorizedResponse: { error: "unauthorized" },
});

export const dashboardAuth = (req: Request, res: Response, next: NextFunction): void => {
  basic(req, res, (err?: unknown) => {
    const user = (req as unknown as { auth?: { user?: string } }).auth?.user;
    const ip = (req.ip ?? req.socket?.remoteAddress ?? "").replace(/^::ffff:/, "");
    if (err) {
      logger.warn("auth error", { ip, path: req.path, err: String(err) });
      audit({
        entityType: "Auth",
        entityId: ip || "unknown",
        event: "auth.error",
        metadata: { ip, path: req.path, error: String(err) },
      }).catch(() => undefined);
      return next(err);
    }
    if (res.statusCode === 401) {
      const attempted = extractAttemptedUser(req);
      logger.warn("auth failed", { ip, path: req.path, attempted });
      audit({
        entityType: "Auth",
        entityId: ip || "unknown",
        event: "auth.failed",
        metadata: { ip, path: req.path, attempted },
      }).catch(() => undefined);
      return;
    }
    if (user) {
      audit({
        entityType: "Auth",
        entityId: user,
        event: "auth.ok",
        metadata: { ip, path: req.path, user, role: getRole(user) },
      }).catch(() => undefined);
    }
    next();
  });
};

function extractAttemptedUser(req: Request): string | null {
  const h = req.headers["authorization"];
  if (!h || !h.startsWith("Basic ")) return null;
  try {
    const dec = Buffer.from(h.slice(6), "base64").toString("utf8");
    const idx = dec.indexOf(":");
    return idx >= 0 ? dec.slice(0, idx).slice(0, 64) : null;
  } catch {
    return null;
  }
}

export function currentUser(req: Request): string {
  const auth = (req as unknown as { auth?: { user?: string } }).auth;
  return auth?.user ?? "unknown";
}

export function getRole(user: string): Role {
  const cfg = config.dashboard.users[user];
  // Unknown users can never reach this — auth rejects them — but return the
  // most-restrictive role as a belt-and-braces default.
  return cfg?.role ?? "viewer";
}

export function currentRole(req: Request): Role {
  return getRole(currentUser(req));
}

/**
 * Reject requests whose user doesn't hold one of the allowed roles.
 *
 *   requireRole("admin")                → only admins
 *   requireRole("admin", "moderator")   → admin or moderator (not viewer)
 */
export function requireRole(...allowed: Role[]) {
  const set = new Set(allowed);
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = currentRole(req);
    if (!set.has(role)) {
      const user = currentUser(req);
      logger.warn("role-gated route denied", {
        user,
        role,
        required: allowed,
        path: req.path,
        method: req.method,
      });
      audit({
        entityType: "Auth",
        entityId: user,
        event: "auth.role_denied",
        metadata: { role, required: allowed, path: req.path, method: req.method },
      }).catch(() => undefined);
      res.status(403).json({
        error: "forbidden",
        message: `Role '${role}' není oprávněná provést tuto akci. Vyžadováno: ${allowed.join(" nebo ")}.`,
      });
      return;
    }
    next();
  };
}
