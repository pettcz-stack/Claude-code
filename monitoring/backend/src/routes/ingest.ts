import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireIngestToken } from '../middleware/auth.js';
import { aggregateForIntervals } from '../services/aggregate.js';
import { clearCache } from '../services/cache.js';
import { getSettings } from '../services/settings.js';
import { saveHealthSnapshot } from '../services/health.js';

export const ingestRouter = Router();

const diskSchema = z.object({
  name: z.string().max(64),
  totalGB: z.number().nonnegative().optional(),
  freeGB: z.number().nonnegative().optional(),
  smartStatus: z.enum(['OK', 'WARN', 'CRITICAL', 'UNKNOWN']).optional(),
  reallocSectors: z.number().int().nonnegative().optional(),
  pendingSectors: z.number().int().nonnegative().optional(),
  powerOnHours: z.number().int().nonnegative().optional(),
  tempC: z.number().optional(),
});

const healthSchema = z.object({
  machineId: z.string().min(1).max(128),
  reportedAt: z.string().datetime().optional(),
  osName: z.string().max(64).optional(),
  osVersion: z.string().max(64).optional(),
  uptimeSec: z.number().int().nonnegative().optional(),
  manufacturer: z.string().max(128).optional(),
  model: z.string().max(128).optional(),
  serial: z.string().max(128).optional(),
  biosVersion: z.string().max(64).optional(),
  biosDate: z.string().datetime().optional(),
  cpuModel: z.string().max(128).optional(),
  cpuLoadPct: z.number().int().min(0).max(100).optional(),
  ramTotalMB: z.number().int().nonnegative().optional(),
  ramUsedPct: z.number().int().min(0).max(100).optional(),
  batteryPresent: z.boolean().optional(),
  batteryChargePct: z.number().int().min(0).max(100).optional(),
  batteryHealthPct: z.number().int().min(0).max(100).optional(),
  batteryCycles: z.number().int().nonnegative().optional(),
  onAcPower: z.boolean().optional(),
  disks: z.array(diskSchema).max(16).optional(),
  antivirusEnabled: z.boolean().optional(),
  antivirusUpdated: z.boolean().optional(),
  pendingUpdates: z.number().int().nonnegative().optional(),
  rebootPending: z.boolean().optional(),
});

/**
 * POST /api/v1/ingest/health
 * Agent posílá HW telemetrii (typicky 1× za hodinu / při bootu).
 * Server spočítá stav (OK/WARN/CRITICAL) a uloží jako poslední snapshot.
 */
export function registerHealthIngest(router: Router) {
  router.post('/health', requireIngestToken, async (req, res) => {
    const parsed = healthSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload', detail: parsed.error.flatten() });
      return;
    }
    const { machineId, ...payload } = parsed.data;
    const device = await prisma.device.findUnique({ where: { machineId }, select: { id: true } });
    if (!device) {
      res.status(404).json({ error: 'device_not_found' });
      return;
    }
    await saveHealthSnapshot(device.id, payload);
    res.json({ ok: true });
  });
}

const intervalSchema = z.object({
  intervalStart: z.string().datetime(),
  intervalSeconds: z.number().int().positive().max(3600).default(60),
  activeSeconds: z.number().int().min(0).max(3600),
  idleSeconds: z.number().int().min(0).max(3600),
  foregroundApp: z.string().max(260).optional(),
  windowTitle: z.string().max(512).optional(),
  appCategory: z.string().max(64).optional(),
  keystrokeCount: z.number().int().min(0),
  mouseEvents: z.number().int().min(0),
  sessionLocked: z.boolean().default(false),
  monitorCount: z.number().int().min(1).max(16).optional(),
  clientIp: z.string().max(45).optional(), // lokální privátní IPv4 fyz. adaptéru
});

const payloadSchema = z.object({
  device: z.object({
    machineId: z.string().min(1).max(128),
    hostname: z.string().max(255),
    os: z.string().max(128).optional(),
    agentVersion: z.string().max(64).optional(),
  }),
  user: z.object({
    sid: z.string().min(1).max(128),
    displayName: z.string().max(255).optional(),
    department: z.string().max(128).optional(),
  }),
  intervals: z.array(intervalSchema).min(1).max(1000),
});

/**
 * POST /api/v1/ingest
 * Agent posílá dávku intervalů. Idempotentní (unikát device+user+intervalStart).
 * Auto-enrollment zařízení a uživatele dle machineId / SID.
 */
ingestRouter.post('/', requireIngestToken, async (req, res) => {
  const parsed = payloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_payload', detail: parsed.error.flatten() });
    return;
  }
  const { device: d, user: u, intervals } = parsed.data;

  const device = await prisma.device.upsert({
    where: { machineId: d.machineId },
    create: { machineId: d.machineId, hostname: d.hostname, os: d.os, agentVersion: d.agentVersion, lastSeen: new Date() },
    update: { hostname: d.hostname, os: d.os, agentVersion: d.agentVersion, lastSeen: new Date() },
  });

  const user = await prisma.monitoredUser.upsert({
    where: { sid: u.sid },
    create: { sid: u.sid, displayName: u.displayName, department: u.department },
    update: {
      // Nepřepisuj ručně doplněné údaje prázdnými.
      ...(u.displayName ? { displayName: u.displayName } : {}),
      ...(u.department ? { department: u.department } : {}),
    },
  });

  let accepted = 0;
  const touched: { userId: string; intervalStart: Date }[] = [];
  for (const iv of intervals) {
    const intervalStart = new Date(iv.intervalStart);
    await prisma.activityInterval.upsert({
      where: {
        deviceId_userId_intervalStart: { deviceId: device.id, userId: user.id, intervalStart },
      },
      create: {
        deviceId: device.id,
        userId: user.id,
        intervalStart,
        intervalSeconds: iv.intervalSeconds,
        activeSeconds: iv.activeSeconds,
        idleSeconds: iv.idleSeconds,
        foregroundApp: iv.foregroundApp,
        windowTitle: iv.windowTitle,
        appCategory: iv.appCategory,
        keystrokeCount: iv.keystrokeCount,
        mouseEvents: iv.mouseEvents,
        sessionLocked: iv.sessionLocked,
        monitorCount: iv.monitorCount,
        clientIp: iv.clientIp,
      },
      update: {
        intervalSeconds: iv.intervalSeconds,
        activeSeconds: iv.activeSeconds,
        idleSeconds: iv.idleSeconds,
        foregroundApp: iv.foregroundApp,
        windowTitle: iv.windowTitle,
        appCategory: iv.appCategory,
        keystrokeCount: iv.keystrokeCount,
        mouseEvents: iv.mouseEvents,
        sessionLocked: iv.sessionLocked,
        monitorCount: iv.monitorCount,
        clientIp: iv.clientIp,
      },
    });
    accepted++;
    touched.push({ userId: user.id, intervalStart });
  }

  const hoursUpdated = await aggregateForIntervals(touched);
  clearCache(); // nová data → dashboard přepočítá

  // Agent podle toho zobrazí/skryje ikonku reportu zaměstnance v liště.
  const { employeeReportEnabled } = await getSettings();
  res.json({ accepted, hoursUpdated, deviceId: device.id, userId: user.id, employeeReportEnabled });
});

registerHealthIngest(ingestRouter);
