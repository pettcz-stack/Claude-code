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
import { selfRouter } from './routes/self.js';
import { requireAuth, login, destroySession } from './auth.js';

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

  // Jednoduchý HTTP access log – píše do stdout (`docker logs`) pro diagnostiku
  // ingest požadavků (kdo, kdy, jaký status). Tichý pro /health, ať nezahltí log.
  app.use((req, res, next) => {
    if (req.path === '/api/v1/health') return next();
    const t0 = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - t0;
      const dev = (req.body && req.body.device && req.body.device.machineId) || '-';
      // eslint-disable-next-line no-console
      console.log(`${new Date().toISOString()} ${req.method} ${req.path} ${res.statusCode} ${ms}ms dev=${dev}`);
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

  // --- Přihlášení (rate-limited proti brute-force) ---
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTest,
    message: { error: 'too_many_attempts' },
  });
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
    res.json(result);
  });

  app.post('/api/v1/logout', (req: Request, res: Response) => {
    const header = req.header('authorization') ?? '';
    if (header.startsWith('Bearer ')) destroySession(header.slice(7));
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
  app.use('/api/v1/self', selfRouter);

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
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    // eslint-disable-next-line no-console
    console.error('Neošetřená chyba:', err instanceof Error ? err.message : err);
    if (!res.headersSent) res.status(500).json({ error: 'server_error' });
  });

  return app;
}
