import { prisma } from "../db";
import { config } from "../config";
import { performAction } from "./actions";
import { logger } from "../utils/logger";

const FORBIDDEN_AUTO = new Set(["brand_attack", "legitimate_criticism"]);

export async function isAutoModerationPaused(): Promise<boolean> {
  const paused = await prisma.setting.findUnique({ where: { key: "auto_moderation_paused" } });
  if (paused?.value === "true") return true;
  return !config.autoModeration.enabled;
}

interface MatchResult {
  action: "hide" | "delete";
  ruleName: string;
}

async function matchRule(category: string, confidence: number): Promise<MatchResult | null> {
  if (FORBIDDEN_AUTO.has(category)) return null;

  const rules = await prisma.rule.findMany({ where: { enabled: true, category } });
  for (const r of rules) {
    if (confidence >= r.minConfidence && (r.action === "hide" || r.action === "delete")) {
      return { action: r.action, ruleName: r.name };
    }
  }

  // Fallback defaults (from env thresholds).
  if (category === "spam" && confidence >= config.autoModeration.spamThreshold) {
    return { action: "delete", ruleName: "default-spam" };
  }
  if (category === "vulgarity" && confidence >= config.autoModeration.vulgarityThreshold) {
    return { action: "hide", ruleName: "default-vulgarity" };
  }
  return null;
}

async function hasWhitelistedAuthor(authorId: string | null, authorName: string | null): Promise<boolean> {
  const entries = await prisma.listEntry.findMany({
    where: { kind: "whitelist_author" },
  });
  return entries.some((e) => e.value === authorId || e.value === authorName);
}

export async function runAutoModeration(commentId: string): Promise<void> {
  if (await isAutoModerationPaused()) {
    logger.info("auto-moderation paused, skipping", { commentId });
    return;
  }

  const comment = await prisma.comment.findUniqueOrThrow({
    where: { id: commentId },
    include: {
      classifications: { orderBy: { classifiedAt: "desc" }, take: 1 },
    },
  });

  const c = comment.classifications[0];
  if (!c) return;

  if (await hasWhitelistedAuthor(comment.authorId, comment.authorName)) {
    logger.info("author whitelisted, skipping auto-moderation", { commentId });
    return;
  }

  const match = await matchRule(c.category, c.confidence);
  if (!match) return;

  logger.info("auto-moderation triggered", {
    commentId,
    category: c.category,
    confidence: c.confidence,
    action: match.action,
    rule: match.ruleName,
  });

  await performAction(commentId, match.action, { performedBy: `auto:${match.ruleName}` });
}
