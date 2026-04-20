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
