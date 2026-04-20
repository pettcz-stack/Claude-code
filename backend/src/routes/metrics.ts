import { Router } from "express";
import { prisma } from "../db";

export const metricsRouter: Router = Router();

function escape(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
}

function line(metric: string, labels: Record<string, string | number>, value: number): string {
  const l = Object.entries(labels)
    .map(([k, v]) => `${k}="${escape(String(v))}"`)
    .join(",");
  return `${metric}{${l}} ${value}`;
}

metricsRouter.get("/", async (_req, res) => {
  const [byCategory, byAction, byStatus, pending, accountsActive, evidenceCount, lastAction] = await Promise.all([
    prisma.classification.groupBy({ by: ["category"], _count: true }),
    prisma.action.groupBy({ by: ["actionType", "success"], _count: true }),
    prisma.comment.groupBy({ by: ["status"], _count: true }),
    prisma.comment.count({ where: { status: { in: ["new", "classified"] } } }),
    prisma.account.count({ where: { active: true } }),
    prisma.evidence.count(),
    prisma.action.findFirst({ orderBy: { performedAt: "desc" }, select: { performedAt: true } }),
  ]);

  const now = Date.now();
  const lastActionAgeSec = lastAction ? Math.round((now - lastAction.performedAt.getTime()) / 1000) : -1;

  const lines: string[] = [
    "# HELP albixon_classifications_total Count of classifications by category",
    "# TYPE albixon_classifications_total counter",
    ...byCategory.map((b) => line("albixon_classifications_total", { category: b.category }, b._count)),

    "# HELP albixon_actions_total Count of moderation actions by type and success",
    "# TYPE albixon_actions_total counter",
    ...byAction.map((b) =>
      line("albixon_actions_total", { action: b.actionType, success: String(b.success) }, b._count)
    ),

    "# HELP albixon_comments_by_status Comments by status",
    "# TYPE albixon_comments_by_status gauge",
    ...byStatus.map((b) => line("albixon_comments_by_status", { status: b.status }, b._count)),

    "# HELP albixon_queue_pending Comments waiting for moderation",
    "# TYPE albixon_queue_pending gauge",
    `albixon_queue_pending ${pending}`,

    "# HELP albixon_accounts_active Number of active accounts",
    "# TYPE albixon_accounts_active gauge",
    `albixon_accounts_active ${accountsActive}`,

    "# HELP albixon_evidence_total Total number of legal evidence snapshots",
    "# TYPE albixon_evidence_total counter",
    `albixon_evidence_total ${evidenceCount}`,

    "# HELP albixon_last_action_age_seconds Seconds since the most recent moderation action",
    "# TYPE albixon_last_action_age_seconds gauge",
    `albixon_last_action_age_seconds ${lastActionAgeSec}`,
  ];

  res.setHeader("content-type", "text/plain; version=0.0.4; charset=utf-8");
  res.send(lines.join("\n") + "\n");
});
