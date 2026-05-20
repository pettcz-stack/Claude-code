import cron from 'node-cron';
import { config, smtpEnabled } from './config.js';
import { prisma } from './db.js';
import { createApp } from './app.js';
import { aggregateRecent } from './services/aggregate.js';
import { runRetention } from './jobs/retention.js';
import { ensureAdmin } from './auth.js';
import { ensureDefaultCategories } from './services/categories.js';
import { ensureDefaultWebRules } from './services/classify.js';
import { sendReport } from './services/report.js';

const app = createApp();

const server = app.listen(config.port, async () => {
  await ensureAdmin();
  await ensureDefaultCategories();
  await ensureDefaultWebRules();
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
