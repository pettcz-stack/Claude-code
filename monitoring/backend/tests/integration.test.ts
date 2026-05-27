import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { ensureAdmin, hashPassword } from '../src/auth.js';

const app = createApp();
let bearer = '';
let viewerBearer = '';

const ingestPayload = (start: string) => ({
  device: { machineId: 'TEST-PC', hostname: 'test-pc', os: 'Windows 11', agentVersion: '0.1.0' },
  user: { sid: 'S-1-5-21-IT-1', displayName: 'IT Test', department: 'Vývoj' },
  intervals: [
    { intervalStart: start, intervalSeconds: 60, activeSeconds: 60, idleSeconds: 0, foregroundApp: 'code.exe', keystrokeCount: 300, mouseEvents: 80, sessionLocked: false },
    { intervalStart: new Date(new Date(start).getTime() + 60000).toISOString(), intervalSeconds: 60, activeSeconds: 30, idleSeconds: 30, foregroundApp: 'chrome.exe', keystrokeCount: 60, mouseEvents: 20, sessionLocked: false },
  ],
});

beforeAll(async () => {
  await ensureAdmin();
  // VIEWER účet pro test rolí
  await prisma.adminUser.upsert({
    where: { username: 'viewer' },
    update: {},
    create: { username: 'viewer', passwordHash: hashPassword('viewer-pass'), role: 'VIEWER' },
  });
  const a = await request(app).post('/api/v1/login').send({ username: 'admin', password: 'test-pass' });
  bearer = 'Bearer ' + a.body.token;
  const v = await request(app).post('/api/v1/login').send({ username: 'viewer', password: 'viewer-pass' });
  viewerBearer = 'Bearer ' + v.body.token;
});

describe('health', () => {
  it('vrací ok', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('login', () => {
  it('odmítne špatné heslo (401)', async () => {
    const res = await request(app).post('/api/v1/login').send({ username: 'admin', password: 'spatne' });
    expect(res.status).toBe(401);
  });
  it('vydá token a /me vrací roli', async () => {
    const me = await request(app).get('/api/v1/me').set('authorization', bearer);
    expect(me.status).toBe(200);
    expect(me.body.role).toBe('ADMIN');
  });
});

describe('ingest', () => {
  it('odmítne chybějící token (401)', async () => {
    const res = await request(app).post('/api/v1/ingest').send(ingestPayload('2026-05-20T08:00:00.000Z'));
    expect(res.status).toBe(401);
  });
  it('odmítne neplatný token (401)', async () => {
    const res = await request(app).post('/api/v1/ingest').set('authorization', 'Bearer spatny').send(ingestPayload('2026-05-20T08:00:00.000Z'));
    expect(res.status).toBe(401);
  });
  it('odmítne neplatný payload (400)', async () => {
    const res = await request(app).post('/api/v1/ingest').set('authorization', 'Bearer test-token').send({ foo: 'bar' });
    expect(res.status).toBe(400);
  });
  it('přijme dávku a je idempotentní', async () => {
    const payload = ingestPayload('2026-05-20T08:00:00.000Z');
    const r1 = await request(app).post('/api/v1/ingest').set('authorization', 'Bearer test-token').send(payload);
    expect(r1.status).toBe(200);
    expect(r1.body.accepted).toBe(2);
    await request(app).post('/api/v1/ingest').set('authorization', 'Bearer test-token').send(payload);
    const count = await prisma.activityInterval.count({
      where: { intervalStart: { gte: new Date('2026-05-20T08:00:00.000Z'), lt: new Date('2026-05-20T09:00:00.000Z') } },
    });
    expect(count).toBe(2);
  });
  it('správně spočítá hodinový agregát', async () => {
    const user = await prisma.monitoredUser.findUnique({ where: { sid: 'S-1-5-21-IT-1' } });
    const h = await prisma.activityHourly.findFirst({ where: { userId: user!.id, hourStart: new Date('2026-05-20T08:00:00.000Z') } });
    expect(h).toBeTruthy();
    expect(h!.activeMinutes).toBeCloseTo(1.5, 5);
    expect(h!.keystrokeTotal).toBe(360);
    expect(h!.topApp).toBe('code.exe');
  });
});

describe('autorizace', () => {
  it('chráněné endpointy bez tokenu vrací 401', async () => {
    for (const url of ['/api/v1/dashboard/users', '/api/v1/admin/devices', '/api/v1/export/hourly.xlsx?from=2026-05-20T00:00:00.000Z&to=2026-05-21T00:00:00.000Z']) {
      const res = await request(app).get(url);
      expect(res.status, url).toBe(401);
    }
  });
  it('s tokenem ADMIN čte uživatele', async () => {
    const res = await request(app).get('/api/v1/dashboard/users').set('authorization', bearer);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
  });
  it('VIEWER nesmí měnit kategorie (403), ADMIN smí (200)', async () => {
    const body = { appName: 'foo.exe', category: 'Test', type: 'WORK' };
    const v = await request(app).post('/api/v1/admin/categories').set('authorization', viewerBearer).send(body);
    expect(v.status).toBe(403);
    const a = await request(app).post('/api/v1/admin/categories').set('authorization', bearer).send(body);
    expect(a.status).toBe(200);
  });
});

describe('export', () => {
  it('vrátí .xlsx pro přihlášeného', async () => {
    const res = await request(app)
      .get('/api/v1/export/hourly.xlsx?from=2026-05-20T00:00:00.000Z&to=2026-05-21T00:00:00.000Z')
      .set('authorization', bearer);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
  });
});

describe('analytika (smoke)', () => {
  const range = 'from=2026-05-01T00:00:00.000Z&to=2026-06-01T00:00:00.000Z';

  it('overview vrací KPI strukturu', async () => {
    const res = await request(app).get(`/api/v1/dashboard/overview?${range}`).set('authorization', bearer);
    expect(res.status).toBe(200);
    expect(res.body.kpi).toBeTruthy();
    expect(typeof res.body.kpi.avgScore).toBe('number');
    expect(Array.isArray(res.body.departments)).toBe(true);
  });

  it('homeoffice, monitors, heatmap, trend, top-activities vrací 200', async () => {
    for (const url of ['homeoffice', 'monitors', 'heatmap', 'trend', 'top-activities']) {
      const res = await request(app).get(`/api/v1/dashboard/${url}?${range}`).set('authorization', bearer);
      expect(res.status, url).toBe(200);
    }
  });

  it('selfreport vrací percentily a fun metriky', async () => {
    const u = await prisma.monitoredUser.findUnique({ where: { sid: 'S-1-5-21-IT-1' } });
    const res = await request(app).get(`/api/v1/dashboard/selfreport?userId=${u!.id}&${range}`).set('authorization', bearer);
    expect(res.status).toBe(200);
    const r = res.body.report;
    expect(typeof r.companyPercentile).toBe('number');
    expect(typeof r.caloriesTyping).toBe('number');
    expect(typeof r.monitorTypical).toBe('number');
  });

  it('settings: lze zapnout fun/health režim', async () => {
    const res = await request(app).put('/api/v1/admin/settings').set('authorization', bearer).send({ funMode: true, healthMode: true });
    expect(res.status).toBe(200);
    expect(res.body.settings.funMode).toBe(true);
    expect(res.body.settings.healthMode).toBe(true);
  });
});

describe('MANAGER department scope (RBAC)', () => {
  let managerBearer = '';
  let managerUserId = '';
  const range = 'from=2026-05-01T00:00:00.000Z&to=2026-06-01T00:00:00.000Z';

  beforeAll(async () => {
    // Manager s přiřazením jen na oddělení "Marketing" – ten naše seed nemá,
    // takže manager neuvidí žádné uživatele.
    const m = await prisma.adminUser.upsert({
      where: { username: 'mgr-marketing' },
      update: {},
      create: { username: 'mgr-marketing', passwordHash: hashPassword('mgr-pass'), role: 'MANAGER' },
    });
    managerUserId = m.id;
    await prisma.adminUserDepartment.deleteMany({ where: { adminId: m.id } });
    await prisma.adminUserDepartment.create({ data: { adminId: m.id, department: 'Marketing' } });
    const login = await request(app).post('/api/v1/login').send({ username: 'mgr-marketing', password: 'mgr-pass' });
    managerBearer = 'Bearer ' + login.body.token;
  });

  it('MANAGER s ?department=Vývoj (nesvoje) dostane 403', async () => {
    const res = await request(app)
      .get(`/api/v1/dashboard/scoreboard?${range}&department=V%C3%BDvoj`)
      .set('authorization', managerBearer);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('department_not_allowed');
  });

  it('MANAGER bez ?department vidí pouze své oddělení (zde prázdné)', async () => {
    const res = await request(app)
      .get(`/api/v1/dashboard/scoreboard?${range}`)
      .set('authorization', managerBearer);
    expect(res.status).toBe(200);
    expect(res.body.rows.length).toBe(0); // Marketing nemá žádné usery v seedu
  });

  it('MANAGER nesmí číst score/integrity uživatele mimo své oddělení (403)', async () => {
    const u = await prisma.monitoredUser.findUnique({ where: { sid: 'S-1-5-21-IT-1' } });
    expect(u).toBeTruthy();
    for (const ep of ['score', 'integrity', 'selfreport', 'hourly']) {
      const res = await request(app)
        .get(`/api/v1/dashboard/${ep}?${range}&userId=${u!.id}`)
        .set('authorization', managerBearer);
      expect(res.status, ep).toBe(403);
      expect(res.body.error, ep).toBe('user_not_in_allowed_departments');
    }
  });

  it('MANAGER s ?department=Marketing (svoje) dostane 200 i prázdné výsledky', async () => {
    for (const ep of ['overview', 'scoreboard', 'trend', 'top-activities', 'monitors', 'homeoffice', 'software', 'alerts']) {
      const res = await request(app)
        .get(`/api/v1/dashboard/${ep}?${range}&department=Marketing`)
        .set('authorization', managerBearer);
      expect(res.status, ep).toBe(200);
    }
  });

  it('MANAGER bez přiřazených oddělení dostane 403', async () => {
    await prisma.adminUserDepartment.deleteMany({ where: { adminId: managerUserId } });
    const res = await request(app)
      .get(`/api/v1/dashboard/overview?${range}`)
      .set('authorization', managerBearer);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('no_departments_assigned');
    // Cleanup
    await prisma.adminUserDepartment.create({ data: { adminId: managerUserId, department: 'Marketing' } });
  });

  it('MANAGER vidí v /dashboard/users jen své oddělení', async () => {
    // Přidej do seedu Marketing usera, ať není seznam vždy prázdný.
    await prisma.monitoredUser.upsert({
      where: { sid: 'S-1-5-21-MKT-1' },
      update: { department: 'Marketing', active: true },
      create: { sid: 'S-1-5-21-MKT-1', displayName: 'Markéta Marketing', department: 'Marketing', active: true },
    });
    const res = await request(app).get('/api/v1/dashboard/users').set('authorization', managerBearer);
    expect(res.status).toBe(200);
    const depts = new Set((res.body.users as Array<{ department: string | null }>).map((u) => u.department));
    expect(depts.size).toBeLessThanOrEqual(1);
    if (depts.size === 1) expect([...depts][0]).toBe('Marketing');
  });

  it('ADMIN vidí všechna oddělení v /dashboard/users', async () => {
    const res = await request(app).get('/api/v1/dashboard/users').set('authorization', bearer);
    expect(res.status).toBe(200);
    const depts = new Set((res.body.users as Array<{ department: string | null }>).map((u) => u.department));
    expect(depts.size).toBeGreaterThanOrEqual(1);
  });
});
