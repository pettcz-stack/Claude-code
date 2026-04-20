import type { Request, Response, NextFunction } from "express";
import ipaddr from "ipaddr.js";
import { logger } from "../utils/logger";

/**
 * Optional IP allowlist. When ALLOWED_IPS is set in env, only requests whose
 * remote address falls inside one of the configured CIDR ranges (or exact
 * IPs) will reach protected routes. Webhooks and /health are exempt.
 *
 * ALLOWED_IPS example:  "127.0.0.1,::1,10.0.0.0/8,192.168.1.0/24"
 */
function parseAllowlist(raw: string): Array<{ match: (addr: ipaddr.IPv4 | ipaddr.IPv6) => boolean; label: string }> {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((entry) => {
      if (entry.includes("/")) {
        const [addr, bits] = entry.split("/");
        try {
          const parsed = ipaddr.parse(addr);
          const prefix = Number(bits);
          return {
            label: entry,
            match: (a: ipaddr.IPv4 | ipaddr.IPv6) => {
              try {
                if (a.kind() !== parsed.kind()) return false;
                return a.match(parsed, prefix);
              } catch {
                return false;
              }
            },
          };
        } catch (err) {
          logger.error("invalid CIDR in ALLOWED_IPS", { entry, err: String(err) });
          return { label: entry, match: () => false };
        }
      }
      try {
        const parsed = ipaddr.parse(entry);
        return {
          label: entry,
          match: (a: ipaddr.IPv4 | ipaddr.IPv6) => a.kind() === parsed.kind() && a.toString() === parsed.toString(),
        };
      } catch (err) {
        logger.error("invalid IP in ALLOWED_IPS", { entry, err: String(err) });
        return { label: entry, match: () => false };
      }
    });
}

function normalize(req: Request): string | null {
  const raw = (req.ip ?? req.socket?.remoteAddress ?? "").toString();
  if (!raw) return null;
  return raw.replace(/^::ffff:/, "");
}

export function ipAllowlist() {
  const raw = (process.env.ALLOWED_IPS ?? "").trim();
  if (!raw) {
    // No allowlist configured — middleware is a no-op.
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }

  const rules = parseAllowlist(raw);
  logger.info("IP allowlist active", { rules: rules.map((r) => r.label) });

  return (req: Request, res: Response, next: NextFunction) => {
    const addr = normalize(req);
    if (!addr) {
      logger.warn("IP allowlist: no client address, denying");
      return res.status(403).json({ error: "ip_not_allowed" });
    }
    let parsed: ipaddr.IPv4 | ipaddr.IPv6;
    try {
      parsed = ipaddr.parse(addr);
    } catch {
      logger.warn("IP allowlist: unparseable address", { addr });
      return res.status(403).json({ error: "ip_not_allowed" });
    }
    if (!rules.some((r) => r.match(parsed))) {
      logger.warn("IP allowlist: denied", { addr });
      return res.status(403).json({ error: "ip_not_allowed" });
    }
    return next();
  };
}

// exported for config endpoint / tests
export function ipAllowlistActive(): boolean {
  return (process.env.ALLOWED_IPS ?? "").trim().length > 0;
}
