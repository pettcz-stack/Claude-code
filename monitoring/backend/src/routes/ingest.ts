import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireIngestToken } from '../middleware/auth.js';
import { aggregateForIntervals } from '../services/aggregate.js';
import { clearCache } from '../services/cache.js';

export const ingestRouter = Router();

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
      },
    });
    accepted++;
    touched.push({ userId: user.id, intervalStart });
  }

  const hoursUpdated = await aggregateForIntervals(touched);
  clearCache(); // nová data → dashboard přepočítá

  res.json({ accepted, hoursUpdated, deviceId: device.id, userId: user.id });
});
