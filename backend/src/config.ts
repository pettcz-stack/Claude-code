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

export function parseUsers(
  raw: string | undefined,
  fallback: { user: string; pass: string }
): Record<string, string> {
  // DASHBOARD_USERS="alice:passA,bob:passB" → { alice: "passA", bob: "passB" }.
  // Falls back to the single DASHBOARD_USERNAME / DASHBOARD_PASSWORD pair when
  // DASHBOARD_USERS is empty / unset. Skip malformed entries without throwing
  // so that one bad entry doesn't lock everyone out.
  if (!raw || raw.trim() === "") {
    if (!fallback.user || !fallback.pass) return {};
    return { [fallback.user]: fallback.pass };
  }
  const out: Record<string, string> = {};
  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(":");
    if (idx < 1) continue;
    const user = trimmed.slice(0, idx).trim();
    // Trim whitespace around password; unlikely-to-be-intentional and common
    // when users type the .env manually. If somebody genuinely wants a
    // password with surrounding whitespace they can set DASHBOARD_PASSWORD.
    const pass = trimmed.slice(idx + 1).trim();
    if (user && pass) out[user] = pass;
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
