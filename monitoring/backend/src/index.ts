import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cron from 'node-cron';
import { config } from './config.js';
import { prisma } from './db.js';
import { ingestRouter } from './routes/ingest.js';
import { aggregateRecent } from './services/aggregate.js';
import { runRetention } from './jobs/retention.js';

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

app.use('/api/v1/ingest', ingestRouter);

// Dashboard API se doplní v Bloku 1.3.

const server = app.listen(config.port, () => {
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
}

async function shutdown() {
  for (const j of jobs) j.stop();
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
