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
import { pushEvent } from './services/eventLog.js';
import { httpRequests, httpErrors, observeResponseTime, renderMetrics } from './services/metrics.js';
import { selfRouter } from './routes/self.js';
import { requireAuth, login, destroySession, readSessionToken, SESSION_COOKIE } from './auth.js';

const isTest = process.env.NODE_ENV === 'test';

/** Sestaví Express aplikaci (bez naslouchání) – sdílí index.ts i testy. */
export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // za reverzní proxy (HTTPS terminace) – správné IP pro rate limit

  // Bezpečnostní hlavičky vč. konzervativní CSP pro servírovanou SPA.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"], // Tailwind/recharts inline styly
          'img-src': ["'self'", 'data:'],
          'connect-src': ["'self'"],
          'object-src': ["'none'"],
          'frame-ancestors': ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
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
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', db: 'up' });
    } catch {
      res.status(503).json({ status: 'degraded', db: 'down' });
    }
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
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
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

  app.post('/api/v1/logout', (req: Request, res: Response) => {
    const token = readSessionToken(req);
    if (token) destroySession(token);
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.get('/api/v1/me', requireAuth, (req: Request, res: Response) => {
    res.json({ username: req.admin?.username, role: req.admin?.role });
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
