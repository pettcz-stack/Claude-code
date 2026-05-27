import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { logAccess, requireRole } from '../auth.js';
import { resolveDept, assertCanSeeUser, getDeptScope, deptWhere } from '../services/accessControl.js';
import { getCategoryMap } from '../services/categories.js';
import { classifyActivity, getWebRules } from '../services/classify.js';
import { computeUserScore } from '../services/scoring.js';
import { getSettings } from '../services/settings.js';
import { heatmap, exportClassification } from '../services/analytics.js';
import { computeIntegrity, detectAlerts } from '../services/integrity.js';
import { getTips } from '../services/tips.js';
import { cq } from '../services/cachedQueries.js';
import { getDeptRules } from '../services/deptrules.js';
import { demoUserWhere } from '../services/demoFilter.js';
import { floorToHour } from '../services/tz.js';

export const dashboardRouter = Router();

/** Tipy do reportu zaměstnance (zdravotní / moudra / „věděl jsi“). */
dashboardRouter.get('/tips', async (_req, res) => {
  res.json(await getTips());
});

/** Přehled firmy – KPI, rozdělení času, oddělení, top/bottom. */
dashboardRouter.get('/overview', async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) return void res.status(400).json({ error: 'invalid_query' });
  const { from, to, department } = parsed.data;
  const dept = await resolveDept(req, res, department);
  if (dept === null) return;
  res.json(await cq.overview(from, to, dept));
});

/** Heatmapa využití: den v týdnu × hodina. */
dashboardRouter.get('/heatmap', async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) return void res.status(400).json({ error: 'invalid_query' });
  const { from, to, department, userId } = parsed.data;
  const dept = await resolveDept(req, res, department);
  if (dept === null) return;
  if (userId && !(await assertCanSeeUser(req, res, userId))) return;
  res.json(await heatmap(new Date(from), new Date(to), dept, userId));
});

/** Audit softwaru / licencí (využití aplikací + nevyužité placené licence). */
dashboardRouter.get('/software', async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) return void res.status(400).json({ error: 'invalid_query' });
  const { from, to, department } = parsed.data;
  const dept = await resolveDept(req, res, department);
  if (dept === null) return;
  res.json(await cq.software(from, to, dept));
});

/** Náklady neproduktivního času (mzda × …). CITLIVÉ – jen ADMIN (šéf). */
dashboardRouter.get('/cost', requireRole('ADMIN'), async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) return void res.status(400).json({ error: 'invalid_query' });
  const { from, to, department } = parsed.data;
  // ADMIN-only endpoint, ale prošlém resolveDept pro konzistenci (vrátí beze změny).
  const dept = await resolveDept(req, res, department);
  if (dept === null) return;
  res.json(await cq.cost(from, to, dept));
});

/** Export položek k zařazení (dávková klasifikace). */
dashboardRouter.get('/classification-export', async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) return void res.status(400).json({ error: 'invalid_query' });
  const { from, to } = parsed.data;
  const all = req.query.all === 'true';
  res.json(await exportClassification(new Date(from), new Date(to), !all));
});

/** Reklamace klasifikace od zaměstnance (omezená kvótou 3 otevřené). */
const claimSchema = z.object({
  userId: z.string().min(1),
  target: z.string().min(1).max(260),
  targetKind: z.enum(['APP', 'TITLE']).default('APP'),
  suggested: z.enum(['WORK', 'NON_WORK']),
  note: z.string().max(500).optional(),
});
dashboardRouter.post('/claims', async (req, res) => {
  const p = claimSchema.safeParse(req.body);
  if (!p.success) return void res.status(400).json({ error: 'invalid_payload' });
  const open = await prisma.classificationClaim.count({ where: { userId: p.data.userId, status: 'OPEN' } });
  if (open >= 3) return void res.status(429).json({ error: 'claim_quota_reached' });
  await prisma.classificationClaim.create({ data: p.data });
  res.json({ ok: true, remaining: 3 - open - 1 });
});

/** Efektivita podle počtu monitorů (1 vs. 2+). */
dashboardRouter.get('/monitors', async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) return void res.status(400).json({ error: 'invalid_query' });
  const { from, to, department } = parsed.data;
  const dept = await resolveDept(req, res, department);
  if (dept === null) return;
  res.json(await cq.monitors(from, to, dept));
});

/** Home Office vyhodnocení (efektivita HO vs. kancelář). */
dashboardRouter.get('/homeoffice', async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) return void res.status(400).json({ error: 'invalid_query' });
  const { from, to, department } = parsed.data;
  const dept = await resolveDept(req, res, department);
  if (dept === null) return;
  res.json(await cq.homeoffice(from, to, dept));
});

/** Self-report pro zaměstnance (anonymizované srovnání). */
dashboardRouter.get('/selfreport', async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) return void res.status(400).json({ error: 'invalid_query' });
  const { from, to, userId } = parsed.data;
  if (!userId) return void res.status(400).json({ error: 'userId_required' });
  if (!(await assertCanSeeUser(req, res, userId))) return;
  await logAccess(req.admin?.username ?? 'unknown', 'VIEW', `selfreport ${from}..${to}`, userId);
  res.json({ report: await cq.selfreport(userId, from, to) });
});

/** Integrita aktivity jednoho uživatele (detekce nepovolených praktik). */
dashboardRouter.get('/integrity', async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) return void res.status(400).json({ error: 'invalid_query' });
  const { from, to, userId } = parsed.data;
  if (!userId) return void res.status(400).json({ error: 'userId_required' });
  if (!(await assertCanSeeUser(req, res, userId))) return;
  res.json({ integrity: await computeIntegrity(userId, new Date(from), new Date(to)) });
});

/** Upozornění napříč firmou (uživatelé s podezřelým chováním). */
dashboardRouter.get('/alerts', async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) return void res.status(400).json({ error: 'invalid_query' });
  const { from, to, department } = parsed.data;
  const dept = await resolveDept(req, res, department);
  if (dept === null) return;
  res.json({ alerts: await detectAlerts(new Date(from), new Date(to), dept) });
});

/** Denní trend skóre (uživatel nebo firma). */
dashboardRouter.get('/trend', async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_query', detail: parsed.error.flatten() });
    return;
  }
  const { from, to, userId, department } = parsed.data;
  const dept = await resolveDept(req, res, department);
  if (dept === null) return;
  if (userId && !(await assertCanSeeUser(req, res, userId))) return;
  const points = await cq.trend(from, to, userId, dept);
  res.json({ points });
});

/** Top aplikace a weby za období. */
dashboardRouter.get('/top-activities', async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_query', detail: parsed.error.flatten() });
    return;
  }
  const { from, to, userId, department } = parsed.data;
  const dept = await resolveDept(req, res, department);
  if (dept === null) return;
  if (userId && !(await assertCanSeeUser(req, res, userId))) return;
  const result = await cq.topact(from, to, userId, dept);
  res.json(result);
});

/** Mapa appName → {category, type} (pro zobrazení „v čem pracoval"). */
dashboardRouter.get('/categories', async (_req, res) => {
  res.json({ categories: await getCategoryMap() });
});

/** Skóre a barevný rozpad jednoho uživatele za období. */
dashboardRouter.get('/score', async (req, res) => {
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
  if (!(await assertCanSeeUser(req, res, userId))) return;
  const { interpretMonitors } = await getSettings();
  const score = await computeUserScore(userId, new Date(from), new Date(to), { interpretMonitors });
  await logAccess(req.admin?.username ?? 'unknown', 'VIEW', `score ${from}..${to}`, userId);
  res.json({ score });
});

/** Žebříček skóre všech aktivních uživatelů za období (přehled firmy). */
dashboardRouter.get('/scoreboard', async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_query', detail: parsed.error.flatten() });
    return;
  }
  const { from, to, department } = parsed.data;
  const dept = await resolveDept(req, res, department);
  if (dept === null) return;
  const rows = await cq.scoreboard(from, to, dept);
  res.json({ rows });
});

const rangeSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  userId: z.string().optional(),
  department: z.string().optional(),
});

/** Seznam sledovaných uživatelů (pro filtry a výběr v dashboardu).
 *  Pro MANAGER ořízneme seznam pouze na jeho přiřazená oddělení. */
dashboardRouter.get('/users', async (req, res) => {
  const scope = await getDeptScope(req);
  const scopeFilter = scope.unrestricted ? {} : deptWhere(scope.allowed);
  const users = await prisma.monitoredUser.findMany({
    where: { active: true, ...scopeFilter, ...(await demoUserWhere()) },
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
  if (!(await assertCanSeeUser(req, res, userId))) return;
  const rows = await prisma.activityHourly.findMany({
    where: { userId, hourStart: { gte: new Date(from), lt: new Date(to) } },
    orderBy: { hourStart: 'asc' },
  });
  await logAccess(req.admin?.username ?? 'unknown', 'VIEW', `hourly ${from}..${to}`, userId);
  res.json({ rows });
});

/** Rozpad po hodinách: klasifikovaný čas (práce/mimopráce/neměřitelné) + aplikace (tooltip). */
dashboardRouter.get('/hourly-apps', async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) return void res.status(400).json({ error: 'invalid_query' });
  const { from, to, userId } = parsed.data;
  if (!userId) return void res.status(400).json({ error: 'userId_required' });
  if (!(await assertCanSeeUser(req, res, userId))) return;
  const [catMap, webRules, deptRules, mu] = await Promise.all([
    getCategoryMap(), getWebRules(), getDeptRules(),
    prisma.monitoredUser.findUnique({ where: { id: userId }, select: { department: true } }),
  ]);
  const department = mu?.department ?? null;
  const intervals = await prisma.activityInterval.findMany({
    where: { userId, intervalStart: { gte: new Date(from), lt: new Date(to) } },
    select: { intervalStart: true, foregroundApp: true, windowTitle: true, activeSeconds: true, idleSeconds: true, sessionLocked: true, intervalSeconds: true },
  });
  type Bucket = { apps: Map<string, number>; work: number; nonwork: number; unknown: number; idle: number; locked: number };
  const byHour = new Map<string, Bucket>();
  for (const it of intervals) {
    const key = floorToHour(it.intervalStart).toISOString();
    let b = byHour.get(key);
    if (!b) { b = { apps: new Map(), work: 0, nonwork: 0, unknown: 0, idle: 0, locked: 0 }; byHour.set(key, b); }
    const aMin = it.activeSeconds / 60;
    b.idle += it.idleSeconds / 60;
    if (it.sessionLocked) b.locked += it.intervalSeconds / 60;
    if (aMin > 0) {
      const info = classifyActivity(catMap, webRules, it.foregroundApp, it.windowTitle, deptRules, department);
      if (info.type === 'NON_WORK') b.nonwork += aMin;
      else if (info.type === 'UNKNOWN') b.unknown += aMin;
      else b.work += aMin;
      if (it.foregroundApp) b.apps.set(it.foregroundApp, (b.apps.get(it.foregroundApp) ?? 0) + aMin);
    }
  }
  const hours = Array.from(byHour.entries()).map(([hourStart, b]) => ({
    hourStart,
    work: Math.round(b.work), nonwork: Math.round(b.nonwork), unknown: Math.round(b.unknown),
    idle: Math.round(b.idle), locked: Math.round(b.locked),
    apps: Array.from(b.apps.entries()).map(([app, minutes]) => ({ app, minutes: Math.round(minutes) })).sort((a, b2) => b2.minutes - a.minutes),
  }));
  res.json({ hours });
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
  const dept = await resolveDept(req, res, department);
  if (dept === null) return;

  const users = await prisma.monitoredUser.findMany({
    where: { active: true, ...deptWhere(dept), ...(await demoUserWhere()) },
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
