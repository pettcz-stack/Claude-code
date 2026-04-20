import { prisma } from "../db";
import { notify } from "../services/notify";
import { audit } from "../services/audit";
import { logger } from "../utils/logger";

const WARN_DAYS = [14, 7, 3, 1];

export async function checkTokenExpiry(): Promise<void> {
  const accounts = await prisma.account.findMany({
    where: { active: true, tokenExpiresAt: { not: null } },
  });

  const now = Date.now();
  for (const acc of accounts) {
    if (!acc.tokenExpiresAt) continue;
    const days = Math.ceil((acc.tokenExpiresAt.getTime() - now) / (24 * 3600 * 1000));

    if (days <= 0) {
      await notify({
        severity: "critical",
        title: "Meta Page Access Token vypršel",
        text: `Stránka: ${acc.pageName} (${acc.platform}). Projít znovu OAuth flow.`,
      });
      await audit({
        entityType: "Account",
        entityId: acc.id,
        event: "token.expired",
        metadata: { platform: acc.platform, pageName: acc.pageName },
      });
      continue;
    }

    if (WARN_DAYS.includes(days)) {
      await notify({
        severity: days <= 3 ? "critical" : "warn",
        title: `Token pro ${acc.pageName} vyprší za ${days} dní`,
        text: `Platforma: ${acc.platform}. Je třeba projít znovu OAuth (/auth/start v dashboardu).`,
      });
      await audit({
        entityType: "Account",
        entityId: acc.id,
        event: "token.expiring",
        metadata: { daysRemaining: days, platform: acc.platform },
      });
      logger.info("token expiry warning", { accountId: acc.id, days });
    }
  }
}
