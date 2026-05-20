import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cron from 'node-cron';
import { config, smtpEnabled } from './config.js';
import { prisma } from './db.js';
import { sendReport } from './services/report.js';
import { ingestRouter } from './routes/ingest.js';
import { dashboardRouter } from './routes/dashboard.js';
import { exportRouter } from './routes/export.js';
import { adminRouter } from './routes/admin.js';
import { aggregateRecent } from './services/aggregate.js';
import { runRetention } from './jobs/retention.js';
import { ensureAdmin, requireAuth } from './auth.js';

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '4mb' }));

// Health/readiness – ověří i spojení s DB.
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

const server = app.listen(config.port, async () => {
  await ensureAdmin();
  // eslint-disable-next-line no-console
  console.log(`WorkView backend naslouchá na portu ${config.port}`);
});

const jobs: cron.ScheduledTask[] = [];
if (config.enableJobs) {
  // Doagregace pozdě doručených dat – každých 10 minut.
  jobs.push(
    cron.schedule('*/10 * * * *', async () => {
      try {
        await aggregateRecent(3);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('aggregateRecent selhalo', e);
      }
    }),
  );
  // Retence – jednou denně ve 3:30.
  jobs.push(
    cron.schedule('30 3 * * *', async () => {
      try {
        const r = await runRetention();
        // eslint-disable-next-line no-console
        console.log(`Retence: smazáno ${r.intervals} intervalů, ${r.hourly} agregátů`);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('runRetention selhalo', e);
      }
    }),
  );
  // E-mailový report – dle REPORT_CRON, jen pokud je nastaven SMTP.
  if (smtpEnabled()) {
    jobs.push(
      cron.schedule(config.report.cron, async () => {
        try {
          const r = await sendReport();
          // eslint-disable-next-line no-console
          console.log(`Report odeslán ${r.recipients} příjemcům (${r.rows} řádků)`);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('sendReport selhalo', e);
        }
      }),
    );
  }
}

async function shutdown() {
  for (const j of jobs) j.stop();
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
