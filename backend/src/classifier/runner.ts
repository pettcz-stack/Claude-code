import { prisma } from "../db";
import { classify, isLowConfidence } from "./claude";
import { logger } from "../utils/logger";
import { audit } from "../services/audit";
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
