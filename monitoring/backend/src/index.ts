import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config.js';
import { prisma } from './db.js';

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Health/readiness – ověří i spojení s DB.
app.get('/api/v1/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'up' });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'down' });
  }
});

// Ingest a dashboard API se doplní v Bloku 1.2 a 1.3.

const server = app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`WorkView backend naslouchá na portu ${config.port}`);
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
