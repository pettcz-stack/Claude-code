import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { ensureAdmin } from '../src/auth.js';

const app = createApp();
const BASIC = 'Basic ' + Buffer.from('admin:test-pass').toString('base64');

const ingestPayload = (start: string) => ({
  device: { machineId: 'TEST-PC', hostname: 'test-pc', os: 'Windows 11', agentVersion: '0.1.0' },
  user: { sid: 'S-1-5-21-IT-1', displayName: 'IT Test', department: 'Vývoj' },
  intervals: [
    {
      intervalStart: start,
      intervalSeconds: 60,
      activeSeconds: 60,
      idleSeconds: 0,
      foregroundApp: 'code.exe',
      keystrokeCount: 300,
      mouseEvents: 80,
      sessionLocked: false,
    },
    {
      intervalStart: new Date(new Date(start).getTime() + 60000).toISOString(),
      intervalSeconds: 60,
      activeSeconds: 30,
      idleSeconds: 30,
      foregroundApp: 'chrome.exe',
      keystrokeCount: 60,
      mouseEvents: 20,
      sessionLocked: false,
    },
  ],
});

beforeAll(async () => {
  await ensureAdmin();
});

describe('health', () => {
  it('vrací ok', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('ingest', () => {
  it('odmítne chybějící token (401)', async () => {
    const res = await request(app).post('/api/v1/ingest').send(ingestPayload('2026-05-20T08:00:00.000Z'));
    expect(res.status).toBe(401);
  });

  it('přijme dávku se správným tokenem a je idempotentní', async () => {
    const payload = ingestPayload('2026-05-20T08:00:00.000Z');
    const r1 = await request(app)
      .post('/api/v1/ingest')
      .set('authorization', 'Bearer test-token')
      .send(payload);
    expect(r1.status).toBe(200);
    expect(r1.body.accepted).toBe(2);

    // znovu totéž – počet záznamů se nezmění
    await request(app).post('/api/v1/ingest').set('authorization', 'Bearer test-token').send(payload);
    const count = await prisma.activityInterval.count({
      where: { intervalStart: { gte: new Date('2026-05-20T08:00:00.000Z'), lt: new Date('2026-05-20T09:00:00.000Z') } },
    });
    expect(count).toBe(2);
  });

  it('správně spočítá hodinový agregát', async () => {
    const user = await prisma.monitoredUser.findUnique({ where: { sid: 'S-1-5-21-IT-1' } });
    const h = await prisma.activityHourly.findFirst({
      where: { userId: user!.id, hourStart: new Date('2026-05-20T08:00:00.000Z') },
    });
    expect(h).toBeTruthy();
    expect(h!.activeMinutes).toBeCloseTo(1.5, 5); // 60s + 30s
    expect(h!.keystrokeTotal).toBe(360);
    expect(h!.topApp).toBe('code.exe'); // 60s aktivní vs 30s
  });
});

describe('dashboard auth', () => {
  it('bez přihlášení 401', async () => {
    const res = await request(app).get('/api/v1/dashboard/users');
    expect(res.status).toBe(401);
  });

  it('s Basic auth vrací uživatele a roli', async () => {
    const me = await request(app).get('/api/v1/me').set('authorization', BASIC);
    expect(me.status).toBe(200);
    expect(me.body.role).toBe('ADMIN');

    const users = await request(app).get('/api/v1/dashboard/users').set('authorization', BASIC);
    expect(users.status).toBe(200);
    expect(Array.isArray(users.body.users)).toBe(true);
  });
});

describe('export', () => {
  it('vrátí .xlsx', async () => {
    const res = await request(app)
      .get('/api/v1/export/hourly.xlsx?from=2026-05-20T00:00:00.000Z&to=2026-05-21T00:00:00.000Z')
      .set('authorization', BASIC);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
  });
});
