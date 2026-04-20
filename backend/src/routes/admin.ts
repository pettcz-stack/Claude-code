import { Router } from "express";
import { prisma } from "../db";
import { runRetention } from "../jobs/retention";
import { checkTokenExpiry } from "../jobs/token-monitor";
import { notify } from "../services/notify";
import { audit } from "../services/audit";
import { currentUser } from "../middleware/auth";
import { fetchAllAccounts } from "../meta/fetcher";
import { classifyNewComments } from "../classifier/runner";

export const adminRouter: Router = Router();

adminRouter.get("/status", async (_req, res) => {
  const [accounts, pending, actions24h] = await Promise.all([
    prisma.account.count({ where: { active: true } }),
    prisma.comment.count({ where: { status: { in: ["new", "classified"] } } }),
    prisma.action.count({ where: { performedAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } } }),
  ]);
  res.json({ activeAccounts: accounts, pending, actions24h });
});

adminRouter.post("/retention/run", async (req, res) => {
  const days = Number((req.body as { days?: number }).days ?? 730);
  const count = await runRetention(days);
  await audit({
    entityType: "RetentionJob",
    entityId: "manual",
    event: "retention.manual",
    metadata: { by: currentUser(req), retentionDays: days, count },
  });
  res.json({ anonymized: count, retentionDays: days });
});

adminRouter.post("/tokens/check", async (_req, res) => {
  await checkTokenExpiry();
  res.json({ ok: true });
});

adminRouter.post("/test-notification", async (req, res) => {
  await notify({
    severity: "info",
    title: "Test notifikace",
    text: `Testovací zpráva od ${currentUser(req)} — integrace funguje.`,
  });
  res.json({ ok: true });
});

adminRouter.post("/poll/run", async (_req, res) => {
  const fetched = await fetchAllAccounts();
  const classified = await classifyNewComments(100);
  res.json({ fetched, classified });
});

adminRouter.post("/reclassify/bulk", async (req, res) => {
  const { hours, limit = 500 } = req.body as { hours?: number; limit?: number };
  const since = hours ? new Date(Date.now() - hours * 3600 * 1000) : null;

  const comments = await prisma.comment.findMany({
    where: {
      status: { in: ["classified", "actioned"] },
      ...(since ? { fetchedAt: { gte: since } } : {}),
    },
    include: { post: { include: { account: true } } },
    take: Math.min(2000, Math.max(1, Number(limit) || 500)),
    orderBy: { fetchedAt: "desc" },
  });

  const { classify } = await import("../classifier/claude");

  let done = 0;
  let failed = 0;
  for (const c of comments) {
    try {
      const r = await classify(
        {
          commentText: c.text,
          postPreview: c.post.contentPreview,
          authorName: c.authorName,
          platform: c.post.account.platform,
        },
        { smart: false }
      );
      await prisma.classification.create({
        data: {
          commentId: c.id,
          category: r.category,
          confidence: r.confidence,
          reasoning: r.reasoning,
          recommendedAction: r.recommended_action,
          detectedLanguage: r.detected_language,
          modelUsed: r.model,
        },
      });
      done++;
    } catch {
      failed++;
    }
  }
  res.json({ attempted: comments.length, done, failed });
});
