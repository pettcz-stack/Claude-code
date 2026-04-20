import { prisma } from "../db";
import { classify, isLowConfidence } from "./claude";
import { logger } from "../utils/logger";
import { audit } from "../services/audit";
import { notify } from "../services/notify";
import { captureEvidence } from "../services/evidence";
import { runAutoModeration } from "../moderation/auto-moderator";

export async function classifyNewComments(limit = 50): Promise<number> {
  const pending = await prisma.comment.findMany({
    where: { status: "new" },
    include: { post: { include: { account: true } } },
    take: limit,
    orderBy: { fetchedAt: "asc" },
  });

  let done = 0;
  for (const c of pending) {
    try {
      let result = await classify({
        commentText: c.text,
        postPreview: c.post.contentPreview,
        authorName: c.authorName,
        platform: c.post.account.platform,
      });

      // Escalate to smart model if low confidence and not trivial positive/neutral.
      if (isLowConfidence(result)) {
        try {
          const smart = await classify(
            {
              commentText: c.text,
              postPreview: c.post.contentPreview,
              authorName: c.authorName,
              platform: c.post.account.platform,
            },
            { smart: true }
          );
          result = smart;
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
        await tx.comment.update({
          where: { id: c.id },
          data: { status: "classified" },
        });
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

      // Capture legal evidence snapshot for brand_attack / vulgarity —
      // preserves the state at detection time even after the comment is
      // deleted from Meta's side.
      await captureEvidence(c.id, result.category).catch((err) =>
        logger.warn("evidence capture failed", { commentId: c.id, err: String(err) })
      );

      // Notify operators for anything that needs human review.
      if (result.category === "brand_attack" || result.recommended_action === "review") {
        const severity = result.category === "brand_attack" ? "critical" : "warn";
        await notify({
          severity,
          title:
            result.category === "brand_attack"
              ? "Detekován možný útok na značku"
              : `Komentář vyžaduje review (${result.category})`,
          text: [
            `Platforma: ${c.post.account.platform} — ${c.post.account.pageName}`,
            c.authorName ? `Autor: ${c.authorName}` : null,
            `Komentář: "${c.text.slice(0, 500)}"`,
            `Confidence: ${Math.round(result.confidence * 100)}%`,
            `AI zdůvodnění: ${result.reasoning}`,
          ]
            .filter(Boolean)
            .join("\n"),
          url: c.post.permalink ?? undefined,
        }).catch((err) => logger.warn("notify failed", { commentId: c.id, err: String(err) }));
      }

      // Trigger auto-moderation if rules match.
      await runAutoModeration(c.id).catch((err) =>
        logger.warn("auto-moderation failed", { commentId: c.id, err: String(err) })
      );

      done++;
    } catch (err) {
      logger.error("classification failed", { commentId: c.id, err: String(err) });
    }
  }
  return done;
}
