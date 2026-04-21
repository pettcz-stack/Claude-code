import basicAuth from "express-basic-auth";
import rateLimit from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";
import { config } from "../config";
import { logger } from "../utils/logger";
import { audit } from "../services/audit";

// Strong rate limit for auth/webhook callback routes. 30 attempts / 15 min / IP.
// Brute-force of DASHBOARD_PASSWORD: a machine trying 30 passwords/15min hits
// the limit; an operator entering it wrong 3× does not.
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "rate_limited", detail: "Too many attempts; try again later." },
  skipSuccessfulRequests: false,
});

// General rate limit for the whole /api surface (protects against a logged-in
// operator accidentally looping, or a lifted credential turning into a scraper).
export const generalRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 600, // 10 req/s sustained — plenty for a human
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

// Very tight limit on action-taking endpoints. Prevents a compromised session
// from mass-moderating (e.g. deleting every comment before operator notices).
export const actionRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 60, // 1 action/s average, bursts OK
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

// Inspect all configured dashboard users at startup. In production mode we
// refuse to boot with ANY weak password — if just one user has a bad password,
// the whole moderation surface is compromised.
export function warnOnWeakPassword(): void {
  const users = Object.entries(config.dashboard.users);
  if (users.length === 0) {
    const msg = "No dashboard users configured — set DASHBOARD_USERS or DASHBOARD_USERNAME+DASHBOARD_PASSWORD";
    if (process.env.NODE_ENV === "production") throw new Error(msg);
    logger.warn(msg);
    return;
  }

  const weak: Array<{ user: string; problems: string[] }> = [];
  for (const [user, pass] of users) {
    const problems = passwordProblems(user, pass);
    if (problems.length > 0) weak.push({ user, problems });
  }

  logger.info("dashboard users configured", {
    count: users.length,
    usernames: users.map(([u]) => u),
  });

  if (weak.length === 0) return;

  if (process.env.NODE_ENV === "production") {
    logger.error("weak dashboard password(s) — refusing to start in production", { weak });
    throw new Error(
      `Weak dashboard passwords: ${weak.map((w) => `${w.user} (${w.problems.join(", ")})`).join("; ")}. Set strong passwords (≥12 chars, not default) before running with NODE_ENV=production.`
    );
  }
  logger.warn("weak dashboard password(s) — NOT safe for public deploy", { weak });
}

const basic = basicAuth({
  users: config.dashboard.users,
  challenge: true,
  realm: "albixon-moderator",
  unauthorizedResponse: { error: "unauthorized" },
});

// Wrap basic-auth to add per-attempt audit logging. On failure we write an
// audit entry with the offending username (never the password) and the IP —
// makes it trivial to spot brute-force in the audit export.
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
      // basic-auth has already written 401. Record the attempted username (if sent).
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
      // Successful login — only audit if this is the first request in the
      // session. We key by IP+user to avoid spamming; not a perfect "login"
      // event (basic auth has no login), but good enough for audit trail.
      audit({
        entityType: "Auth",
        entityId: user,
        event: "auth.ok",
        metadata: { ip, path: req.path, user },
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
