import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { logAccess } from '../auth.js';

export const dashboardRouter = Router();

const rangeSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  userId: z.string().optional(),
  department: z.string().optional(),
});

/** Seznam sledovaných uživatelů (pro filtry a výběr v dashboardu). */
dashboardRouter.get('/users', async (_req, res) => {
  const users = await prisma.monitoredUser.findMany({
    where: { active: true },
    orderBy: [{ department: 'asc' }, { displayName: 'asc' }],
    select: { id: true, displayName: true, department: true, sid: true },
  });
  res.json({ users });
});

/** Hodinové agregáty pro kalendář (jeden uživatel, časové rozmezí). */
dashboardRouter.get('/hourly', async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_query', detail: parsed.error.flatten() });
    return;
  }
  const { from, to, userId } = parsed.data;
  if (!userId) {
    res.status(400).json({ error: 'userId_required' });
    return;
  }
  const rows = await prisma.activityHourly.findMany({
    where: { userId, hourStart: { gte: new Date(from), lt: new Date(to) } },
    orderBy: { hourStart: 'asc' },
  });
  await logAccess(req.admin?.username ?? 'unknown', 'VIEW', `hourly ${from}..${to}`, userId);
  res.json({ rows });
});

/**
 * Firemní souhrn za období – agregace hodinových řádků na uživatele.
 * Vhodné pro přehled celé firmy / oddělení.
 */
dashboardRouter.get('/summary', async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_query', detail: parsed.error.flatten() });
    return;
  }
  const { from, to, department } = parsed.data;

  const users = await prisma.monitoredUser.findMany({
    where: { active: true, ...(department ? { department } : {}) },
    select: { id: true, displayName: true, department: true },
  });
  const userIds = users.map((u) => u.id);

  const hourly = await prisma.activityHourly.findMany({
    where: { userId: { in: userIds }, hourStart: { gte: new Date(from), lt: new Date(to) } },
  });

  const byUser = new Map<string, { active: number; idle: number; locked: number; ks: number; mouse: number }>();
  for (const h of hourly) {
    const acc = byUser.get(h.userId) ?? { active: 0, idle: 0, locked: 0, ks: 0, mouse: 0 };
    acc.active += h.activeMinutes;
    acc.idle += h.idleMinutes;
    acc.locked += h.lockedMinutes;
    acc.ks += h.keystrokeTotal;
    acc.mouse += h.mouseTotal;
    byUser.set(h.userId, acc);
  }

  const summary = users.map((u) => {
    const a = byUser.get(u.id) ?? { active: 0, idle: 0, locked: 0, ks: 0, mouse: 0 };
    return {
      userId: u.id,
      displayName: u.displayName,
      department: u.department,
      activeMinutes: Math.round(a.active),
      idleMinutes: Math.round(a.idle),
      lockedMinutes: Math.round(a.locked),
      keystrokeTotal: a.ks,
      mouseTotal: a.mouse,
      avgKpm: a.active > 0 ? Math.round(a.ks / a.active) : 0,
    };
  });

  res.json({ summary });
});
