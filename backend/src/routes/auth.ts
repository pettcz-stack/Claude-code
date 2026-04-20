import { Router } from "express";
import crypto from "node:crypto";
import { config } from "../config";
import { buildAuthUrl } from "../meta/oauth";
import { graph } from "../meta/graph-client";
import { encrypt } from "../crypto";
import { prisma } from "../db";
import { audit } from "../services/audit";
import { logger } from "../utils/logger";

export const authRouter: Router = Router();

const pendingStates = new Set<string>();

authRouter.get("/start", (_req, res) => {
  if (!config.meta.appId || !config.meta.appSecret) {
    return res.status(500).json({
      error: "META_APP_ID and META_APP_SECRET must be set before OAuth can run",
    });
  }
  const state = crypto.randomBytes(16).toString("hex");
  pendingStates.add(state);
  setTimeout(() => pendingStates.delete(state), 10 * 60 * 1000);
  return res.redirect(buildAuthUrl(state));
});

authRouter.get("/callback", async (req, res) => {
  const { code, state } = req.query as { code?: string; state?: string };
  if (!code || !state || !pendingStates.has(state)) {
    return res.status(400).json({ error: "invalid code or state" });
  }
  pendingStates.delete(state);

  try {
    const shortLived = await graph.exchangeCodeForToken(code);
    const longLived = await graph.exchangeForLongLived(shortLived.access_token);
    const pages = await graph.listPages(longLived.access_token);

    const results: Array<{ platform: string; pageId: string; pageName: string; created: boolean }> = [];

    for (const page of pages) {
      const fbExpires = longLived.expires_in ? new Date(Date.now() + longLived.expires_in * 1000) : null;
      const fb = await prisma.account.upsert({
        where: { pageId: page.id },
        create: {
          platform: "FB",
          pageId: page.id,
          pageName: page.name,
          accessTokenEncrypted: encrypt(page.access_token),
          tokenExpiresAt: fbExpires,
          active: true,
        },
        update: {
          pageName: page.name,
          accessTokenEncrypted: encrypt(page.access_token),
          tokenExpiresAt: fbExpires,
          active: true,
        },
      });
      results.push({ platform: "FB", pageId: page.id, pageName: page.name, created: fb.createdAt.getTime() === fb.updatedAt.getTime() });
      await audit({ entityType: "Account", entityId: fb.id, event: "oauth.linked", metadata: { platform: "FB" } });

      if (page.instagram_business_account?.id) {
        const ig = await prisma.account.upsert({
          where: { pageId: page.instagram_business_account.id },
          create: {
            platform: "IG",
            pageId: page.instagram_business_account.id,
            pageName: `${page.name} (IG)`,
            accessTokenEncrypted: encrypt(page.access_token),
            tokenExpiresAt: fbExpires,
            active: true,
          },
          update: {
            pageName: `${page.name} (IG)`,
            accessTokenEncrypted: encrypt(page.access_token),
            tokenExpiresAt: fbExpires,
            active: true,
          },
        });
        results.push({ platform: "IG", pageId: ig.pageId, pageName: ig.pageName, created: ig.createdAt.getTime() === ig.updatedAt.getTime() });
        await audit({ entityType: "Account", entityId: ig.id, event: "oauth.linked", metadata: { platform: "IG" } });
      }
    }

    return res.status(200).send(
      `<!doctype html><meta charset="utf-8"><title>Připojeno</title>
       <body style="font-family: system-ui; padding: 2rem;">
         <h1>Účty propojeny</h1>
         <pre>${JSON.stringify(results, null, 2)}</pre>
         <p>Můžeš okno zavřít a vrátit se do dashboardu.</p>
       </body>`
    );
  } catch (err) {
    logger.error("oauth callback failed", { err: String(err) });
    return res.status(500).json({ error: "oauth_failed", detail: String(err) });
  }
});
