import { Router } from "express";
import { prisma } from "../db";
import { performAction, type ActionType } from "../moderation/actions";
import { currentUser } from "../middleware/auth";
import { suggestReply } from "../classifier/reply-suggester";
import { classify, isLowConfidence } from "../classifier/claude";
import { audit } from "../services/audit";
import { isReplyEnabled } from "../services/feature-flags";
import { currentRole } from "../middleware/auth";

export const commentsRouter: Router = Router();

const CATEGORY_PRIORITY: Record<string, number> = {
  brand_attack: 0,
  vulgarity: 1,
  spam: 2,
  legitimate_criticism: 3,
  neutral: 4,
  positive: 5,
};

commentsRouter.get("/", async (req, res) => {
  const {
    status,
    platform,
    category,
    accountId,
    from,
    to,
    q,
    limit = "100",
    offset = "0",
  } = req.query as Record<string, string | undefined>;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (accountId) where.post = { accountId };
  if (platform) where.post = { ...(where.post as object), account: { platform } };
  if (from || to) {
    where.fetchedAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }
  if (q && q.trim().length > 0) {
    const needle = q.trim();
    where.OR = [
      { text: { contains: needle } },
      { authorName: { contains: needle } },
      { authorId: { contains: needle } },
    ];
  }

  const take = Math.min(500, Number(limit) || 100);
  const skip = Number(offset) || 0;

  const items = await prisma.comment.findMany({
    where,
    include: {
      post: { include: { account: true } },
      classifications: { orderBy: { classifiedAt: "desc" }, take: 1 },
      actions: { orderBy: { performedAt: "desc" }, take: 3 },
    },
    orderBy: { fetchedAt: "desc" },
    take,
    skip,
  });

  const filtered = category
    ? items.filter((c) => c.classifications[0]?.category === category)
    : items;

  const sorted = [...filtered].sort((a, b) => {
    const ap = CATEGORY_PRIORITY[a.classifications[0]?.category ?? "neutral"] ?? 10;
    const bp = CATEGORY_PRIORITY[b.classifications[0]?.category ?? "neutral"] ?? 10;
    if (ap !== bp) return ap - bp;
    return b.fetchedAt.getTime() - a.fetchedAt.getTime();
  });

  res.json({
    items: sorted.map((c) => ({
      id: c.id,
      text: c.text,
      authorName: c.authorName,
      authorId: c.authorId,
      status: c.status,
      fetchedAt: c.fetchedAt,
      createdAtPlatform: c.createdAtPlatform,
      post: {
        id: c.post.id,
        platformPostId: c.post.platformPostId,
        permalink: c.post.permalink,
        contentPreview: c.post.contentPreview,
        account: {
          id: c.post.account.id,
          platform: c.post.account.platform,
          pageName: c.post.account.pageName,
        },
      },
      classification: c.classifications[0] ?? null,
      actions: c.actions,
    })),
    total: filtered.length,
  });
});

commentsRouter.get("/export.csv", async (req, res) => {
  const { from, to, category } = req.query as Record<string, string | undefined>;
  const where: Record<string, unknown> = {};
  if (from || to) {
    where.fetchedAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const comments = await prisma.comment.findMany({
    where,
    include: {
      post: { include: { account: true } },
      classifications: { orderBy: { classifiedAt: "desc" }, take: 1 },
      actions: { orderBy: { performedAt: "desc" }, take: 1 },
    },
    orderBy: { fetchedAt: "desc" },
    take: 10000,
  });

  const filtered = category
    ? comments.filter((c) => c.classifications[0]?.category === category)
    : comments;

  const header = [
    "fetched_at",
    "platform",
    "page_name",
    "author_name",
    "author_id",
    "platform_comment_id",
    "text",
    "category",
    "confidence",
    "recommended_action",
    "detected_language",
    "model_used",
    "status",
    "last_action",
    "performed_by",
    "permalink",
  ];

  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/\r?\n/g, " ").replace(/"/g, '""');
    return `"${s}"`;
  };

  const lines = [header.join(";")];
  for (const c of filtered) {
    const cls = c.classifications[0];
    const act = c.actions[0];
    lines.push(
      [
        c.fetchedAt.toISOString(),
        c.post.account.platform,
        c.post.account.pageName,
        c.authorName,
        c.authorId,
        c.platformCommentId,
        c.text,
        cls?.category,
        cls?.confidence,
        cls?.recommendedAction,
        cls?.detectedLanguage,
        cls?.modelUsed,
        c.status,
        act?.actionType,
        act?.performedBy,
        c.post.permalink,
      ]
        .map(esc)
        .join(";")
    );
  }

  res.setHeader("content-type", "text/csv; charset=utf-8");
  res.setHeader(
    "content-disposition",
    `attachment; filename="comments-${new Date().toISOString().slice(0, 10)}.csv"`
  );
  res.send("\uFEFF" + lines.join("\r\n"));
});

commentsRouter.get("/stats/summary", async (_req, res) => {
  const totalPending = await prisma.comment.count({ where: { status: { in: ["new", "classified"] } } });
  const actioned24h = await prisma.action.count({
    where: { performedAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
  });
  const byCategory = await prisma.classification.groupBy({
    by: ["category"],
    _count: true,
    where: {
      classifiedAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) },
    },
  });
  res.json({
    totalPending,
    actioned24h,
    byCategoryLast7d: byCategory.map((b) => ({ category: b.category, count: b._count })),
  });
});

// Moderators can do everything except permanent deletes. Viewer can't POST
// at all (gated at the /api layer above).
const MOD_DISALLOWED = new Set<ActionType>(["delete"]);

commentsRouter.post("/:id/action", async (req, res) => {
  const { id } = req.params;
  const { action, replyMessage } = req.body as { action: ActionType; replyMessage?: string };
  if (!["hide", "delete", "keep", "reply", "unhide"].includes(action)) {
    return res.status(400).json({ error: "invalid action" });
  }
  if (currentRole(req) === "moderator" && MOD_DISALLOWED.has(action)) {
    return res.status(403).json({
      error: "forbidden",
      message: "Role 'moderator' neumí mazat komentáře. Kontaktuj admina, nebo komentář skryj místo smazat.",
    });
  }
  const user = currentUser(req);
  const result = await performAction(id, action, { performedBy: user, replyMessage });
  return res.json(result);
});

commentsRouter.get("/:id", async (req, res) => {
  const c = await prisma.comment.findUnique({
    where: { id: req.params.id },
    include: {
      post: { include: { account: true } },
      classifications: { orderBy: { classifiedAt: "desc" } },
      actions: { orderBy: { performedAt: "desc" } },
    },
  });
  if (!c) return res.status(404).json({ error: "not_found" });
  return res.json(c);
});

commentsRouter.post("/:id/suggest-reply", async (req, res) => {
  if (!(await isReplyEnabled())) {
    return res.status(403).json({
      error: "reply_disabled",
      message: "Odpovědi jsou vypnuté — zapni v Admin → Odpovědi.",
    });
  }
  const { id } = req.params;
  const comment = await prisma.comment.findUniqueOrThrow({
    where: { id },
    include: {
      post: { include: { account: true } },
      classifications: { orderBy: { classifiedAt: "desc" }, take: 1 },
    },
  });
  try {
    const suggestion = await suggestReply({
      commentText: comment.text,
      category: comment.classifications[0]?.category ?? null,
      postPreview: comment.post.contentPreview,
      authorName: comment.authorName,
      platform: comment.post.account.platform,
    });
    res.json({ suggestion });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

commentsRouter.post("/:id/reclassify", async (req, res) => {
  const { id } = req.params;
  const { smart } = req.body as { smart?: boolean };
  const comment = await prisma.comment.findUniqueOrThrow({
    where: { id },
    include: { post: { include: { account: true } } },
  });

  try {
    let result = await classify(
      {
        commentText: comment.text,
        postPreview: comment.post.contentPreview,
        authorName: comment.authorName,
        platform: comment.post.account.platform,
      },
      { smart: smart ?? false }
    );
    if (!smart && isLowConfidence(result)) {
      result = await classify(
        {
          commentText: comment.text,
          postPreview: comment.post.contentPreview,
          authorName: comment.authorName,
          platform: comment.post.account.platform,
        },
        { smart: true }
      );
    }

    const classification = await prisma.classification.create({
      data: {
        commentId: comment.id,
        category: result.category,
        confidence: result.confidence,
        reasoning: result.reasoning,
        recommendedAction: result.recommended_action,
        detectedLanguage: result.detected_language,
        modelUsed: result.model,
      },
    });
    await prisma.comment.update({
      where: { id: comment.id },
      data: { status: "classified" },
    });
    await audit({
      entityType: "Comment",
      entityId: comment.id,
      event: "reclassified",
      metadata: { by: currentUser(req), category: result.category, confidence: result.confidence },
    });

    res.json(classification);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

commentsRouter.post("/bulk-action", async (req, res) => {
  const { ids, action } = req.body as { ids: string[]; action: ActionType };
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "ids required" });
  }
  if (currentRole(req) === "moderator" && MOD_DISALLOWED.has(action)) {
    return res.status(403).json({
      error: "forbidden",
      message: "Role 'moderator' neumí hromadně mazat.",
    });
  }
  const user = currentUser(req);
  const results = [];
  for (const id of ids) {
    try {
      results.push({ id, ...(await performAction(id, action, { performedBy: user })) });
    } catch (err) {
      results.push({ id, success: false, error: String(err) });
    }
  }
  return res.json({ results });
});
