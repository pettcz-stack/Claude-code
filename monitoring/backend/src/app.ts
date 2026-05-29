import 'express-async-errors';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from './db.js';
import { config } from './config.js';
import { ingestRouter } from './routes/ingest.js';
import { dashboardRouter } from './routes/dashboard.js';
import { exportRouter } from './routes/export.js';
import { adminRouter } from './routes/admin.js';
import { accessRouter } from './routes/access.js';
import { pushEvent } from './services/eventLog.js';
import { httpRequests, httpErrors, observeResponseTime, renderMetrics } from './services/metrics.js';
import { selfRouter } from './routes/self.js';
import { requireAuth, login, destroySession, readSessionToken, SESSION_COOKIE } from './auth.js';
import { allowedDepartments, capabilities, type Role } from './services/accessControl.js';

const isTest = process.env.NODE_ENV === 'test';

/** Sestaví Express aplikaci (bez naslouchání) – sdílí index.ts i testy. */
export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // za reverzní proxy (HTTPS terminace) – správné IP pro rate limit

  // Bezpečnostní hlavičky vč. konzervativní CSP pro servírovanou SPA.
  // Žádné inline <script> v naší SPA → `script-src 'self'` bez `unsafe-inline`.
  // `style-src 'unsafe-inline'` ponecháno, protože recharts generuje inline
  // styly pro SVG transformace (nelze technicky vypnout); riziko CSS-injection
  // je proti XSS výrazně menší a chráníme se hodně tvrdými hlavičkami jinde.
  // `base-uri 'none'` zabraňuje <base href="..."> útoku na relativní URL.
  // `form-action 'self'` blokuje submit na cizí origin.
  // `upgrade-insecure-requests` přinutí prohlížeč automaticky upgradeovat
  // http → https i pro vložené prostředky (bez nutnosti HSTS preloadu).
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:'],
          'connect-src': ["'self'"],
          'object-src': ["'none'"],
          'frame-ancestors': ["'none'"],
          'base-uri': ["'none'"],
          'form-action': ["'self'"],
          ...(config.nodeEnv === 'production' ? { 'upgrade-insecure-requests': [] as string[] } : {}),
        },
      },
      crossOriginEmbedderPolicy: false,
      // HSTS pouze v production – v lokálním dev na http://localhost by
      // zaheslovala prohlížeč na https.
      hsts: config.nodeEnv === 'production' ? { maxAge: 31_536_000, includeSubDomains: true, preload: false } : false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  // CORS jen pokud je explicitně nastaven origin (jinak vůbec – SPA je same-origin,
  // agent není prohlížeč). Žádné "povol všem".
  if (config.corsOrigin) {
    app.use(cors({ origin: config.corsOrigin, credentials: true }));
  }

  app.use(express.json({ limit: '2mb' }));

  // HTTP access log – píše do stdout (`docker logs`) a chyby (4xx/5xx) navíc
  // do in-memory event logu pro „Diagnostický log" v Nastavení.
  app.use((req, res, next) => {
    if (req.path === '/api/v1/health' || req.path === '/api/v1/metrics') return next();
    const t0 = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - t0;
      observeResponseTime(ms);
      httpRequests.inc();
      if (res.statusCode >= 400) httpErrors.inc();
      const dev = (req.body && req.body.device && req.body.device.machineId) || '-';
      const line = `${req.method} ${req.path} ${res.statusCode} ${ms}ms dev=${dev}`;
      // eslint-disable-next-line no-console
      console.log(`${new Date().toISOString()} ${line}`);
      if (res.statusCode >= 400) {
        pushEvent(res.statusCode >= 500 ? 'error' : 'warn', line, {
          method: req.method, path: req.path, status: res.statusCode, ms, device: dev,
          ip: (req.headers['x-forwarded-for'] as string) || req.ip,
        });
      }
    });
    next();
  });

  app.get('/api/v1/health', async (_req, res) => {
    // Detailnější health odpověď – uptime monitoringy se na ni můžou opřít
    // jak v pohodě (status=ok) tak detekovat degradaci (db down, vysoký memory).
    const checks: Record<string, { status: 'up' | 'down' | 'warn'; detail?: string }> = {};
    let overall: 'ok' | 'degraded' = 'ok';
    // 1) DB ping
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.db = { status: 'up' };
    } catch (e) {
      checks.db = { status: 'down', detail: e instanceof Error ? e.message : 'unknown' };
      overall = 'degraded';
    }
    // 2) Memory: warn pokud heap používáme > 90 % heap_total (potenciální OOM)
    const mem = process.memoryUsage();
    const heapPct = mem.heapUsed / mem.heapTotal;
    checks.memory = {
      status: heapPct > 0.9 ? 'warn' : 'up',
      detail: `heap ${Math.round(mem.heapUsed / 1024 / 1024)}MB / ${Math.round(mem.heapTotal / 1024 / 1024)}MB (${Math.round(heapPct * 100)} %)`,
    };
    if (heapPct > 0.95) overall = 'degraded';
    // 3) Uptime sekundy procesu – užitečné pro debug ("backend right po restartu")
    const uptime = Math.round(process.uptime());
    res.status(overall === 'ok' ? 200 : 503).json({
      status: overall,
      uptime,
      version: process.env.npm_package_version ?? '0.9.1',
      checks,
    });
  });

  // Prometheus-style metrics. Žádná auth – záměrně (scrape by Prom server),
  // ALE musí být v privátní síti / blokované na reverse proxy pro externí
  // přístup. Doporučená caddy konfigurace v DEPLOY.md.
  app.get('/api/v1/metrics', async (_req, res) => {
    try {
      res.setHeader('Content-Type', 'text/plain; version=0.0.4');
      res.send(await renderMetrics());
    } catch {
      res.status(500).send('# metrics_unavailable\n');
    }
  });

  // --- Přihlášení (rate-limited proti brute-force) ---
  // OWASP doporučuje ≤ 5 pokusů / 15 min pro citlivé endpointy. Dříve max:20
  // (~1000 pokusů/den – brute-force 3-znakového hesla schůdný).
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTest,
    message: { error: 'too_many_attempts' },
  });
  // Session token zapisujeme do HttpOnly + Secure + SameSite=Strict cookie.
  // To znamená:
  //   - JS na stránce ji nikdy nepřečte (XSS = útočník vidí DOM, ne token).
  //   - Prohlížeč ji POŠLE jen v same-origin / first-party requestech
  //     (SameSite=Strict) → bez ručního CSRF tokenu se cookie nepřipojí
  //     k cross-origin POSTu z útočníkova webu.
  //   - Secure = nesmí přes HTTP. Pro lokální dev (HTTPS=off) se Secure
  //     vynechává, ať lze testovat na http://localhost.
  function setSessionCookie(res: Response, token: string) {
    const parts = [
      `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
      'HttpOnly',
      'SameSite=Strict',
      'Path=/',
      `Max-Age=${12 * 60 * 60}`,
    ];
    if (config.nodeEnv === 'production') parts.push('Secure');
    res.setHeader('Set-Cookie', parts.join('; '));
  }
  function clearSessionCookie(res: Response) {
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
  }

  app.post('/api/v1/login', loginLimiter, async (req: Request, res: Response) => {
    const { username, password } = (req.body ?? {}) as { username?: string; password?: string };
    if (!username || !password) {
      res.status(400).json({ error: 'missing_credentials' });
      return;
    }
    const result = await login(username, password);
    if (!result) {
      res.status(401).json({ error: 'invalid_credentials' });
      return;
    }
    setSessionCookie(res, result.token);
    // Token vracíme i v JSON tělě kvůli legacy / e2e testům, ale frontend
    // ho už neukládá – využívá HttpOnly cookie nastavený výše.
    res.json(result);
  });

  app.post('/api/v1/logout', async (req: Request, res: Response) => {
    const token = readSessionToken(req);
    if (token) await destroySession(token);
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.get('/api/v1/me', requireAuth, async (req: Request, res: Response) => {
    const role = req.admin?.role ?? 'VIEWER';
    const departments = await allowedDepartments(req.admin?.id ?? '', role as Role);
    // Načteme i UI preferences (viewMode) pro hydratu localStorage na frontendu
    const me = await prisma.adminUser.findUnique({
      where: { id: req.admin?.id ?? '' },
      select: { viewMode: true },
    });
    res.json({
      id: req.admin?.id,
      username: req.admin?.username,
      role,
      capabilities: capabilities(role),
      departments,
      preferences: { viewMode: me?.viewMode ?? 'pro' },
    });
  });

  // Per-account UI preferences (basic/pro view atd.). Bezpečnostně low-impact:
  // jen UI nastavení, žádný permission scope. Zapisuje se best-effort z fronty.
  app.patch('/api/v1/account/preferences', requireAuth, async (req: Request, res: Response) => {
    if (!req.admin?.id) { res.status(401).json({ error: 'unauthorized' }); return; }
    const vm = req.body?.viewMode;
    if (vm !== 'basic' && vm !== 'pro') { res.status(400).json({ error: 'invalid_viewMode' }); return; }
    await prisma.adminUser.update({ where: { id: req.admin.id }, data: { viewMode: vm } });
    res.json({ ok: true, viewMode: vm });
  });

  // --- Ingest (vlastní token agenta + jemné omezení četnosti) ---
  const ingestLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTest,
  });
  app.use('/api/v1/ingest', ingestLimiter, ingestRouter);

  // Zaměstnanecký self-service report (token vázaný na SID, ne dashboard login).
  // Rate limit chrání před brute-force tokenu i před hromadným scrapingem.
  const selfLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTest,
    message: { error: 'too_many_requests' },
  });
  app.use('/api/v1/self', selfLimiter, selfRouter);

  // --- Čtení dat a správa (session token, role uvnitř routerů) ---
  app.use('/api/v1/dashboard', requireAuth, dashboardRouter);
  app.use('/api/v1/export', requireAuth, exportRouter);
  app.use('/api/v1/admin', requireAuth, adminRouter);
  app.use('/api/v1/access', requireAuth, accessRouter);

  // Volitelně servíruje sestavený frontend (single-port nasazení).
  const distDir = path.resolve(process.cwd(), '../frontend/dist');
  if (fs.existsSync(path.join(distDir, 'index.html'))) {
    app.use(express.static(distDir));
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  // Generická chybová odpověď – nikdy neodhalí stack/detaily klientovi.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error('Neošetřená chyba:', msg);
    pushEvent('error', `Neošetřená chyba: ${msg}`, {
      path: req.path, method: req.method,
      stack: err instanceof Error ? err.stack?.split('\n').slice(0, 5).join(' | ') : undefined,
    });
    if (!res.headersSent) res.status(500).json({ error: 'server_error' });
  });

  return app;
}
