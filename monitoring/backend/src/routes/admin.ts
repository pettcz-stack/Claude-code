import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireRole } from '../auth.js';
import { sendReport } from '../services/report.js';
import { smtpEnabled } from '../config.js';
import { getSettings, saveSettings } from '../services/settings.js';
import { runAlertChecks } from '../services/alerts.js';
import { clearCache } from '../services/cache.js';
import { getSites } from '../services/sites.js';

/** Provozovny / pobočky – číselník pro určení pracoviště podle lokální sítě. */
const siteSchema = z.object({
  name: z.string().min(1).max(80),
  subnets: z.string().max(500), // CSV CIDR; prázdné = zatím neměřitelné (partner)
  kind: z.enum(['VLASTNI', 'PARTNER']).optional(),
  active: z.boolean().optional(),
});

export const adminRouter = Router();

/** Provozovny – výpis. */
adminRouter.get('/sites', async (_req, res) => {
  res.json({ sites: await getSites() });
});
/** Provozovny – přidání (ADMIN). */
adminRouter.post('/sites', requireRole('ADMIN'), async (req, res) => {
  const p = siteSchema.safeParse(req.body);
  if (!p.success) return void res.status(400).json({ error: 'invalid_payload' });
  const site = await prisma.site.create({ data: { name: p.data.name, subnets: p.data.subnets, kind: p.data.kind ?? 'VLASTNI', active: p.data.active ?? true } });
  clearCache();
  res.json({ site });
});
/** Provozovny – úprava (ADMIN). */
adminRouter.patch('/sites/:id', requireRole('ADMIN'), async (req, res) => {
  const p = siteSchema.partial().safeParse(req.body);
  if (!p.success) return void res.status(400).json({ error: 'invalid_payload' });
  const site = await prisma.site.update({ where: { id: req.params.id }, data: p.data });
  clearCache();
  res.json({ site });
});
/** Provozovny – smazání (ADMIN). */
adminRouter.delete('/sites/:id', requireRole('ADMIN'), async (req, res) => {
  await prisma.site.deleteMany({ where: { id: req.params.id } });
  clearCache();
  res.json({ ok: true });
});

/** Nastavení (e-maily pro upozornění atd.). */
adminRouter.get('/settings', async (_req, res) => {
  res.json({ settings: await getSettings(), smtpConfigured: smtpEnabled() });
});

const settingsSchema = z.object({
  alertsEnabled: z.boolean().optional(),
  alertRecipients: z.string().max(2000).optional(),
  offlineMinutes: z.number().int().min(5).max(1440).optional(),
  funMode: z.boolean().optional(),
  healthMode: z.boolean().optional(),
  growthMode: z.boolean().optional(),
  interpretMonitors: z.boolean().optional(),
  employeeReportEnabled: z.boolean().optional(),
});
adminRouter.put('/settings', requireRole('ADMIN'), async (req, res) => {
  const p = settingsSchema.safeParse(req.body);
  if (!p.success) return void res.status(400).json({ error: 'invalid_payload' });
  await saveSettings(p.data);
  clearCache(); // změna nastavení (např. interpretace monitorů) → přepočítat
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

/** Výpis sledovaných uživatelů (obsahuje mzdy → CITLIVÉ, jen ADMIN). */
adminRouter.get('/users', requireRole('ADMIN'), async (_req, res) => {
  const users = await prisma.monitoredUser.findMany({
    orderBy: [{ active: 'desc' }, { department: 'asc' }, { displayName: 'asc' }],
    select: { id: true, sid: true, displayName: true, department: true, active: true, hourlyRate: true },
  });
  res.json({ users });
});

const userPatch = z.object({
  displayName: z.string().max(255).optional(),
  department: z.string().max(128).optional(),
  active: z.boolean().optional(),
  hourlyRate: z.number().min(0).max(100000).nullable().optional(),
});

/** Správa sledovaných uživatelů (jméno, oddělení, aktivita, mzda) – jen ADMIN. */
adminRouter.patch('/users/:id', requireRole('ADMIN'), async (req, res) => {
  const parsed = userPatch.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_payload' });
    return;
  }
  const user = await prisma.monitoredUser.update({ where: { id: req.params.id }, data: parsed.data });
  res.json({ user: { id: user.id, displayName: user.displayName, department: user.department, active: user.active, hourlyRate: user.hourlyRate } });
});

const importSchema = z.object({
  categories: z.array(z.object({ appName: z.string().min(1), category: z.string().min(1), type: z.enum(['WORK', 'NON_WORK', 'NEUTRAL', 'UNKNOWN']) })).optional(),
  webRules: z.array(z.object({ keyword: z.string().min(1), category: z.string().min(1), type: z.enum(['WORK', 'NON_WORK', 'NEUTRAL', 'UNKNOWN']) })).optional(),
});

/** Dávkový import zařazení (kategorie aplikací + pravidla webů) – jen ADMIN. */
adminRouter.post('/classification-import', requireRole('ADMIN'), async (req, res) => {
  const p = importSchema.safeParse(req.body);
  if (!p.success) return void res.status(400).json({ error: 'invalid_payload', detail: p.error.flatten() });
  let cats = 0, rules = 0;
  for (const c of p.data.categories ?? []) {
    await prisma.appCategory.upsert({ where: { appName: c.appName }, create: c, update: { category: c.category, type: c.type } });
    cats++;
  }
  for (const r of p.data.webRules ?? []) {
    await prisma.webRule.upsert({ where: { keyword: r.keyword }, create: r, update: { category: r.category, type: r.type } });
    rules++;
  }
  res.json({ ok: true, categories: cats, webRules: rules });
});

/** Reklamace klasifikace – seznam (ADMIN). */
adminRouter.get('/claims', requireRole('ADMIN'), async (_req, res) => {
  const rows = await prisma.classificationClaim.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  res.json({ claims: rows });
});

/** Vyřízení reklamace: zařadí cíl a uzavře (ADMIN). */
const claimResolve = z.object({ type: z.enum(['WORK', 'NON_WORK', 'NEUTRAL', 'UNKNOWN']), category: z.string().min(1).max(64) });
adminRouter.post('/claims/:id/resolve', requireRole('ADMIN'), async (req, res) => {
  const p = claimResolve.safeParse(req.body);
  if (!p.success) return void res.status(400).json({ error: 'invalid_payload' });
  const claim = await prisma.classificationClaim.findUnique({ where: { id: req.params.id } });
  if (!claim) return void res.status(404).json({ error: 'not_found' });
  if (claim.targetKind === 'TITLE') {
    await prisma.webRule.upsert({ where: { keyword: claim.target }, create: { keyword: claim.target, category: p.data.category, type: p.data.type }, update: { category: p.data.category, type: p.data.type } });
  } else {
    await prisma.appCategory.upsert({ where: { appName: claim.target }, create: { appName: claim.target, category: p.data.category, type: p.data.type }, update: { category: p.data.category, type: p.data.type } });
  }
  await prisma.classificationClaim.update({ where: { id: claim.id }, data: { status: 'RESOLVED' } });
  res.json({ ok: true });
});

const catSchema = z.object({
  appName: z.string().min(1).max(260),
  category: z.string().min(1).max(64),
  type: z.enum(['WORK', 'NON_WORK', 'NEUTRAL', 'UNKNOWN']),
  licensed: z.boolean().optional(),
  seats: z.number().int().min(0).max(100000).nullable().optional(),
  costPerSeat: z.number().min(0).max(1000000).nullable().optional(),
});
const ruleSchema = z.object({
  keyword: z.string().min(1).max(120),
  category: z.string().min(1).max(64),
  type: z.enum(['WORK', 'NON_WORK', 'NEUTRAL', 'UNKNOWN']),
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
    update: {
      category: p.data.category,
      type: p.data.type,
      ...(p.data.licensed !== undefined ? { licensed: p.data.licensed } : {}),
      ...(p.data.seats !== undefined ? { seats: p.data.seats } : {}),
      ...(p.data.costPerSeat !== undefined ? { costPerSeat: p.data.costPerSeat } : {}),
    },
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

// --- Pravidla podle oddělení (přepis práce/zábava pro kategorii) -------------
const deptRuleSchema = z.object({
  department: z.string().min(1).max(128),
  category: z.string().min(1).max(64),
  type: z.enum(['WORK', 'NON_WORK', 'NEUTRAL', 'UNKNOWN']),
});
adminRouter.get('/dept-rules', async (_req, res) => {
  const rows = await prisma.deptClassification.findMany({ orderBy: [{ department: 'asc' }, { category: 'asc' }] });
  res.json({ rules: rows });
});
adminRouter.post('/dept-rules', requireRole('ADMIN'), async (req, res) => {
  const p = deptRuleSchema.safeParse(req.body);
  if (!p.success) return void res.status(400).json({ error: 'invalid_payload' });
  const row = await prisma.deptClassification.upsert({
    where: { department_category: { department: p.data.department, category: p.data.category } },
    create: p.data,
    update: { type: p.data.type },
  });
  clearCache();
  res.json({ rule: row });
});
adminRouter.delete('/dept-rules/:id', requireRole('ADMIN'), async (req, res) => {
  await prisma.deptClassification.deleteMany({ where: { id: req.params.id } });
  clearCache();
  res.json({ ok: true });
});

/** Audit log přístupů (GDPR) – jen ADMIN. */
adminRouter.get('/audit', requireRole('ADMIN'), async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 200), 1000);
  const rows = await prisma.accessAudit.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
  res.json({ rows });
});
