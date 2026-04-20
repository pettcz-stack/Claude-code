import { Router } from "express";
import crypto from "node:crypto";
import { config } from "../config";
import { prisma } from "../db";
import { logger } from "../utils/logger";
import { audit } from "../services/audit";
import { fetchAccount } from "../meta/fetcher";

export const webhooksRouter: Router = Router();

// Meta hub.challenge verification.
webhooksRouter.get("/meta", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === config.meta.webhookVerifyToken) {
    return res.status(200).send(String(challenge ?? ""));
  }
  return res.sendStatus(403);
});

function verifySignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!signatureHeader || !config.meta.appSecret) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", config.meta.appSecret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

webhooksRouter.post("/meta", async (req, res) => {
  const raw = (req as unknown as { rawBody?: Buffer }).rawBody;
  const sig = req.header("x-hub-signature-256");
  if (raw && !verifySignature(raw, sig)) {
    logger.warn("webhook signature mismatch");
    return res.sendStatus(401);
  }

  const body = req.body as {
    object?: string;
    entry?: Array<{
      id: string;
      changes?: Array<{ field: string; value: unknown }>;
    }>;
  };

  await audit({
    entityType: "Webhook",
    entityId: body.object ?? "unknown",
    event: "webhook.received",
    metadata: { entryCount: body.entry?.length ?? 0 },
  });

  const pageIds = new Set<string>();
  for (const entry of body.entry ?? []) pageIds.add(entry.id);

  // Fetch fresh comments for any page referenced in the webhook.
  const accounts = await prisma.account.findMany({ where: { pageId: { in: Array.from(pageIds) }, active: true } });
  for (const acc of accounts) {
    fetchAccount(acc.id).catch((err) =>
      logger.warn("webhook-triggered fetch failed", { accountId: acc.id, err: String(err) })
    );
  }

  return res.sendStatus(200);
});
