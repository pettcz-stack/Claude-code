import { Router } from 'express';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import { prisma } from '../db.js';
import { logAccess } from '../auth.js';
import { demoUserWhere } from '../services/demoFilter.js';
import { resolveDept, assertCanSeeUser, deptWhere, getDeptScope } from '../services/accessControl.js';

export const exportRouter = Router();

const querySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  userId: z.string().optional(),
  department: z.string().optional(),
});

/** Řádkový export hodinových agregátů do .xlsx (podklad pro vyhodnocení firmy). */
exportRouter.get('/hourly.xlsx', async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_query', detail: parsed.error.flatten() });
    return;
  }
  const { from, to, userId, department } = parsed.data;
  const dept = await resolveDept(req, res, department);
  if (dept === null) return;
  if (userId && !(await assertCanSeeUser(req, res, userId))) return;

  const users = await prisma.monitoredUser.findMany({
    where: { ...deptWhere(dept), ...(userId ? { id: userId } : {}), ...(await demoUserWhere()) },
    select: { id: true, displayName: true, department: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const rows = await prisma.activityHourly.findMany({
    where: {
      userId: { in: users.map((u) => u.id) },
      hourStart: { gte: new Date(from), lt: new Date(to) },
    },
    orderBy: [{ userId: 'asc' }, { hourStart: 'asc' }],
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'FOCUS';
  const ws = wb.addWorksheet('Hodinové agregáty');
  ws.columns = [
    { header: 'Zaměstnanec', key: 'name', width: 24 },
    { header: 'Oddělení', key: 'dept', width: 16 },
    { header: 'Hodina (UTC)', key: 'hour', width: 22 },
    { header: 'Aktivní min', key: 'active', width: 12 },
    { header: 'Nečinnost min', key: 'idle', width: 14 },
    { header: 'Zamčeno min', key: 'locked', width: 12 },
    { header: 'Top aplikace', key: 'app', width: 18 },
    { header: 'Úhozy celkem', key: 'ks', width: 14 },
    { header: 'Pohyby myši', key: 'mouse', width: 14 },
    { header: 'Prům. úhozy/min', key: 'kpm', width: 16 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const r of rows) {
    const u = userMap.get(r.userId);
    ws.addRow({
      name: u?.displayName ?? r.userId,
      dept: u?.department ?? '',
      hour: r.hourStart.toISOString(),
      active: Math.round(r.activeMinutes * 10) / 10,
      idle: Math.round(r.idleMinutes * 10) / 10,
      locked: Math.round(r.lockedMinutes * 10) / 10,
      app: r.topApp ?? '',
      ks: r.keystrokeTotal,
      mouse: r.mouseTotal,
      kpm: Math.round(r.avgKpm),
    });
  }

  await logAccess(req.admin?.username ?? 'unknown', 'EXPORT', `hourly.xlsx ${from}..${to} rows=${rows.length}`);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="focus-hourly.xlsx"');
  await wb.xlsx.write(res);
  res.end();
});

/** Řádkový export syrových intervalů do .xlsx (detailní rozbor, kratší období). */
exportRouter.get('/intervals.xlsx', async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_query', detail: parsed.error.flatten() });
    return;
  }
  const { from, to, userId } = parsed.data;
  if (userId && !(await assertCanSeeUser(req, res, userId))) return;
  // Pro MANAGER bez userId omez výběr intervalů přes user.department in allowed.
  const scope = await getDeptScope(req);
  const scopeUserFilter = scope.unrestricted
    ? {}
    : { user: { department: { in: scope.allowed } } };

  const rows = await prisma.activityInterval.findMany({
    where: { ...(userId ? { userId } : {}), ...scopeUserFilter, intervalStart: { gte: new Date(from), lt: new Date(to) } },
    orderBy: { intervalStart: 'asc' },
    take: 100000,
    include: { user: { select: { displayName: true, department: true } } },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'FOCUS';
  const ws = wb.addWorksheet('Intervaly');
  ws.columns = [
    { header: 'Zaměstnanec', key: 'name', width: 24 },
    { header: 'Oddělení', key: 'dept', width: 16 },
    { header: 'Začátek (UTC)', key: 'start', width: 22 },
    { header: 'Délka s', key: 'len', width: 10 },
    { header: 'Aktivní s', key: 'active', width: 10 },
    { header: 'Nečinnost s', key: 'idle', width: 12 },
    { header: 'Aplikace', key: 'app', width: 18 },
    { header: 'Úhozy', key: 'ks', width: 10 },
    { header: 'Pohyby myši', key: 'mouse', width: 12 },
    { header: 'Zamčeno', key: 'locked', width: 10 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const r of rows) {
    ws.addRow({
      name: r.user.displayName ?? r.userId,
      dept: r.user.department ?? '',
      start: r.intervalStart.toISOString(),
      len: r.intervalSeconds,
      active: r.activeSeconds,
      idle: r.idleSeconds,
      app: r.foregroundApp ?? '',
      ks: r.keystrokeCount,
      mouse: r.mouseEvents,
      locked: r.sessionLocked ? 'ano' : 'ne',
    });
  }

  await logAccess(req.admin?.username ?? 'unknown', 'EXPORT', `intervals.xlsx ${from}..${to} rows=${rows.length}`);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="focus-intervals.xlsx"');
  await wb.xlsx.write(res);
  res.end();
});
