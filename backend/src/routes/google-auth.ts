import { Router } from "express";
import crypto from "node:crypto";
import { config } from "../config";
import { buildAuthUrl, exchangeCodeForTokens } from "../google/oauth";
import { google } from "../google/api-client";
import { encrypt } from "../crypto";
import { prisma } from "../db";
import { audit } from "../services/audit";
import { logger } from "../utils/logger";

export const googleAuthRouter: Router = Router();

const pendingStates = new Set<string>();

googleAuthRouter.get("/start", (_req, res) => {
  if (!config.google.clientId || !config.google.clientSecret) {
    return res.status(500).json({
      error: "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set before Google OAuth can run",
    });
  }
  const state = crypto.randomBytes(16).toString("hex");
  pendingStates.add(state);
  setTimeout(() => pendingStates.delete(state), 10 * 60 * 1000);
  return res.redirect(buildAuthUrl(state));
});

googleAuthRouter.get("/callback", async (req, res) => {
  const { code, state, error } = req.query as { code?: string; state?: string; error?: string };
  if (error) return res.status(400).json({ error });
  if (!code || !state || !pendingStates.has(state)) {
    return res.status(400).json({ error: "invalid code or state" });
  }
  pendingStates.delete(state);

  try {
    const tokens = await exchangeCodeForTokens(code);
    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000);

    // List all accounts the user has access to, then every location under each.
    // Each (account, location) pair becomes one Account row in our DB so we
    // can show them separately in the Accounts page and fetch their reviews
    // independently.
    const accounts = await google.listAccounts(tokens.access_token);
    if (accounts.length === 0) {
      return res
        .status(400)
        .send("Google účet nemá žádné Business Profile accounts — nepropojujeme nic.");
    }

    const results: Array<{ pageName: string; pageId: string; locationName: string }> = [];
    for (const gAcc of accounts) {
      const locations = await google.listLocations(gAcc.name, tokens.access_token);
      for (const loc of locations) {
        // Use the full resource name as pageId (unique) and the title as pageName.
        const pageId = loc.name; // "accounts/X/locations/Y"
        const record = await prisma.account.upsert({
          where: { pageId },
          create: {
            source: "GOOGLE",
            platform: "GOOGLE",
            pageId,
            pageName: loc.title,
            accessTokenEncrypted: encrypt(tokens.access_token),
            refreshTokenEncrypted: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
            tokenExpiresAt: expiresAt,
            externalAccountId: gAcc.name,
            externalLocationId: loc.name,
            active: true,
          },
          update: {
            pageName: loc.title,
            accessTokenEncrypted: encrypt(tokens.access_token),
            refreshTokenEncrypted: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
            tokenExpiresAt: expiresAt,
            externalAccountId: gAcc.name,
            externalLocationId: loc.name,
            active: true,
          },
        });
        results.push({ pageName: loc.title, pageId, locationName: loc.name });
        await audit({
          entityType: "Account",
          entityId: record.id,
          event: "oauth.linked",
          metadata: { source: "GOOGLE", location: loc.name, accountName: gAcc.accountName },
        });
      }
    }

    if (results.length === 0) {
      return res
        .status(400)
        .send("Google účet nemá přiřazené žádné provozovny (locations). Zkontroluj Business Profile.");
    }

    return res.status(200).send(
      `<!doctype html><meta charset="utf-8"><title>Google propojeno</title>
       <body style="font-family: system-ui; padding: 2rem;">
         <h1>Propojeno s Google Business Profile</h1>
         <p>Dashboard začne stahovat recenze během následujícího poll intervalu.</p>
         <pre>${JSON.stringify(results, null, 2)}</pre>
         <p>Můžeš okno zavřít a vrátit se do Viktora čističe.</p>
       </body>`
    );
  } catch (err) {
    logger.error("google oauth callback failed", { err: String(err) });
    return res.status(500).json({ error: "oauth_failed", detail: String(err) });
  }
});
