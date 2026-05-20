import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { prisma } from './db.js';
import { ingestRouter } from './routes/ingest.js';
import { dashboardRouter } from './routes/dashboard.js';
import { exportRouter } from './routes/export.js';
import { adminRouter } from './routes/admin.js';
import { requireAuth } from './auth.js';

/** Sestaví Express aplikaci (bez naslouchání) – sdílí index.ts i testy. */
export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/v1/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', db: 'up' });
    } catch {
      res.status(503).json({ status: 'degraded', db: 'down' });
    }
  });

  // Ingest má vlastní autentizaci (token agenta).
  app.use('/api/v1/ingest', ingestRouter);

  // Přihlášení dashboardu – ověří Basic auth a vrátí roli.
  app.get('/api/v1/me', requireAuth, (req, res) => {
    res.json({ username: req.admin?.username, role: req.admin?.role });
  });

  // Čtení dat a správa vyžaduje přihlášení (role uvnitř routerů).
  app.use('/api/v1/dashboard', requireAuth, dashboardRouter);
  app.use('/api/v1/export', requireAuth, exportRouter);
  app.use('/api/v1/admin', requireAuth, adminRouter);

  return app;
}
