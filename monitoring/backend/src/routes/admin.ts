import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireRole } from '../auth.js';

export const adminRouter = Router();

/** Centrální přehled zařízení (stav agentů). */
adminRouter.get('/devices', async (_req, res) => {
  const devices = await prisma.device.findMany({
    orderBy: { lastSeen: 'desc' },
    select: { id: true, machineId: true, hostname: true, os: true, agentVersion: true, active: true, lastSeen: true },
  });
  const now = Date.now();
  const withStatus = devices.map((d) => ({
    ...d,
    online: d.lastSeen ? now - new Date(d.lastSeen).getTime() < 5 * 60 * 1000 : false,
  }));
  res.json({ devices: withStatus });
});

const devicePatch = z.object({ active: z.boolean() });

/** Aktivace/deaktivace zařízení (jen ADMIN). */
adminRouter.patch('/devices/:id', requireRole('ADMIN'), async (req, res) => {
  const parsed = devicePatch.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_payload' });
    return;
  }
  const device = await prisma.device.update({ where: { id: req.params.id }, data: { active: parsed.data.active } });
  res.json({ device: { id: device.id, active: device.active } });
});

const userPatch = z.object({
  displayName: z.string().max(255).optional(),
  department: z.string().max(128).optional(),
  active: z.boolean().optional(),
});

/** Správa sledovaných uživatelů (jméno, oddělení, aktivita) – jen ADMIN. */
adminRouter.patch('/users/:id', requireRole('ADMIN'), async (req, res) => {
  const parsed = userPatch.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_payload' });
    return;
  }
  const user = await prisma.monitoredUser.update({ where: { id: req.params.id }, data: parsed.data });
  res.json({ user: { id: user.id, displayName: user.displayName, department: user.department, active: user.active } });
});

/** Audit log přístupů (GDPR) – jen ADMIN. */
adminRouter.get('/audit', requireRole('ADMIN'), async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 200), 1000);
  const rows = await prisma.accessAudit.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
  res.json({ rows });
});
