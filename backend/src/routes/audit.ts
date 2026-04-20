import { Router } from "express";
import { prisma } from "../db";

export const auditRouter: Router = Router();

auditRouter.get("/", async (req, res) => {
  const { entityType, entityId, from, to, limit = "200", offset = "0" } = req.query as Record<
    string,
    string | undefined
  >;

  const where: Record<string, unknown> = {};
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const items = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(1000, Number(limit) || 200),
    skip: Number(offset) || 0,
  });
  res.json({ items });
});

auditRouter.get("/actions", async (req, res) => {
  const { from, to, performedBy, limit = "200", offset = "0" } = req.query as Record<
    string,
    string | undefined
  >;

  const where: Record<string, unknown> = {};
  if (performedBy) where.performedBy = performedBy;
  if (from || to) {
    where.performedAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const items = await prisma.action.findMany({
    where,
    include: {
      comment: { include: { post: { include: { account: true } } } },
    },
    orderBy: { performedAt: "desc" },
    take: Math.min(1000, Number(limit) || 200),
    skip: Number(offset) || 0,
  });

  res.json({ items });
});

auditRouter.get("/evidence", async (req, res) => {
  const { category, from, to } = req.query as Record<string, string | undefined>;
  const where: Record<string, unknown> = {};
  if (category) where.category = category;
  if (from || to) {
    where.capturedAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }
  const items = await prisma.evidence.findMany({
    where,
    orderBy: { capturedAt: "desc" },
    take: 500,
    select: {
      id: true,
      commentId: true,
      category: true,
      capturedAt: true,
      contentHash: true,
      permalinkAtCapture: true,
    },
  });
  res.json({ items });
});

auditRouter.get("/evidence/:id", async (req, res) => {
  const ev = await prisma.evidence.findUnique({ where: { id: req.params.id } });
  if (!ev) return res.status(404).json({ error: "not_found" });
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader(
    "content-disposition",
    `attachment; filename="evidence-${ev.id}.json"`
  );
  const body = {
    id: ev.id,
    commentId: ev.commentId,
    category: ev.category,
    capturedAt: ev.capturedAt.toISOString(),
    contentHash: ev.contentHash,
    snapshot: JSON.parse(ev.snapshotJson),
  };
  return res.send(JSON.stringify(body, null, 2));
});

auditRouter.get("/export.csv", async (req, res) => {
  const { from, to } = req.query as Record<string, string | undefined>;
  const where: Record<string, unknown> = {};
  if (from || to) {
    where.performedAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const rows = await prisma.action.findMany({
    where,
    include: {
      comment: { include: { post: { include: { account: true } } } },
    },
    orderBy: { performedAt: "desc" },
  });

  const header = [
    "performed_at",
    "action_type",
    "performed_by",
    "success",
    "error",
    "comment_id_platform",
    "platform",
    "page_name",
    "author_name",
    "author_id",
    "text",
    "post_permalink",
  ];

  const csvEscape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/\r?\n/g, " ").replace(/"/g, '""');
    return `"${s}"`;
  };

  const lines = [header.join(";")];
  for (const r of rows) {
    lines.push(
      [
        r.performedAt.toISOString(),
        r.actionType,
        r.performedBy,
        r.success ? "1" : "0",
        r.errorMessage ?? "",
        r.comment.platformCommentId,
        r.comment.post.account.platform,
        r.comment.post.account.pageName,
        r.comment.authorName ?? "",
        r.comment.authorId ?? "",
        r.comment.text,
        r.comment.post.permalink ?? "",
      ]
        .map(csvEscape)
        .join(";")
    );
  }

  // BOM for Excel compatibility.
  const body = "\uFEFF" + lines.join("\r\n");
  res.setHeader("content-type", "text/csv; charset=utf-8");
  res.setHeader(
    "content-disposition",
    `attachment; filename="audit-actions-${new Date().toISOString().slice(0, 10)}.csv"`
  );
  res.send(body);
});
