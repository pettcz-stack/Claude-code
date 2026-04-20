import { Router } from "express";
import { prisma } from "../db";
import { fetchAccount } from "../meta/fetcher";
import { audit } from "../services/audit";
import { currentUser } from "../middleware/auth";

export const accountsRouter: Router = Router();

accountsRouter.get("/", async (_req, res) => {
  const accounts = await prisma.account.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      platform: true,
      pageId: true,
      pageName: true,
      active: true,
      tokenExpiresAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  res.json(accounts);
});

accountsRouter.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const { active } = req.body as { active?: boolean };
  const updated = await prisma.account.update({
    where: { id },
    data: { active: typeof active === "boolean" ? active : undefined },
  });
  await audit({
    entityType: "Account",
    entityId: id,
    event: "account.updated",
    metadata: { active: updated.active, by: currentUser(req) },
  });
  res.json(updated);
});

accountsRouter.post("/:id/fetch", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await fetchAccount(id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

accountsRouter.delete("/:id", async (req, res) => {
  const { id } = req.params;
  await prisma.account.delete({ where: { id } });
  await audit({
    entityType: "Account",
    entityId: id,
    event: "account.deleted",
    metadata: { by: currentUser(req) },
  });
  res.json({ ok: true });
});
