import { prisma } from "../db";
import { classify, isLowConfidence } from "./claude";
import { logger } from "../utils/logger";
import { audit } from "../services/audit";
import { notify } from "../services/notify";
import { captureEvidence } from "../services/evidence";
import { getCriticalKeywords } from "../services/feature-flags";
import { runAutoModeration } from "../moderation/auto-moderator";

type PendingComment = Awaited<ReturnType<typeof loadPending>>[number];

async function loadPending(limit: number) {
  return prisma.comment.findMany({
    where: { status: "new" },
    include: { post: { include: { account: true } } },
    take: limit,
    orderBy: { fetchedAt: "asc" },
  });
}

/**
 * Classify all "new" comments. Runs workers in parallel (default 4) so a
 * burst of 20 webhook-delivered comments clears in ~5 API calls worth of
 * wall-clock time instead of serial 20. Each failure is isolated to one
 * comment so a partial Claude outage doesn't stop the batch.
 */
export async function classifyNewComments(limit = 50, concurrency = 4): Promise<number> {
  const pending = await loadPending(limit);
  if (pending.length === 0) return 0;

  // Cache keywords once per batch instead of per comment.
  const keywords = await getCriticalKeywords();

  const queue: PendingComment[] = [...pending];
  let done = 0;

  const worker = async (): Promise<void> => {
    while (queue.length > 0) {
      const c = queue.shift();
      if (!c) return;
      try {
        await classifyOne(c, keywords);
        done++;
      } catch (err) {
        logger.error("classification failed", { commentId: c.id, err: String(err) });
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, worker));
  return done;
}

async function classifyOne(c: PendingComment, keywords: string[]): Promise<void> {
  let result = await classify({
    commentText: c.text,
    postPreview: c.post.contentPreview,
    authorName: c.authorName,
    platform: c.post.account.platform,
  });

  // Escalate to smart model only when haiku is genuinely uncertain.
  if (isLowConfidence(result)) {
    try {
      result = await classify(
        {
          commentText: c.text,
          postPreview: c.post.contentPreview,
          authorName: c.authorName,
          platform: c.post.account.platform,
        },
        { smart: true }
      );
    } catch (err) {
      logger.warn("smart escalation failed", { commentId: c.id, err: String(err) });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.classification.create({
      data: {
        commentId: c.id,
        category: result.category,
        confidence: result.confidence,
        reasoning: result.reasoning,
        recommendedAction: result.recommended_action,
        detectedLanguage: result.detected_language,
        modelUsed: result.model,
      },
    });
    await tx.comment.update({ where: { id: c.id }, data: { status: "classified" } });
  });

  await audit({
    entityType: "Comment",
    entityId: c.id,
    event: "classified",
    metadata: {
      category: result.category,
      confidence: result.confidence,
      recommended_action: result.recommended_action,
      model: result.model,
    },
  });

  // Evidence snapshot for brand_attack / vulgarity.
  captureEvidence(c.id, result.category).catch((err) =>
    logger.warn("evidence capture failed", { commentId: c.id, err: String(err) })
  );

  // Critical keyword match (operator-configured, independent of AI category).
  const matchedKeyword = keywords.find((kw) => c.text.toLowerCase().includes(kw.toLowerCase()));

  if (
    result.category === "brand_attack" ||
    result.recommended_action === "review" ||
    matchedKeyword
  ) {
    const isCritical = result.category === "brand_attack" || Boolean(matchedKeyword);
    const severity = isCritical ? "critical" : "warn";
    notify({
      severity,
      title: matchedKeyword
        ? `Kritický komentář — obsahuje "${matchedKeyword}"`
        : result.category === "brand_attack"
          ? "Detekován možný útok na značku"
          : `Komentář vyžaduje review (${result.category})`,
      text: [
        `Platforma: ${c.post.account.platform} — ${c.post.account.pageName}`,
        c.authorName ? `Autor: ${c.authorName}` : null,
        `Komentář: "${c.text.slice(0, 500)}"`,
        `AI kategorie: ${result.category} (${Math.round(result.confidence * 100)}%)`,
        `AI zdůvodnění: ${result.reasoning}`,
        matchedKeyword ? `Match: kritické klíčové slovo "${matchedKeyword}"` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      url: c.post.permalink ?? undefined,
    }).catch((err) => logger.warn("notify failed", { commentId: c.id, err: String(err) }));
  }

  // Trigger auto-moderation (rules enforce brand_attack / legitimate_criticism safety).
  runAutoModeration(c.id).catch((err) =>
    logger.warn("auto-moderation failed", { commentId: c.id, err: String(err) })
  );
}
