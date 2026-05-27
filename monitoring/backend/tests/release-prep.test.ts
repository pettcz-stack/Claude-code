import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { ensureAdmin } from '../src/auth.js';

const app = createApp();
let bearer = '';

beforeAll(async () => {
  await ensureAdmin();
  const a = await request(app).post('/api/v1/login').send({ username: 'admin', password: 'test-pass' });
  bearer = 'Bearer ' + a.body.token;
  // Pre-seed device + user pro export/erase testy (test files běží paralelně,
  // takže nemůžeme předpokládat stav z integration.test.ts).
  await prisma.device.upsert({
    where: { machineId: 'TEST-EXPORT-PC' },
    create: { machineId: 'TEST-EXPORT-PC', hostname: 'export-pc' },
    update: {},
  });
  await prisma.monitoredUser.upsert({
    where: { sid: 'S-1-5-21-EXPORT-1' },
    create: { sid: 'S-1-5-21-EXPORT-1', displayName: 'Export Test', department: 'Vývoj' },
    update: {},
  });
});

// -----------------------------------------------------------------------------
// S4 – per-device enrollment tokeny
// -----------------------------------------------------------------------------

describe('per-device enrollment (S4)', () => {
  it('POST /api/v1/ingest/enroll s INGEST_TOKEN vrátí per-device token + ho zaregistruje', async () => {
    const res = await request(app)
      .post('/api/v1/ingest/enroll')
      .set('authorization', 'Bearer test-token')
      .send({ machineId: 'TEST-ENROLL-1', hostname: 'enroll-1', os: 'Windows 11', agentVersion: '0.2.1' });
    expect(res.status).toBe(200);
    expect(typeof res.body.deviceToken).toBe('string');
    expect(res.body.deviceToken.length).toBeGreaterThanOrEqual(32);

    // V DB má Device.enrollmentTokenHash uložený sha256 přesně toho tokenu
    const dev = await prisma.device.findUnique({ where: { machineId: 'TEST-ENROLL-1' } });
    expect(dev).toBeTruthy();
    expect(dev!.enrollmentTokenHash).toBeTruthy();

    // /ingest přijme per-device token (nemusí už používat sdílený INGEST_TOKEN)
    const ingest = await request(app)
      .post('/api/v1/ingest')
      .set('authorization', 'Bearer ' + res.body.deviceToken)
      .send({
        device: { machineId: 'TEST-ENROLL-1', hostname: 'enroll-1' },
        user: { sid: 'S-1-5-21-ENROLL-1', displayName: 'Enroll Test' },
        intervals: [],
      });
    expect(ingest.status).toBe(200);
  });

  it('opakovaný enroll generuje NOVÝ token (rotace) a starý přestane fungovat', async () => {
    const first = await request(app).post('/api/v1/ingest/enroll').set('authorization', 'Bearer test-token')
      .send({ machineId: 'TEST-ENROLL-ROTATE', hostname: 'rotate-pc' });
    const tokenA = first.body.deviceToken;

    const second = await request(app).post('/api/v1/ingest/enroll').set('authorization', 'Bearer test-token')
      .send({ machineId: 'TEST-ENROLL-ROTATE', hostname: 'rotate-pc' });
    const tokenB = second.body.deviceToken;
    expect(tokenB).not.toEqual(tokenA);

    // Starý token už nesedí na hashe v DB → 401
    const oldIngest = await request(app).post('/api/v1/ingest')
      .set('authorization', 'Bearer ' + tokenA)
      .send({ device: { machineId: 'TEST-ENROLL-ROTATE', hostname: 'rotate-pc' }, user: { sid: 'S-1-5-21-ROT', displayName: 'X' }, intervals: [] });
    expect(oldIngest.status).toBe(401);

    // Nový funguje
    const newIngest = await request(app).post('/api/v1/ingest')
      .set('authorization', 'Bearer ' + tokenB)
      .send({ device: { machineId: 'TEST-ENROLL-ROTATE', hostname: 'rotate-pc' }, user: { sid: 'S-1-5-21-ROT', displayName: 'X' }, intervals: [] });
    expect(newIngest.status).toBe(200);
  });

  it('enroll bez INGEST_TOKEN vrací 401', async () => {
    const res = await request(app).post('/api/v1/ingest/enroll').set('authorization', 'Bearer wrong')
      .send({ machineId: 'TEST-ENROLL-NOAUTH', hostname: 'x' });
    expect(res.status).toBe(401);
  });
});

// -----------------------------------------------------------------------------
// G1 – GDPR čl. 17 (výmaz) a čl. 20 (přenositelnost)
// -----------------------------------------------------------------------------

describe('GDPR export/erase (G1)', () => {
  it('GET /api/v1/admin/users/:id/export vrátí JSON dump + zaloguje EXPORT', async () => {
    const user = await prisma.monitoredUser.findFirst({ where: { sid: 'S-1-5-21-EXPORT-1' } });
    expect(user).toBeTruthy();
    const res = await request(app)
      .get(`/api/v1/admin/users/${user!.id}/export`)
      .set('authorization', bearer);
    expect(res.status).toBe(200);
    expect(res.body.schema).toBe('focus-user-export/v1');
    expect(res.body.user).toBeTruthy();
    expect(Array.isArray(res.body.activityIntervals)).toBe(true);
    expect(res.body.counts).toBeTruthy();

    const audit = await prisma.accessAudit.findFirst({
      where: { viewedUserId: user!.id, action: 'EXPORT' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).toBeTruthy();
    expect(audit!.adminId).toBeTruthy(); // immutable adminId vyplněn
  });

  it('DELETE /api/v1/admin/users/:id bez confirm vrátí 400', async () => {
    const user = await prisma.monitoredUser.findFirst({ where: { sid: 'S-1-5-21-EXPORT-1' } });
    const res = await request(app)
      .delete(`/api/v1/admin/users/${user!.id}`)
      .set('authorization', bearer);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('missing_confirm');
  });

  it('DELETE /api/v1/admin/users/:id?confirm=DELETE pseudonymizuje + smaže aktivity', async () => {
    // Vytvořím dedikovaného uživatele pro destruktivní test
    const u = await prisma.monitoredUser.create({
      data: { sid: 'S-1-5-21-TO-DELETE', displayName: 'K výmazu', department: 'Vývoj', hourlyRate: 500 },
    });
    // Pár aktivit, aby bylo co mazat
    const dev = await prisma.device.findFirst();
    await prisma.activityInterval.create({
      data: {
        deviceId: dev!.id, userId: u.id,
        intervalStart: new Date('2026-05-25T08:00:00.000Z'),
        intervalSeconds: 60, activeSeconds: 60, idleSeconds: 0,
        foregroundApp: 'code.exe', keystrokeCount: 100, mouseEvents: 30, sessionLocked: false,
      },
    });

    const res = await request(app)
      .delete(`/api/v1/admin/users/${u.id}?confirm=DELETE`)
      .set('authorization', bearer);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.deleted.activityIntervals).toBeGreaterThanOrEqual(1);

    // Profil pseudonymizován, ale řádek MonitoredUser stále existuje pro audit kontinuitu
    const after = await prisma.monitoredUser.findUnique({ where: { id: u.id } });
    expect(after).toBeTruthy();
    expect(after!.displayName).toBe('Smazaný uživatel');
    expect(after!.department).toBeNull();
    expect(after!.hourlyRate).toBeNull();
    expect(after!.active).toBe(false);
    expect(after!.sid.startsWith('deleted-')).toBe(true);

    // Aktivity vážně pryč
    const leftover = await prisma.activityInterval.count({ where: { userId: u.id } });
    expect(leftover).toBe(0);

    // Audit záznam o DELETE existuje a má immutable adminId
    const audit = await prisma.accessAudit.findFirst({ where: { viewedUserId: u.id, action: 'DELETE' } });
    expect(audit).toBeTruthy();
    expect(audit!.adminId).toBeTruthy();
  });

  it('GET /api/v1/admin/users/INVALID-ID vrátí 400 invalid_id (cuid validace)', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users/foo/export')
      .set('authorization', bearer);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_id');
  });
});

// -----------------------------------------------------------------------------
// S2 – session HttpOnly cookie + S6 security hlavičky
// -----------------------------------------------------------------------------

describe('session cookie + security headers (S2 + S6)', () => {
  it('login nastaví HttpOnly + SameSite=Strict cookie focus_session', async () => {
    const res = await request(app).post('/api/v1/login').send({ username: 'admin', password: 'test-pass' });
    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeTruthy();
    const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);
    expect(cookieStr).toMatch(/focus_session=/);
    expect(cookieStr).toMatch(/HttpOnly/);
    expect(cookieStr).toMatch(/SameSite=Strict/);
  });

  it('autorizace přes cookie funguje stejně jako Bearer', async () => {
    const login = await request(app).post('/api/v1/login').send({ username: 'admin', password: 'test-pass' });
    const cookies = login.headers['set-cookie'];
    const cookieHeader = Array.isArray(cookies) ? cookies.map((c) => c.split(';')[0]).join('; ') : String(cookies).split(';')[0];

    const res = await request(app).get('/api/v1/me').set('cookie', cookieHeader);
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('admin');
  });

  it('security hlavičky obsahují CSP a Referrer-Policy', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['content-security-policy']).toMatch(/default-src 'self'/);
    expect(res.headers['content-security-policy']).toMatch(/base-uri 'none'/);
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });
});

// -----------------------------------------------------------------------------
// /api/v1/metrics
// -----------------------------------------------------------------------------

describe('Prometheus /api/v1/metrics', () => {
  it('vrací text/plain s focus_* metrikami', async () => {
    // Vyvolej několik requestů, ať se čítače inkrementují
    await request(app).get('/api/v1/dashboard/users').set('authorization', bearer);

    const res = await request(app).get('/api/v1/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toMatch(/focus_http_requests_total/);
    expect(res.text).toMatch(/focus_devices_active/);
    expect(res.text).toMatch(/focus_users_total/);
    expect(res.text).toMatch(/focus_http_response_time_ms_bucket/);
  });
});
