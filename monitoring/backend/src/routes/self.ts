import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { requireIngestToken } from '../middleware/auth.js';
import { getSettings } from '../services/settings.js';
import { selfReport } from '../services/analytics.js';
import { getTips } from '../services/tips.js';

export const selfRouter = Router();

// Podpis tokenu HMAC-SHA256 sdíleným tajemstvím (ingest token). Token je vázaný
// na SID zaměstnance a má krátkou platnost → zaměstnanec vidí jen svá data.
function sign(payload: { sid: string; exp: number }): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', config.ingestToken).update(data).digest('base64url');
  return `${data}.${sig}`;
}
function verify(token: unknown): { sid: string; exp: number } | null {
  if (typeof token !== 'string') return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expSig = crypto.createHmac('sha256', config.ingestToken).update(data).digest('base64url');
  const a = Buffer.from(sig); const b = Buffer.from(expSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (typeof p.sid !== 'string' || typeof p.exp !== 'number' || p.exp < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}

/** Agent si vyžádá odkaz pro zaměstnance (autentizace ingest tokenem). */
selfRouter.post('/token', requireIngestToken, async (req, res) => {
  const sid = z.string().min(1).max(128).safeParse(req.body?.sid);
  if (!sid.success) return void res.status(400).json({ error: 'sid_required' });
  const { employeeReportEnabled } = await getSettings();
  if (!employeeReportEnabled) return void res.status(403).json({ error: 'disabled' });
  res.json({ token: sign({ sid: sid.data, exp: Date.now() + 12 * 60 * 60 * 1000 }) });
});

/** Zaměstnanecký report – jen vlastní data dle tokenu (žádné přihlášení do dashboardu). */
selfRouter.get('/report', async (req, res) => {
  const { employeeReportEnabled, funMode, healthMode, growthMode } = await getSettings();
  if (!employeeReportEnabled) return void res.status(403).json({ error: 'disabled' });
  const p = verify(req.query.token);
  if (!p) return void res.status(401).json({ error: 'invalid_token' });
  const user = await prisma.monitoredUser.findUnique({ where: { sid: p.sid }, select: { id: true } });
  if (!user) return void res.status(404).json({ error: 'not_found' });

  const toQ = z.string().datetime().safeParse(req.query.to);
  const fromQ = z.string().datetime().safeParse(req.query.from);
  const to = toQ.success ? new Date(toQ.data) : new Date();
  const from = fromQ.success ? new Date(fromQ.data) : new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);

  const [report, tips] = await Promise.all([selfReport(user.id, from, to), getTips()]);
  res.json({ report, tips, modes: { funMode, healthMode, growthMode } });
});

/** „Kdo se na moje data díval" – transparentní výpis pro zaměstnance (volitelná funkce). */
selfRouter.get('/audit', async (req, res) => {
  const { employeeReportEnabled, selfAuditEnabled } = await getSettings();
  if (!employeeReportEnabled) return void res.status(403).json({ error: 'disabled' });
  const p = verify(req.query.token);
  if (!p) return void res.status(401).json({ error: 'invalid_token' });
  if (!selfAuditEnabled) return void res.json({ enabled: false, rows: [] });
  const user = await prisma.monitoredUser.findUnique({ where: { sid: p.sid }, select: { id: true } });
  if (!user) return void res.status(404).json({ error: 'not_found' });
  const rows = await prisma.accessAudit.findMany({
    where: { viewedUserId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: { id: true, adminIdentity: true, action: true, detail: true, createdAt: true },
  });
  res.json({ enabled: true, rows });
});
