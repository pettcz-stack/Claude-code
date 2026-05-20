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
  // Výchozí admin účet (vytvoří se jen pokud žádný neexistuje).
  adminUser: process.env.ADMIN_USER ?? 'admin',
  adminPassword: process.env.ADMIN_PASSWORD ?? 'admin',
  // E-mailové reporty (Blok 1.8). Aktivní jen pokud je nastaven SMTP_HOST.
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: (process.env.SMTP_SECURE ?? 'false') === 'true',
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM ?? 'workview@firma.cz',
  },
  report: {
    recipients: (process.env.REPORT_RECIPIENTS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    cron: process.env.REPORT_CRON ?? '0 7 * * 1-5', // pracovní dny 07:00
    rangeDays: Number(process.env.REPORT_RANGE_DAYS ?? 1),
  },
};

export const smtpEnabled = () => config.smtp.host.length > 0 && config.report.recipients.length > 0;
