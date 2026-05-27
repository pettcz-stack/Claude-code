import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 4000),
  defaultIntervalSeconds: Number(process.env.DEFAULT_INTERVAL_SECONDS ?? 60),
  databaseUrl: process.env.DATABASE_URL ?? 'file:./dev.db',
  // Sdílený token pro autentizaci agenta při ingestu (per-device tokeny přijdou v Bloku 1.7).
  ingestToken: process.env.INGEST_TOKEN ?? 'dev-token',
  // Retence (viz NAVRH.md §6, §14). Syrová data krátce, agregáty dlouho.
  rawRetentionDays: Number(process.env.RAW_RETENTION_DAYS ?? 35),
  hourlyRetentionDays: Number(process.env.HOURLY_RETENTION_DAYS ?? 540), // ~18 měsíců
  // Audit přístupů – kdo z adminů kdy nahlédl na data zaměstnance.
  // GDPR čl. 32: min. 12 měsíců pro doložení transparentnosti při kontrole.
  auditRetentionDays: Number(process.env.AUDIT_RETENTION_DAYS ?? 365),
  // Zapnutí plánovaných úloh (agregace doběhů + retence).
  enableJobs: (process.env.ENABLE_JOBS ?? 'true') !== 'false',
  // CORS: prázdné = žádný CORS (SPA je same-origin). Jinak konkrétní origin.
  corsOrigin: process.env.CORS_ORIGIN ?? '',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  // Demo data (HW snapshoty pro DEMO-PC-* zařízení) se backfillují JEN když je flag true.
  // V produkci nikdy nezapínat – kazí počty zařízení v dashboardu zákazníka.
  enableDemoData: (process.env.ENABLE_DEMO_DATA ?? 'false') === 'true',
  // Výchozí admin účet (vytvoří se jen pokud žádný neexistuje).
  adminUser: process.env.ADMIN_USER ?? 'admin',
  adminPassword: process.env.ADMIN_PASSWORD ?? 'admin',
  // Očekávaný pracovní fond pro výpočet skóre.
  expectedWorkHoursPerDay: Number(process.env.EXPECTED_WORK_HOURS ?? 8),
  // E-mailové reporty (Blok 1.8). Aktivní jen pokud je nastaven SMTP_HOST.
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: (process.env.SMTP_SECURE ?? 'false') === 'true',
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM ?? 'focus@firma.cz',
  },
  report: {
    recipients: (process.env.REPORT_RECIPIENTS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    cron: process.env.REPORT_CRON ?? '0 7 * * 1-5', // pracovní dny 07:00
    rangeDays: Number(process.env.REPORT_RANGE_DAYS ?? 1),
  },
};

export const smtpEnabled = () => config.smtp.host.length > 0 && config.report.recipients.length > 0;

/**
 * V produkci odmítne start s nebezpečnou konfigurací. Pokrývá:
 *  - slabé hesla / tokeny (admin/admin, dev-token)
 *  - placeholder hodnoty z ukázkového docker-compose
 *  - SQLite v produkci (single-file DB, žádné connection pooling, nešlo by za 100+ uživatelů)
 *  - CORS_ORIGIN=*  (kdokoli z internetu by mohl volat API)
 *  - ENABLE_DEMO_DATA=true (kazí počty zařízení a obsahuje vymyšlené uživatele)
 *  - SMTP bez TLS (SMTP_SECURE=false na portech ≠ 587 s STARTTLS = riziko)
 *
 * Brání tomu, aby admin při deploy přehlédl `.env` a pustil produkci s defaulty.
 */
export function assertProductionSecrets(): void {
  if (config.nodeEnv !== 'production') return;
  // Zástupné hodnoty z ukázkové konfigurace/compose – nesmí projít do provozu.
  const placeholders = ['zmente-me', 'zmeňte-me', 'change-me', 'changeme', 'tbd', 'xxx', '__set_before_first_run__'];
  const weak: string[] = [];
  const pw = config.adminPassword.toLowerCase();
  const tok = config.ingestToken.toLowerCase();

  // 1) Admin heslo
  if (['admin', 'heslo', 'password', ''].includes(pw) || placeholders.includes(pw)) weak.push('ADMIN_PASSWORD je default/placeholder');
  if (config.adminPassword.length < 10) weak.push('ADMIN_PASSWORD má < 10 znaků');

  // 2) Ingest token (sdílený s agenty)
  if (['dev-token', '', 'token'].includes(tok) || placeholders.includes(tok)) weak.push('INGEST_TOKEN je default/placeholder');
  if (config.ingestToken.length < 24) weak.push('INGEST_TOKEN má < 24 znaků (vygeneruj `openssl rand -hex 32`)');

  // 3) Demo data – pošpiňují produkční dashboard
  if (config.enableDemoData) weak.push('ENABLE_DEMO_DATA=true (v produkci nikdy)');

  // 4) SQLite v produkci – výkon a robustnost
  if (config.databaseUrl.startsWith('file:') || config.databaseUrl.includes('sqlite')) {
    weak.push('DATABASE_URL ukazuje na SQLite – v produkci použij PostgreSQL (postgresql://...)');
  }

  // 5) CORS wildcard – kdokoli může volat API z jakéhokoli originu
  if (config.corsOrigin === '*' || config.corsOrigin.includes(',*')) {
    weak.push('CORS_ORIGIN=* (otevřené pro celý internet) – nastav konkrétní origin');
  }

  // 6) SMTP bez TLS na portech kromě STARTTLS standard 587
  if (config.smtp.host && !config.smtp.secure && config.smtp.port !== 587 && config.smtp.port !== 25) {
    weak.push(`SMTP_SECURE=false na portu ${config.smtp.port} – pravděpodobně plain text login`);
  }

  if (weak.length > 0) {
    const msg = [
      '╔════════════════════════════════════════════════════════════════╗',
      '║ FOCUS backend ODMÍTÁ START V PRODUKCI – nebezpečná konfigurace ║',
      '╚════════════════════════════════════════════════════════════════╝',
      '',
      ...weak.map((w, i) => `  ${i + 1}. ${w}`),
      '',
      'Oprav .env nebo docker-compose.yml a restartuj.',
      'Pro vývoj / demo: NODE_ENV=development (kontrola se přeskočí).',
    ].join('\n');
    throw new Error(msg);
  }
}
