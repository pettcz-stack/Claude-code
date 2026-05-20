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
};
