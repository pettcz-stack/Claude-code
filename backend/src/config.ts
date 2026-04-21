import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function optional(name: string, def = ""): string {
  return process.env[name] ?? def;
}

function num(name: string, def: number): number {
  const v = process.env[name];
  if (!v) return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function bool(name: string, def: boolean): boolean {
  const v = process.env[name];
  if (v === undefined) return def;
  return /^(1|true|yes|on)$/i.test(v);
}

export const ROLES = ["admin", "moderator", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export interface DashboardUser {
  password: string;
  role: Role;
}

function normalizeRole(raw: string | undefined): Role {
  const r = (raw ?? "").trim().toLowerCase();
  if ((ROLES as readonly string[]).includes(r)) return r as Role;
  return "admin"; // backward-compat: missing role = admin (legacy 2-segment format)
}

export function parseUsers(
  raw: string | undefined,
  fallback: { user: string; pass: string }
): Record<string, DashboardUser> {
  // Format:  user:pass:role  (role ∈ admin|moderator|viewer, optional = admin)
  // Multiple entries separated by commas. Backward-compatible with the older
  // two-segment form. Skip malformed entries without throwing so one bad
  // entry doesn't lock everyone out.
  if (!raw || raw.trim() === "") {
    if (!fallback.user || !fallback.pass) return {};
    return { [fallback.user]: { password: fallback.pass, role: "admin" } };
  }
  const out: Record<string, DashboardUser> = {};
  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const firstColon = trimmed.indexOf(":");
    if (firstColon < 1) continue;
    const user = trimmed.slice(0, firstColon).trim();
    const rest = trimmed.slice(firstColon + 1);

    // Role is the segment after the LAST colon IF it matches a known role.
    // This preserves colons in passwords: "alice:p@ss:with:colons:admin" →
    // user=alice, pass="p@ss:with:colons", role=admin.
    const lastColon = rest.lastIndexOf(":");
    let pass: string;
    let role: Role;
    if (lastColon >= 0) {
      const maybeRole = rest.slice(lastColon + 1).trim().toLowerCase();
      if ((ROLES as readonly string[]).includes(maybeRole)) {
        pass = rest.slice(0, lastColon).trim();
        role = maybeRole as Role;
      } else {
        pass = rest.trim();
        role = "admin";
      }
    } else {
      pass = rest.trim();
      role = "admin";
    }
    if (user && pass) out[user] = { password: pass, role: normalizeRole(role) };
  }
  return out;
}

export const config = {
  port: num("PORT", 3000),
  databaseUrl: optional("DATABASE_URL", "file:./dev.db"),

  meta: {
    appId: optional("META_APP_ID"),
    appSecret: optional("META_APP_SECRET"),
    redirectUri: optional("META_REDIRECT_URI", "http://localhost:3000/auth/callback"),
    webhookVerifyToken: optional("META_WEBHOOK_VERIFY_TOKEN", "change-me"),
    graphVersion: optional("META_GRAPH_VERSION", "v21.0"),
  },

  anthropic: {
    apiKey: optional("ANTHROPIC_API_KEY"),
    modelFast: optional("ANTHROPIC_MODEL_FAST", "claude-haiku-4-5"),
    modelSmart: optional("ANTHROPIC_MODEL_SMART", "claude-sonnet-4-6"),
  },

  google: {
    clientId: optional("GOOGLE_CLIENT_ID"),
    clientSecret: optional("GOOGLE_CLIENT_SECRET"),
    redirectUri: optional("GOOGLE_REDIRECT_URI", "http://localhost:3000/auth/google/callback"),
  },

  security: {
    tokenEncryptionKey: optional("TOKEN_ENCRYPTION_KEY"),
    sessionSecret: optional("SESSION_SECRET", "change-me"),
  },

  dashboard: {
    // Legacy single-user fallback (back-compat with existing installs).
    username: optional("DASHBOARD_USERNAME", "admin"),
    password: optional("DASHBOARD_PASSWORD", "change-me"),
    // Preferred: multi-user. Format "alice:passA,bob:passB" (no quotes).
    // When set, overrides the single-user pair above.
    users: parseUsers(process.env.DASHBOARD_USERS, {
      user: optional("DASHBOARD_USERNAME", "admin"),
      pass: optional("DASHBOARD_PASSWORD", "change-me"),
    }),
  },

  polling: {
    intervalMinutes: num("POLL_INTERVAL_MINUTES", 5),
  },

  autoModeration: {
    enabled: bool("AUTO_MODERATE_ENABLED", true),
    spamThreshold: num("AUTO_DELETE_SPAM_THRESHOLD", 0.9),
    vulgarityThreshold: num("AUTO_HIDE_VULGARITY_THRESHOLD", 0.85),
  },

  notifications: {
    slackWebhookUrl: optional("SLACK_WEBHOOK_URL"),
    notifyEmail: optional("NOTIFY_EMAIL"),
    smtp: {
      host: optional("SMTP_HOST"),
      port: num("SMTP_PORT", 587),
      user: optional("SMTP_USER"),
      pass: optional("SMTP_PASS"),
      from: optional("SMTP_FROM", ""),
      secure: bool("SMTP_SECURE", false), // true for 465, false for STARTTLS on 587
    },
  },
};

export function assertRuntimeConfig(): void {
  // Only required at runtime when token encryption is needed.
  if (!config.security.tokenEncryptionKey) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY missing. Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(config.security.tokenEncryptionKey)) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be 64 hex chars (32 bytes).");
  }
}

export { required };
