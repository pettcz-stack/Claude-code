import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 4000),
  defaultIntervalSeconds: Number(process.env.DEFAULT_INTERVAL_SECONDS ?? 60),
  databaseUrl: process.env.DATABASE_URL ?? 'file:./dev.db',
};
