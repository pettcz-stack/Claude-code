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

  const emoji = payload.severity === "critical" ? ":rotating_light:" : payload.severity === "warn" ? ":warning:" : ":information_source:";

  const body = {
    text: `${emoji} *${payload.title}*`,
    attachments: [
      {
        color: payload.severity === "critical" ? "#dc2626" : payload.severity === "warn" ? "#f59e0b" : "#2563eb",
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

async function sendEmail(payload: NotificationPayload): Promise<void> {
  const to = config.notifications.notifyEmail;
  if (!to) return;

  // Minimal stub: log the intended email. In production wire up an SMTP
  // transport (nodemailer) — out of scope for MVP to avoid credentials
  // management for the dev environment.
  logger.info("email notify (stub)", {
    to,
    subject: payload.title,
    severity: payload.severity,
    body: payload.text,
  });
}

export async function notify(payload: NotificationPayload): Promise<void> {
  await Promise.all([postSlack(payload), sendEmail(payload)]);
}
