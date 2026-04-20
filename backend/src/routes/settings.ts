import { Router } from "express";
import { z } from "zod";
import {
  isReplyEnabled,
  setReplyEnabled,
  getUsageAlertThreshold,
  setUsageAlertThreshold,
  getCriticalKeywords,
  setCriticalKeywords,
} from "../services/feature-flags";
import { audit } from "../services/audit";
import { currentUser } from "../middleware/auth";

export const settingsRouter: Router = Router();

settingsRouter.get("/", async (_req, res) => {
  const [replyEnabled, threshold, keywords] = await Promise.all([
    isReplyEnabled(),
    getUsageAlertThreshold(),
    getCriticalKeywords(),
  ]);
  res.json({ replyEnabled, usageAlertUsd: threshold, criticalKeywords: keywords });
});

const ReplyBody = z.object({ enabled: z.boolean() });

settingsRouter.post("/reply", async (req, res) => {
  const parsed = ReplyBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  await setReplyEnabled(parsed.data.enabled);
  await audit({
    entityType: "Setting",
    entityId: "reply_enabled",
    event: parsed.data.enabled ? "reply.enabled" : "reply.disabled",
    metadata: { by: currentUser(req) },
  });
  res.json({ enabled: parsed.data.enabled });
});

const ThresholdBody = z.object({ usd: z.number().nullable() });

settingsRouter.post("/usage-alert", async (req, res) => {
  const parsed = ThresholdBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  await setUsageAlertThreshold(parsed.data.usd);
  await audit({
    entityType: "Setting",
    entityId: "usage_alert_usd",
    event: "usage_alert.updated",
    metadata: { by: currentUser(req), usd: parsed.data.usd },
  });
  res.json({ usageAlertUsd: parsed.data.usd });
});

const KeywordsBody = z.object({ keywords: z.array(z.string()).max(100) });

settingsRouter.post("/critical-keywords", async (req, res) => {
  const parsed = KeywordsBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  await setCriticalKeywords(parsed.data.keywords);
  const saved = await getCriticalKeywords();
  await audit({
    entityType: "Setting",
    entityId: "critical_keywords",
    event: "critical_keywords.updated",
    metadata: { by: currentUser(req), count: saved.length },
  });
  res.json({ criticalKeywords: saved });
});
