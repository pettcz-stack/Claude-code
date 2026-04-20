import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { audit } from "../services/audit";
import { currentUser } from "../middleware/auth";

export const rulesRouter: Router = Router();

const RuleInput = z.object({
  name: z.string().min(1).max(100),
  category: z.enum(["spam", "vulgarity", "brand_attack", "legitimate_criticism", "neutral", "positive"]),
  minConfidence: z.number().min(0).max(1),
  action: z.enum(["hide", "delete"]),
  enabled: z.boolean().optional(),
});

rulesRouter.get("/", async (_req, res) => {
  const rules = await prisma.rule.findMany({ orderBy: { createdAt: "desc" } });
  res.json(rules);
});

rulesRouter.post("/", async (req, res) => {
  const parsed = RuleInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (parsed.data.category === "brand_attack" || parsed.data.category === "legitimate_criticism") {
    return res.status(400).json({
      error: "brand_attack and legitimate_criticism cannot be auto-moderated (safety policy)",
    });
  }

  const rule = await prisma.rule.create({ data: parsed.data });
  await audit({
    entityType: "Rule",
    entityId: rule.id,
    event: "rule.created",
    metadata: { by: currentUser(req), ...parsed.data },
  });
  res.json(rule);
});

rulesRouter.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const parsed = RuleInput.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const rule = await prisma.rule.update({ where: { id }, data: parsed.data });
  await audit({
    entityType: "Rule",
    entityId: id,
    event: "rule.updated",
    metadata: { by: currentUser(req), patch: parsed.data },
  });
  res.json(rule);
});

rulesRouter.delete("/:id", async (req, res) => {
  const { id } = req.params;
  await prisma.rule.delete({ where: { id } });
  await audit({ entityType: "Rule", entityId: id, event: "rule.deleted", metadata: { by: currentUser(req) } });
  res.json({ ok: true });
});

rulesRouter.get("/settings/pause", async (_req, res) => {
  const s = await prisma.setting.findUnique({ where: { key: "auto_moderation_paused" } });
  res.json({ paused: s?.value === "true" });
});

rulesRouter.post("/settings/pause", async (req, res) => {
  const { paused } = req.body as { paused: boolean };
  await prisma.setting.upsert({
    where: { key: "auto_moderation_paused" },
    create: { key: "auto_moderation_paused", value: paused ? "true" : "false" },
    update: { value: paused ? "true" : "false" },
  });
  await audit({
    entityType: "Setting",
    entityId: "auto_moderation_paused",
    event: "setting.updated",
    metadata: { by: currentUser(req), paused },
  });
  res.json({ paused });
});

rulesRouter.get("/lists", async (_req, res) => {
  const entries = await prisma.listEntry.findMany({ orderBy: { createdAt: "desc" } });
  res.json(entries);
});

rulesRouter.post("/lists", async (req, res) => {
  const { kind, value } = req.body as { kind: string; value: string };
  const allowed = ["whitelist_word", "blacklist_word", "whitelist_author", "blacklist_author"];
  if (!allowed.includes(kind) || !value) {
    return res.status(400).json({ error: "invalid kind or value" });
  }
  const entry = await prisma.listEntry.upsert({
    where: { kind_value: { kind, value } },
    create: { kind, value },
    update: {},
  });
  res.json(entry);
});

rulesRouter.delete("/lists/:id", async (req, res) => {
  await prisma.listEntry.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});
