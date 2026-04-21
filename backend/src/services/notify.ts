import { config } from "../config";
import { logger } from "../utils/logger";

export interface NotificationPayload {
  title: string;
  text: string;
  severity: "info" | "warn" | "critical";
  url?: string;
}

async function postSlack(payload: NotificationPayload): Promise<void> {
  if (!config.notifications.slackWebhookUrl) return;

  const emoji =
    payload.severity === "critical"
      ? ":rotating_light:"
      : payload.severity === "warn"
        ? ":warning:"
        : ":information_source:";

  const body = {
    text: `${emoji} *${payload.title}*`,
    attachments: [
      {
        color:
          payload.severity === "critical" ? "#dc2626" : payload.severity === "warn" ? "#f59e0b" : "#2563eb",
        text: payload.text,
        ...(payload.url ? { title_link: payload.url } : {}),
      },
    ],
  };

  try {
    const res = await fetch(config.notifications.slackWebhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      logger.warn("slack notify failed", { status: res.status });
    }
  } catch (err) {
    logger.warn("slack notify error", { err: String(err) });
  }
}

// nodemailer is imported lazily so the dep isn't loaded when SMTP isn't
// configured. Single transporter instance cached across calls.
let transporter: { sendMail: (opts: Record<string, unknown>) => Promise<unknown> } | null = null;

async function getTransporter() {
  const smtp = config.notifications.smtp;
  if (!smtp.host || !smtp.from) return null;

  if (transporter) return transporter;

  try {
    const nodemailer = (await import("nodemailer")).default;
    transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user && smtp.pass ? { user: smtp.user, pass: smtp.pass } : undefined,
    });
    logger.info("SMTP transporter initialized", { host: smtp.host, port: smtp.port, secure: smtp.secure });
    return transporter;
  } catch (err) {
    logger.error("failed to init nodemailer (is it installed?)", { err: String(err) });
    return null;
  }
}

async function sendEmail(payload: NotificationPayload): Promise<void> {
  const to = config.notifications.notifyEmail;
  if (!to) return;

  const smtp = config.notifications.smtp;
  const t = await getTransporter();
  if (!t) {
    // SMTP not configured — fall back to the log-only stub so the intent is
    // at least observable. Prod must configure SMTP_* for real delivery.
    logger.info("email notify (stub, SMTP not configured)", {
      to,
      subject: payload.title,
      severity: payload.severity,
      body: payload.text,
      hint: "Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM to enable real delivery.",
    });
    return;
  }

  const severityPrefix =
    payload.severity === "critical" ? "🚨 " : payload.severity === "warn" ? "⚠️ " : "ℹ️ ";

  try {
    await t.sendMail({
      from: smtp.from,
      to,
      subject: `${severityPrefix}[Viktor čistič] ${payload.title}`,
      text: `${payload.text}${payload.url ? `\n\n${payload.url}` : ""}`,
      html: [
        `<p style="font-family:system-ui;"><strong>${escapeHtml(severityPrefix)}${escapeHtml(payload.title)}</strong></p>`,
        `<p style="white-space:pre-wrap;font-family:system-ui;color:#334155;">${escapeHtml(payload.text)}</p>`,
        payload.url
          ? `<p><a href="${escapeHtml(payload.url)}" style="color:#2563eb;">${escapeHtml(payload.url)}</a></p>`
          : "",
      ].join(""),
    });
    logger.info("email sent", { to, subject: payload.title, severity: payload.severity });
  } catch (err) {
    logger.warn("email send failed", { err: String(err) });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function notify(payload: NotificationPayload): Promise<void> {
  await Promise.all([postSlack(payload), sendEmail(payload)]);
}

// Test utility for the admin UI — forces transporter init error up to caller.
export async function smtpDiagnose(): Promise<{ configured: boolean; error?: string }> {
  const smtp = config.notifications.smtp;
  if (!smtp.host || !smtp.from) return { configured: false };
  const t = await getTransporter();
  if (!t) return { configured: false, error: "transporter init failed" };
  return { configured: true };
}
