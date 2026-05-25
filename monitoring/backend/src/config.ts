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
  // Zapnutí plánovaných úloh (agregace doběhů + retence).
  enableJobs: (process.env.ENABLE_JOBS ?? 'true') !== 'false',
  // CORS: prázdné = žádný CORS (SPA je same-origin). Jinak konkrétní origin.
  corsOrigin: process.env.CORS_ORIGIN ?? '',
  nodeEnv: process.env.NODE_ENV ?? 'development',
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
    from: process.env.SMTP_FROM ?? 'device-monitor@firma.cz',
  },
  report: {
    recipients: (process.env.REPORT_RECIPIENTS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    cron: process.env.REPORT_CRON ?? '0 7 * * 1-5', // pracovní dny 07:00
    rangeDays: Number(process.env.REPORT_RANGE_DAYS ?? 1),
  },
};

export const smtpEnabled = () => config.smtp.host.length > 0 && config.report.recipients.length > 0;

/**
 * V produkci odmítne start se slabými výchozími tajemstvími (admin/admin,
 * dev-token). Brání nasazení s defaultními přihlašovacími údaji.
 */
export function assertProductionSecrets(): void {
  if (config.nodeEnv !== 'production') return;
  // Zástupné hodnoty z ukázkové konfigurace/compose – nesmí projít do provozu.
  const placeholders = ['zmente-me', 'zmeňte-me', 'change-me', 'changeme', 'tbd', 'xxx'];
  const weak: string[] = [];
  const pw = config.adminPassword.toLowerCase();
  const tok = config.ingestToken.toLowerCase();
  if (['admin', 'heslo', 'password', ''].includes(pw) || placeholders.includes(pw)) weak.push('ADMIN_PASSWORD');
  if (config.adminPassword.length < 10) weak.push('ADMIN_PASSWORD (min. 10 znaků)');
  if (['dev-token', '', 'token'].includes(tok) || placeholders.includes(tok)) weak.push('INGEST_TOKEN');
  if (weak.length > 0) {
    throw new Error('Odmítnut start v produkci se slabými tajemstvími: ' + weak.join(', '));
  }
}
