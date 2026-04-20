// Subscribe the Meta app to page + instagram comment/feed webhooks.
// Usage: npx tsx src/bin/webhook-subscribe.ts [--dry-run]
//
// Pre-requisites:
// - META_APP_ID, META_APP_SECRET, META_WEBHOOK_VERIFY_TOKEN in .env
// - Webhook callback URL must already be configured in the Meta app dashboard:
//   https://<your-host>/webhooks/meta

import { prisma } from "../db";
import { decrypt } from "../crypto";
import { config } from "../config";
import { logger } from "../utils/logger";

const DRY = process.argv.includes("--dry-run");
const BASE = `https://graph.facebook.com/${config.meta.graphVersion}`;

async function subscribePage(pageId: string, pageAccessToken: string): Promise<void> {
  const url = new URL(`${BASE}/${pageId}/subscribed_apps`);
  url.searchParams.set("subscribed_fields", "feed,comments,mention");
  url.searchParams.set("access_token", pageAccessToken);

  logger.info("subscribe page", { pageId, dryRun: DRY });
  if (DRY) return;

  const res = await fetch(url.toString(), { method: "POST" });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`subscribe failed (${res.status}): ${body}`);
  }
  logger.info("subscribed", { pageId, body });
}

async function main(): Promise<void> {
  const accounts = await prisma.account.findMany({
    where: { active: true, platform: "FB" },
  });

  if (accounts.length === 0) {
    logger.warn("no active FB accounts; link one via /auth/start first");
    return;
  }

  for (const acc of accounts) {
    try {
      await subscribePage(acc.pageId, decrypt(acc.accessTokenEncrypted));
    } catch (err) {
      logger.error("subscribe failed", { pageId: acc.pageId, err: String(err) });
    }
  }

  logger.info("done. Verify in Meta app dashboard → Webhooks → Page subscriptions.");
  await prisma.$disconnect();
}

main().catch((err) => {
  logger.error("fatal", { err: String(err) });
  process.exit(1);
});
