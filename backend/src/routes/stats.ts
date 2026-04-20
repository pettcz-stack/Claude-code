import { Router } from "express";
import { prisma } from "../db";

export const statsRouter: Router = Router();

statsRouter.get("/overview", async (req, res) => {
  const days = Math.min(90, Number((req.query.days as string) ?? "7") || 7);
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);

  const [totalComments, byCategory, totalActions, byAction, topAuthors, responseTimes] = await Promise.all([
    prisma.comment.count({ where: { fetchedAt: { gte: since } } }),
    prisma.classification.groupBy({
      by: ["category"],
      _count: true,
      where: { classifiedAt: { gte: since } },
    }),
    prisma.action.count({ where: { performedAt: { gte: since } } }),
    prisma.action.groupBy({
      by: ["actionType"],
      _count: true,
      where: { performedAt: { gte: since } },
    }),
    prisma.$queryRawUnsafe<Array<{ authorName: string; count: bigint }>>(
      `
      SELECT c.authorName as authorName, COUNT(*) as count
      FROM "Comment" c
      JOIN "Classification" cl ON cl.commentId = c.id
      WHERE cl.category IN ('vulgarity', 'brand_attack', 'spam')
        AND c.fetchedAt >= ?
        AND c.authorName IS NOT NULL
      GROUP BY c.authorName
      ORDER BY count DESC
      LIMIT 10
      `,
      since
    ),
    prisma.$queryRawUnsafe<Array<{ seconds: number }>>(
      `
      SELECT (julianday(a.performedAt) - julianday(c.fetchedAt)) * 86400 AS seconds
      FROM "Action" a
      JOIN "Comment" c ON c.id = a.commentId
      WHERE a.performedAt >= ?
      `,
      since
    ),
  ]);

  const avgResponseSec =
    responseTimes.length > 0
      ? responseTimes.reduce((s, r) => s + (r.seconds ?? 0), 0) / responseTimes.length
      : 0;

  const perDay = await prisma.$queryRawUnsafe<Array<{ day: string; count: bigint }>>(
    `
    SELECT substr(datetime(fetchedAt), 1, 10) AS day, COUNT(*) AS count
    FROM "Comment"
    WHERE fetchedAt >= ?
    GROUP BY day
    ORDER BY day ASC
    `,
    since
  );

  res.json({
    windowDays: days,
    totalComments,
    totalActions,
    byCategory: byCategory.map((b) => ({ category: b.category, count: b._count })),
    byAction: byAction.map((b) => ({ actionType: b.actionType, count: b._count })),
    topNegativeAuthors: topAuthors.map((t) => ({
      authorName: t.authorName,
      count: Number(t.count),
    })),
    perDay: perDay.map((p) => ({ day: p.day, count: Number(p.count) })),
    avgResponseSeconds: Math.round(avgResponseSec),
  });
});
