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
import { demoUserWhere, demoDeviceWhere } from '../services/demoFilter.js';
import { listDeviceHealth, getDeviceHealthDetail } from '../services/health.js';
import { recentEvents, clearEvents } from '../services/eventLog.js';
import { getAgentLog } from '../services/agentLogStore.js';
import { exportUserData, eraseUser } from '../services/userPrivacy.js';
import { logAccess, hashPassword, verifyPassword, readSessionToken, hashSessionToken } from '../auth.js';
import { printSummary, userPrintJobs, usbSummary, userUsbEvents } from '../services/printUsb.js';
import { validateCuidParam } from '../middleware/validateId.js';
import { runSecurityCheck } from '../services/securityCheck.js';

/** Provozovny / pobočky – číselník pro určení pracoviště podle lokální sítě. */
const siteSchema = z.object({
  name: z.string().min(1).max(80),
  subnets: z.string().max(500), // CSV CIDR; prázdné = zatím neměřitelné (partner)
  kind: z.enum(['VLASTNI', 'PARTNER']).optional(),
  active: z.boolean().optional(),
});

export const adminRouter = Router();

// Validuje, že /:id i /:deviceId v URL parametru jsou cuid-like.
// Bez validace by špatný ID způsobil Prisma null/500 a stack v logu;
// tady to uťneme čistým 400 invalid_id.
adminRouter.param('id', validateCuidParam);
adminRouter.param('deviceId', validateCuidParam);

/**
 * Aktivní admin sessions přihlášeného uživatele (pro samosprávu –
 * "kde jsem všude přihlášený, odhlásit ostatní"). Vrací bez tokenHash.
 */
adminRouter.get('/sessions', async (req, res) => {
  if (!req.admin) return void res.status(401).json({ error: 'unauthorized' });
  const sessions = await prisma.adminSession.findMany({
    where: { adminId: req.admin.id, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: 'desc' },
    select: { id: true, createdAt: true, expiresAt: true, lastUsedAt: true, tokenHash: true },
  });
  const currentHash = hashSessionToken(readSessionToken(req));
  res.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      lastUsedAt: s.lastUsedAt,
      isCurrent: s.tokenHash === currentHash,
    })),
  });
});

/** Revokace konkrétní session (např. "ztracený notebook"). */
adminRouter.delete('/sessions/:id', async (req, res) => {
  if (!req.admin) return void res.status(401).json({ error: 'unauthorized' });
  const r = await prisma.adminSession.deleteMany({
    where: { id: req.params.id, adminId: req.admin.id },
  });
  if (r.count === 0) return void res.status(404).json({ error: 'not_found' });
  await logAccess({
    adminId: req.admin.id,
    adminIdentity: req.admin.username,
    action: 'SESSION_REVOKE',
    detail: `revokována session ${req.params.id}`,
  });
  res.json({ ok: true });
});

/**
 * Self-audit bezpečnostního stavu instalace. Admin v UI vidí, co je
 * v pořádku a co dotáhnout. Nepřináší nové secrets – jen čte vlastní stav.
 */
adminRouter.get('/security-check', requireRole('ADMIN'), async (_req, res) => {
  res.json({ checks: await runSecurityCheck() });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tisk & USB — souhrn a drill-down per uživatel
// ─────────────────────────────────────────────────────────────────────────────

const rangeQuery = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  limit: z.coerce.number().int().min(1).max(2000).optional(),
});

adminRouter.get('/print/summary', async (req, res) => {
  const p = rangeQuery.safeParse(req.query);
  if (!p.success) return void res.status(400).json({ error: 'invalid_query' });
  res.json({ rows: await printSummary(new Date(p.data.from), new Date(p.data.to), p.data.limit ?? 100) });
});

adminRouter.get('/print/user/:id', requireRole('ADMIN'), async (req, res) => {
  const p = rangeQuery.safeParse(req.query);
  if (!p.success) return void res.status(400).json({ error: 'invalid_query' });
  await logAccess({
    adminId: req.admin?.id, adminIdentity: req.admin?.username ?? 'unknown',
    action: 'VIEW', detail: `print jobs detail ${req.params.id}`, viewedUserId: req.params.id,
  });
  res.json({ jobs: await userPrintJobs(req.params.id, new Date(p.data.from), new Date(p.data.to), p.data.limit ?? 500) });
});

adminRouter.get('/usb/summary', async (req, res) => {
  const p = rangeQuery.safeParse(req.query);
  if (!p.success) return void res.status(400).json({ error: 'invalid_query' });
  res.json({ rows: await usbSummary(new Date(p.data.from), new Date(p.data.to), p.data.limit ?? 100) });
});

adminRouter.get('/usb/user/:id', requireRole('ADMIN'), async (req, res) => {
  const p = rangeQuery.safeParse(req.query);
  if (!p.success) return void res.status(400).json({ error: 'invalid_query' });
  await logAccess({
    adminId: req.admin?.id, adminIdentity: req.admin?.username ?? 'unknown',
    action: 'VIEW', detail: `usb events detail ${req.params.id}`, viewedUserId: req.params.id,
  });
  res.json({ events: await userUsbEvents(req.params.id, new Date(p.data.from), new Date(p.data.to), p.data.limit ?? 500) });
});

/**
 * Změna hesla přihlášeného admina. Vyžaduje znalost starého hesla
 * (obrana proti use case "admin nechal otevřené PC"). Po úspěšné změně
 * smaže VŠECHNY ostatní session daného účtu – jediné aktivní zůstane
 * to, ve kterém změnu provádíme (anti-takeover po kompromitaci).
 */
const passwordChangeSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(10).max(200),
});
adminRouter.post('/change-password', async (req, res) => {
  if (!req.admin) return void res.status(401).json({ error: 'unauthorized' });
  const parsed = passwordChangeSchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: 'invalid_payload', detail: 'Nové heslo musí mít alespoň 10 znaků.' });
  const me = await prisma.adminUser.findUnique({ where: { id: req.admin.id } });
  if (!me) return void res.status(404).json({ error: 'not_found' });
  if (!verifyPassword(parsed.data.oldPassword, me.passwordHash)) {
    return void res.status(403).json({ error: 'wrong_old_password' });
  }
  if (parsed.data.oldPassword === parsed.data.newPassword) {
    return void res.status(400).json({ error: 'same_password' });
  }
  await prisma.adminUser.update({
    where: { id: me.id },
    data: { passwordHash: hashPassword(parsed.data.newPassword) },
  });
  // Invalidate všechny ostatní sessions (kromě té současné, kterou pozná
  // podle cookie/Bearer headeru – ta se necháme dál žít, ať se admin
  // nemusí znovu přihlásit hned po změně hesla).
  const currentToken = readSessionToken(req);
  await prisma.adminSession.deleteMany({
    where: { adminId: me.id, NOT: { tokenHash: hashSessionToken(currentToken) } },
  });
  await logAccess({
    adminId: me.id,
    adminIdentity: me.username,
    action: 'PASSWORD_CHANGE',
    detail: 'admin si změnil vlastní heslo',
  });
  res.json({ ok: true });
});

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
  showDemoDevices: z.boolean().optional(),
  privacyStoreDomainOnly: z.boolean().optional(),
  retentionDaysIntervals: z.number().int().min(7).max(3650).optional(),
  selfAuditEnabled: z.boolean().optional(),
  printTrackingEnabled: z.boolean().optional(),
  capturePrintDocName: z.boolean().optional(),
  usbTrackingEnabled: z.boolean().optional(),
  captureUsbFilename: z.boolean().optional(),
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
    where: await demoDeviceWhere(),
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
    where: await demoUserWhere(),
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

/**
 * GDPR čl. 20 – právo na přenositelnost. Stáhne JSON dump VŠECH dat
 * vedených o zaměstnanci (intervaly, agregáty, absence, kdo se na něj díval).
 * Každý export se zapisuje do auditu přístupů.
 */
adminRouter.get('/users/:id/export', requireRole('ADMIN'), async (req, res) => {
  const data = await exportUserData(req.params.id);
  if (!data) return void res.status(404).json({ error: 'not_found' });
  await logAccess({
    adminId: req.admin?.id,
    adminIdentity: req.admin?.username ?? 'unknown',
    action: 'EXPORT',
    detail: `admin export uživatele ${req.params.id}`,
    viewedUserId: req.params.id,
  });
  res.setHeader('Content-Disposition', `attachment; filename="focus-user-${req.params.id}.json"`);
  res.json(data);
});

/**
 * GDPR čl. 17 – právo na výmaz. Smaže veškerá identifikovatelná data
 * o zaměstnanci a pseudonymizuje jeho profil. Operaci nelze vrátit zpět.
 * Audit přístupů zůstává (forenzní záznam).
 *
 * Klient musí poslat `?confirm=DELETE` jako bezpečnostní pojistku.
 */
adminRouter.delete('/users/:id', requireRole('ADMIN'), async (req, res) => {
  if (req.query.confirm !== 'DELETE') return void res.status(400).json({ error: 'missing_confirm', hint: 'add ?confirm=DELETE' });
  const result = await eraseUser(req.params.id);
  if (!result) return void res.status(404).json({ error: 'not_found' });
  await logAccess({
    adminId: req.admin?.id,
    adminIdentity: req.admin?.username ?? 'unknown',
    action: 'DELETE',
    detail: `GDPR výmaz uživatele ${req.params.id}: ${JSON.stringify(result.deleted)}`,
    viewedUserId: req.params.id,
  });
  res.json({ ok: true, ...result });
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

// --- HW telemetrie pro IT ----------------------------------------------------
adminRouter.get('/devices/health', async (_req, res) => {
  const rows = await listDeviceHealth();
  const summary = { critical: 0, warn: 0, ok: 0, unreported: 0 };
  for (const r of rows) summary[r.status === 'CRITICAL' ? 'critical' : r.status === 'WARN' ? 'warn' : r.status === 'OK' ? 'ok' : 'unreported']++;
  res.json({ rows, summary });
});
adminRouter.get('/devices/health/:deviceId', async (req, res) => {
  const detail = await getDeviceHealthDetail(req.params.deviceId);
  if (!detail) return void res.status(404).json({ error: 'not_found' });
  res.json({ detail });
});

/** Log agenta: posledních ~300 zpráv, které agent na PC posílá s každou
 *  ingest dávkou. Pro debug bez lezení na klientské PC. */
adminRouter.get('/devices/:deviceId/agent-log', async (req, res) => {
  res.json({ entries: getAgentLog(req.params.deviceId, 300) });
});

/** Diagnostika: posledních ~50 intervalů z konkrétního zařízení, ať admin vidí,
 *  co reálně agent posílá (app, titulek, aktivita). Pro debug klasifikace. */
adminRouter.get('/devices/:deviceId/recent-intervals', async (req, res) => {
  const rows = await prisma.activityInterval.findMany({
    where: { deviceId: req.params.deviceId },
    orderBy: { intervalStart: 'desc' },
    take: 50,
    select: {
      intervalStart: true, intervalSeconds: true, activeSeconds: true, idleSeconds: true,
      foregroundApp: true, windowTitle: true, keystrokeCount: true, mouseEvents: true,
      sessionLocked: true, user: { select: { displayName: true } },
    },
  });
  res.json({ intervals: rows });
});

/** Diagnostický log – posledních ~500 zajímavých událostí v paměti procesu. */
adminRouter.get('/events', async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 200), 500);
  const lvl = typeof req.query.level === 'string' ? req.query.level : undefined;
  const allowed = ['info', 'warn', 'error'] as const;
  const levelFilter = allowed.includes(lvl as typeof allowed[number]) ? (lvl as 'info' | 'warn' | 'error') : undefined;
  res.json({ events: recentEvents(limit, levelFilter) });
});
adminRouter.delete('/events', requireRole('ADMIN'), async (_req, res) => {
  clearEvents();
  res.json({ ok: true });
});

/** Audit log přístupů (GDPR) – jen ADMIN. */
adminRouter.get('/audit', requireRole('ADMIN'), async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 200), 1000);
  const rows = await prisma.accessAudit.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
  res.json({ rows });
});
