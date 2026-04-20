import { prisma } from "../db";
import { logger } from "../utils/logger";
import { audit } from "../services/audit";

// Retention defaults: keep full comment text for 2 years (legal evidence
// window), then anonymize author identifiers while preserving audit trail.
const DEFAULT_RETENTION_DAYS = 730;

export async function runRetention(retentionDays = DEFAULT_RETENTION_DAYS): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 3600 * 1000);

  const candidates = await prisma.comment.findMany({
    where: {
      fetchedAt: { lt: cutoff },
      authorName: { not: null },
    },
    select: { id: true },
    take: 1000,
  });

  if (candidates.length === 0) return 0;

  const ids = candidates.map((c) => c.id);
  const result = await prisma.comment.updateMany({
    where: { id: { in: ids } },
    data: {
      authorName: null,
      authorId: null,
      text: "[redacted — retention policy]",
    },
  });

  await audit({
    entityType: "RetentionJob",
    entityId: "comments",
    event: "retention.anonymized",
    metadata: { count: result.count, retentionDays, cutoff: cutoff.toISOString() },
  });

  logger.info("retention: anonymized comments", { count: result.count, retentionDays });
  return result.count;
}
