import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { audit } from "../services/audit";
import { currentUser } from "../middleware/auth";

export const templatesRouter: Router = Router();

const CATEGORIES = [
  "spam",
  "vulgarity",
  "brand_attack",
  "legitimate_criticism",
  "neutral",
  "positive",
] as const;

const TemplateInput = z.object({
  name: z.string().min(1).max(100),
  category: z.enum(CATEGORIES).nullable().optional(),
  body: z.string().min(1).max(2000),
  language: z.string().max(5).nullable().optional(),
  enabled: z.boolean().optional(),
});

templatesRouter.get("/", async (req, res) => {
  const { category } = req.query as { category?: string };
  const where: Record<string, unknown> = { enabled: true };
  if (category) where.OR = [{ category }, { category: null }];
  const items = await prisma.replyTemplate.findMany({ where, orderBy: [{ category: "asc" }, { name: "asc" }] });
  res.json(items);
});

templatesRouter.post("/", async (req, res) => {
  const parsed = TemplateInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const t = await prisma.replyTemplate.create({ data: parsed.data });
  await audit({
    entityType: "ReplyTemplate",
    entityId: t.id,
    event: "template.created",
    metadata: { by: currentUser(req), name: t.name, category: t.category },
  });
  res.json(t);
});

templatesRouter.patch("/:id", async (req, res) => {
  const parsed = TemplateInput.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const t = await prisma.replyTemplate.update({ where: { id: req.params.id }, data: parsed.data });
  await audit({
    entityType: "ReplyTemplate",
    entityId: t.id,
    event: "template.updated",
    metadata: { by: currentUser(req) },
  });
  res.json(t);
});

templatesRouter.delete("/:id", async (req, res) => {
  await prisma.replyTemplate.delete({ where: { id: req.params.id } });
  await audit({
    entityType: "ReplyTemplate",
    entityId: req.params.id,
    event: "template.deleted",
    metadata: { by: currentUser(req) },
  });
  res.json({ ok: true });
});

templatesRouter.post("/:id/render", async (req, res) => {
  const t = await prisma.replyTemplate.findUniqueOrThrow({ where: { id: req.params.id } });
  const vars = (req.body as { vars?: Record<string, string> }).vars ?? {};
  const rendered = t.body.replace(/\{(\w+)\}/g, (_m, k: string) => vars[k] ?? `{${k}}`);
  res.json({ rendered });
});
