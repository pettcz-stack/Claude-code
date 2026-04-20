import { Router } from "express";
import { prisma } from "../db";

export const statsRouter: Router = Router();

statsRouter.get("/overview", async (req, res) => {
  const days = Math.min(90, Number((req.query.days as string) ?? "7") || 7);
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);

  // Prisma + SQLite stores DateTime as integer (unix epoch ms). Raw SQL
  // date functions are tricky across SQLite/Postgres, so we aggregate in JS.
  const [
    totalComments,
    byCategory,
    totalActions,
    byAction,
    negativeComments,
    actionedComments,
    commentsForDaily,
  ] = await Promise.all([
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
    prisma.comment.findMany({
      where: {
        fetchedAt: { gte: since },
        authorName: { not: null },
        classifications: { some: { category: { in: ["vulgarity", "brand_attack", "spam"] } } },
      },
      select: { authorName: true },
    }),
    prisma.action.findMany({
      where: { performedAt: { gte: since } },
      select: {
        performedAt: true,
        comment: { select: { fetchedAt: true } },
      },
    }),
    prisma.comment.findMany({
      where: { fetchedAt: { gte: since } },
      select: { fetchedAt: true },
    }),
  ]);

  const authorCounts = new Map<string, number>();
  for (const c of negativeComments) {
    if (!c.authorName) continue;
    authorCounts.set(c.authorName, (authorCounts.get(c.authorName) ?? 0) + 1);
  }
  const topNegativeAuthors = Array.from(authorCounts.entries())
    .map(([authorName, count]) => ({ authorName, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const deltas = actionedComments.map((a) =>
    Math.max(0, (a.performedAt.getTime() - a.comment.fetchedAt.getTime()) / 1000)
  );
  const avgResponseSec = deltas.length > 0 ? deltas.reduce((s, v) => s + v, 0) / deltas.length : 0;

  const perDayMap = new Map<string, number>();
  for (const c of commentsForDaily) {
    const day = c.fetchedAt.toISOString().slice(0, 10);
    perDayMap.set(day, (perDayMap.get(day) ?? 0) + 1);
  }
  const perDay = Array.from(perDayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day, count }));

  res.json({
    windowDays: days,
    totalComments,
    totalActions,
    byCategory: byCategory.map((b) => ({ category: b.category, count: b._count })),
    byAction: byAction.map((b) => ({ actionType: b.actionType, count: b._count })),
    topNegativeAuthors,
    perDay,
    avgResponseSeconds: Math.round(avgResponseSec),
  });
});
