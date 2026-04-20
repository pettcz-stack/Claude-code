import { prisma } from "../db";
import { decrypt } from "../crypto";
import { graph, GraphApiError } from "../meta/graph-client";
import { audit } from "../services/audit";
import { logger } from "../utils/logger";
import { isReplyEnabled } from "../services/feature-flags";

export type ActionType = "hide" | "delete" | "keep" | "reply" | "unhide";

export interface ActionOptions {
  performedBy: string;
  replyMessage?: string;
}

export async function performAction(
  commentId: string,
  action: ActionType,
  opts: ActionOptions
): Promise<{ success: boolean; error?: string }> {
  const comment = await prisma.comment.findUniqueOrThrow({
    where: { id: commentId },
    include: { post: { include: { account: true } } },
  });

  // "keep" is a no-op on Meta side; we just record the decision.
  if (action === "keep") {
    await prisma.action.create({
      data: {
        commentId,
        actionType: action,
        performedBy: opts.performedBy,
        success: true,
      },
    });
    await prisma.comment.update({ where: { id: commentId }, data: { status: "actioned" } });
    await audit({
      entityType: "Comment",
      entityId: commentId,
      event: "action.keep",
      metadata: { performedBy: opts.performedBy },
    });
    return { success: true };
  }

  // Reply is a write action that publishes on a public profile — protected
  // by a runtime kill switch. If disabled, refuse hard (no silent fallback).
  if (action === "reply") {
    if (!(await isReplyEnabled())) {
      const err = "Odpovědi jsou vypnuté (kill switch). Zapni v Admin → Odpovědi.";
      await prisma.action.create({
        data: {
          commentId,
          actionType: action,
          performedBy: opts.performedBy,
          success: false,
          errorMessage: err,
        },
      });
      await audit({
        entityType: "Comment",
        entityId: commentId,
        event: "action.reply.blocked",
        metadata: { reason: "kill_switch", by: opts.performedBy },
      });
      return { success: false, error: err };
    }
  }

  const token = decrypt(comment.post.account.accessTokenEncrypted);
  let apiResponse: unknown = null;
  let success = false;
  let errorMessage: string | undefined;

  try {
    const cid = comment.platformCommentId;
    switch (action) {
      case "hide":
        apiResponse = await graph.hideComment(cid, token);
        success = true;
        break;
      case "unhide":
        apiResponse = await graph.unhideComment(cid, token);
        success = true;
        break;
      case "delete":
        apiResponse = await graph.deleteComment(cid, token);
        success = true;
        break;
      case "reply":
        if (!opts.replyMessage) throw new Error("replyMessage required for reply action");
        apiResponse = await graph.replyToComment(cid, opts.replyMessage, token);
        success = true;
        break;
    }
  } catch (err) {
    const gErr = err as GraphApiError;
    errorMessage = gErr.message ?? String(err);
    logger.warn("graph action failed", { commentId, action, error: errorMessage, payload: gErr.payload });
    success = false;
  }

  await prisma.action.create({
    data: {
      commentId,
      actionType: action,
      performedBy: opts.performedBy,
      apiResponse: apiResponse ? JSON.stringify(apiResponse) : null,
      success,
      errorMessage: errorMessage ?? null,
    },
  });

  if (success) {
    await prisma.comment.update({
      where: { id: commentId },
      data: { status: "actioned" },
    });
  }

  await audit({
    entityType: "Comment",
    entityId: commentId,
    event: `action.${action}.${success ? "ok" : "fail"}`,
    metadata: { performedBy: opts.performedBy, error: errorMessage },
  });

  return { success, error: errorMessage };
}
