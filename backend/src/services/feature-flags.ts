import { prisma } from "../db";

// Feature flags stored in the `Setting` table so they're toggleable at runtime
// (without redeploy). Defaults are SAFE — reply is OFF by default, because the
// user explicitly requested a kill switch for public-facing writes.

export const FLAGS = {
  replyEnabled: "reply_enabled",
  autoModerationPaused: "auto_moderation_paused",
  usageAlertUsd: "usage_alert_usd",
  criticalKeywords: "critical_keywords",
} as const;

async function getRaw(key: string): Promise<string | null> {
  const s = await prisma.setting.findUnique({ where: { key } });
  return s?.value ?? null;
}

export async function isReplyEnabled(): Promise<boolean> {
  const v = await getRaw(FLAGS.replyEnabled);
  // Default: OFF. Explicit "true" required.
  return v === "true";
}

export async function setReplyEnabled(enabled: boolean): Promise<void> {
  await prisma.setting.upsert({
    where: { key: FLAGS.replyEnabled },
    create: { key: FLAGS.replyEnabled, value: enabled ? "true" : "false" },
    update: { value: enabled ? "true" : "false" },
  });
}

export async function getUsageAlertThreshold(): Promise<number | null> {
  const v = await getRaw(FLAGS.usageAlertUsd);
  const n = Number(v ?? "");
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function setUsageAlertThreshold(usd: number | null): Promise<void> {
  if (usd === null || !Number.isFinite(usd) || usd <= 0) {
    await prisma.setting.deleteMany({ where: { key: FLAGS.usageAlertUsd } });
  } else {
    await prisma.setting.upsert({
      where: { key: FLAGS.usageAlertUsd },
      create: { key: FLAGS.usageAlertUsd, value: String(usd) },
      update: { value: String(usd) },
    });
  }
}

export async function getCriticalKeywords(): Promise<string[]> {
  const v = await getRaw(FLAGS.criticalKeywords);
  if (!v) return [];
  return v.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}

export async function setCriticalKeywords(kws: string[]): Promise<void> {
  const clean = kws.map((s) => s.trim()).filter((s) => s.length > 0);
  await prisma.setting.upsert({
    where: { key: FLAGS.criticalKeywords },
    create: { key: FLAGS.criticalKeywords, value: clean.join(",") },
    update: { value: clean.join(",") },
  });
}
