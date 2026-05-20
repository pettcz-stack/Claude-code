import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireRole } from '../auth.js';
import { sendReport } from '../services/report.js';
import { smtpEnabled } from '../config.js';
import { getSettings, saveSettings } from '../services/settings.js';
import { runAlertChecks } from '../services/alerts.js';

export const adminRouter = Router();

/** Nastavení (e-maily pro upozornění atd.). */
adminRouter.get('/settings', async (_req, res) => {
  res.json({ settings: await getSettings(), smtpConfigured: smtpEnabled() });
});

const settingsSchema = z.object({
  alertsEnabled: z.boolean().optional(),
  alertRecipients: z.string().max(2000).optional(),
  offlineMinutes: z.number().int().min(5).max(1440).optional(),
});
adminRouter.put('/settings', requireRole('ADMIN'), async (req, res) => {
  const p = settingsSchema.safeParse(req.body);
  if (!p.success) return void res.status(400).json({ error: 'invalid_payload' });
  await saveSettings(p.data);
  res.json({ settings: await getSettings() });
});

/** Ruční spuštění kontroly upozornění (test). */
adminRouter.post('/alerts/run', requireRole('ADMIN'), async (_req, res) => {
  res.json(await runAlertChecks());
});

/** Ruční odeslání e-mailového reportu (test) – jen ADMIN. */
adminRouter.post('/report/send', requireRole('ADMIN'), async (_req, res) => {
  if (!smtpEnabled()) {
    res.status(400).json({ error: 'smtp_not_configured' });
    return;
  }
  try {
    const result = await sendReport();
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ error: 'send_failed', detail: String(e) });
  }
});

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

/** Výpis všech sledovaných uživatelů (vč. neaktivních) pro správu. */
adminRouter.get('/users', async (_req, res) => {
  const users = await prisma.monitoredUser.findMany({
    orderBy: [{ active: 'desc' }, { department: 'asc' }, { displayName: 'asc' }],
    select: { id: true, sid: true, displayName: true, department: true, active: true },
  });
  res.json({ users });
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

const catSchema = z.object({
  appName: z.string().min(1).max(260),
  category: z.string().min(1).max(64),
  type: z.enum(['WORK', 'NON_WORK', 'NEUTRAL']),
});
const ruleSchema = z.object({
  keyword: z.string().min(1).max(120),
  category: z.string().min(1).max(64),
  type: z.enum(['WORK', 'NON_WORK', 'NEUTRAL']),
});

/** Kategorie aplikací (proces → kategorie/typ). */
adminRouter.get('/categories', async (_req, res) => {
  const rows = await prisma.appCategory.findMany({ orderBy: [{ type: 'asc' }, { appName: 'asc' }] });
  res.json({ categories: rows });
});
adminRouter.post('/categories', requireRole('ADMIN'), async (req, res) => {
  const p = catSchema.safeParse(req.body);
  if (!p.success) return void res.status(400).json({ error: 'invalid_payload' });
  const row = await prisma.appCategory.upsert({
    where: { appName: p.data.appName },
    create: p.data,
    update: { category: p.data.category, type: p.data.type },
  });
  res.json({ category: row });
});
adminRouter.delete('/categories/:appName', requireRole('ADMIN'), async (req, res) => {
  await prisma.appCategory.deleteMany({ where: { appName: req.params.appName } });
  res.json({ ok: true });
});

/** Pravidla pro klasifikaci podle titulku okna (weby). */
adminRouter.get('/webrules', async (_req, res) => {
  const rows = await prisma.webRule.findMany({ orderBy: [{ type: 'asc' }, { keyword: 'asc' }] });
  res.json({ rules: rows });
});
adminRouter.post('/webrules', requireRole('ADMIN'), async (req, res) => {
  const p = ruleSchema.safeParse(req.body);
  if (!p.success) return void res.status(400).json({ error: 'invalid_payload' });
  const row = await prisma.webRule.upsert({
    where: { keyword: p.data.keyword },
    create: p.data,
    update: { category: p.data.category, type: p.data.type },
  });
  res.json({ rule: row });
});
adminRouter.delete('/webrules/:keyword', requireRole('ADMIN'), async (req, res) => {
  await prisma.webRule.deleteMany({ where: { keyword: req.params.keyword } });
  res.json({ ok: true });
});

/** Audit log přístupů (GDPR) – jen ADMIN. */
adminRouter.get('/audit', requireRole('ADMIN'), async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 200), 1000);
  const rows = await prisma.accessAudit.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
  res.json({ rows });
});
