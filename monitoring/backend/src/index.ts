import cron from 'node-cron';
import { config, smtpEnabled, assertProductionSecrets } from './config.js';
import { prisma } from './db.js';
import { createApp } from './app.js';
import { aggregateRecent } from './services/aggregate.js';
import { runRetention } from './jobs/retention.js';
import { ensureAdmin, pruneExpiredSessions } from './auth.js';
import { ensureDefaultCategories } from './services/categories.js';
import { ensureDefaultWebRules } from './services/classify.js';
import { ensureDefaultTips } from './services/tips.js';
import { ensureDefaultSites } from './services/sites.js';
import { ensureDefaultDeptRules } from './services/deptrules.js';
import { ensureDemoDeviceHealth } from './services/healthDemo.js';
import { scheduleRetentionPruning } from './services/retention.js';
import { cq } from './services/cachedQueries.js';
import { floorToDay, addDays } from './services/tz.js';
import { sendReport } from './services/report.js';
import { runAlertChecks } from './services/alerts.js';

// V produkci odmítni start se slabými výchozími tajemstvími.
assertProductionSecrets();

const app = createApp();

const server = app.listen(config.port, async () => {
  await ensureAdmin();
  await ensureDefaultCategories();
  await ensureDefaultWebRules();
  await ensureDefaultTips();
  await ensureDefaultSites();
  await ensureDefaultDeptRules();
  if (config.enableDemoData) await ensureDemoDeviceHealth();
  scheduleRetentionPruning();
  // eslint-disable-next-line no-console
  console.log(`FOCUS backend naslouchá na portu ${config.port}`);
  // Předehřej cache pro výchozí období (poslední měsíc) → první načtení je rychlé.
  void warmCache();
  // Drž cache výchozího pohledu teplou (TTL 5 min) i pro pozdější první otevření.
  setInterval(() => void warmCache(), 4 * 60_000);
});

/** Výchozí období dashboardu (poslední 30 dní), shodné s frontendem. Místní čas (ČR). */
function defaultRange(): { from: string; to: string } {
  const today = floorToDay(new Date());
  const from = addDays(today, -29);
  const to = addDays(today, 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

async function warmCache(): Promise<void> {
  try {
    const { from, to } = defaultRange();
    await Promise.allSettled([
      cq.overview(from, to), cq.scoreboard(from, to), cq.monitors(from, to),
      cq.software(from, to), cq.homeoffice(from, to), cq.trend(from, to), cq.topact(from, to),
    ]);
    // eslint-disable-next-line no-console
    console.log('Cache předehřátá (výchozí období).');
  } catch { /* nepodstatné – cache se naplní při prvním požadavku */ }
}

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
        console.log(`Retence: ${r.intervals} intervalů, ${r.hourly} hodinových, ${r.daily} denních, ${r.dailyApps} app/den, ${r.audit} audit`);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('runRetention selhalo', e);
      }
    }),
  );
  // Lazy GC expirovaných admin sessions – jednou za hodinu.
  // Session se mažou i lazy při pokusu o použití, tohle jen drží tabulku štíhlou.
  jobs.push(
    cron.schedule('15 * * * *', async () => {
      try {
        const n = await pruneExpiredSessions();
        if (n > 0) console.log(`Session prune: smazáno ${n} expirovaných sessions`);
      } catch (e) {
        console.error('pruneExpiredSessions selhalo', e);
      }
    }),
  );
  // Kontrola upozornění (pirátské praktiky + výpadek agenta) – každých 15 minut.
  if (config.smtp.host) {
    jobs.push(
      cron.schedule('*/15 * * * *', async () => {
        try {
          const r = await runAlertChecks();
          if (r.integritySent || r.offlineSent) {
            // eslint-disable-next-line no-console
            console.log(`Upozornění odeslána: praktiky=${r.integritySent}, offline=${r.offlineSent}`);
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('runAlertChecks selhalo', e);
        }
      }),
    );
  }
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
