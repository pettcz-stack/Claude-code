import crypto from "node:crypto";
import { prisma } from "../db";
import { logger } from "../utils/logger";

const CAPTURE_CATEGORIES = new Set(["brand_attack", "vulgarity"]);

export async function captureEvidence(commentId: string, category: string): Promise<string | null> {
  if (!CAPTURE_CATEGORIES.has(category)) return null;

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    include: {
      post: { include: { account: { select: { platform: true, pageName: true, pageId: true } } } },
      classifications: { orderBy: { classifiedAt: "desc" }, take: 1 },
    },
  });
  if (!comment) return null;

  const snapshot = {
    version: 1,
    capturedAt: new Date().toISOString(),
    platform: comment.post.account.platform,
    pageName: comment.post.account.pageName,
    pageId: comment.post.account.pageId,
    platformCommentId: comment.platformCommentId,
    authorName: comment.authorName,
    authorId: comment.authorId,
    text: comment.text,
    createdAtPlatform: comment.createdAtPlatform?.toISOString() ?? null,
    post: {
      platformPostId: comment.post.platformPostId,
      permalink: comment.post.permalink,
      contentPreview: comment.post.contentPreview,
    },
    classification: comment.classifications[0]
      ? {
          category: comment.classifications[0].category,
          confidence: comment.classifications[0].confidence,
          reasoning: comment.classifications[0].reasoning,
          recommendedAction: comment.classifications[0].recommendedAction,
          modelUsed: comment.classifications[0].modelUsed,
          classifiedAt: comment.classifications[0].classifiedAt.toISOString(),
        }
      : null,
  };

  const canonical = JSON.stringify(snapshot, Object.keys(snapshot).sort());
  const hash = crypto.createHash("sha256").update(canonical).digest("hex");

  const ev = await prisma.evidence.create({
    data: {
      commentId,
      category,
      contentHash: hash,
      snapshotJson: JSON.stringify(snapshot),
      permalinkAtCapture: comment.post.permalink,
    },
  });

  logger.info("evidence captured", { evidenceId: ev.id, commentId, category, contentHash: hash });
  return ev.id;
}
