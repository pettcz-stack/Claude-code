import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireEnrollmentToken, requireIngestAuth, hashToken } from '../middleware/auth.js';
import { aggregateForIntervals } from '../services/aggregate.js';
import { clearCache } from '../services/cache.js';
import { getSettings } from '../services/settings.js';
import { saveHealthSnapshot } from '../services/health.js';
import { sanitizeWindowTitle } from '../services/domain.js';
import { appendAgentLog } from '../services/agentLogStore.js';

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
  router.post('/health', requireIngestAuth, async (req, res) => {
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
  // Prázdné pole je povolené – agent posílá hned po startu „heartbeat",
  // aby se zařízení a uživatel zaregistrovali v dashboardu ihned, ne až po
  // prvním 60s intervalu aktivity.
  intervals: z.array(intervalSchema).max(1000),
  // Agent v dávce posílá i své vlastní log řádky pro zobrazení v dashboardu.
  agentLog: z.array(z.object({ ts: z.string(), message: z.string().max(1000) })).max(500).optional(),
});

/**
 * POST /api/v1/ingest
 * Agent posílá dávku intervalů. Idempotentní (unikát device+user+intervalStart).
 * Auto-enrollment zařízení a uživatele dle machineId / SID.
 */
/**
 * POST /api/v1/ingest/enroll
 *
 * Agent při prvním běhu pošle sdílený INGEST_TOKEN a svůj machineId/hostname.
 * Server vygeneruje per-device token, uloží jeho sha256 hash do Device a token
 * vrátí. Agent ho uloží do registry (DeviceToken) a všechny další /ingest
 * volání už autentizuje per-device tokenem.
 *
 * Idempotentní: opakované volání pro stejné machineId vygeneruje NOVÝ token
 * (rotace). Starý automaticky přestane fungovat.
 */
const enrollSchema = z.object({
  machineId: z.string().min(1).max(128),
  hostname: z.string().max(255),
  os: z.string().max(128).optional(),
  agentVersion: z.string().max(64).optional(),
});
ingestRouter.post('/enroll', requireEnrollmentToken, async (req, res) => {
  const parsed = enrollSchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: 'invalid_payload' });
  const { machineId, hostname, os, agentVersion } = parsed.data;
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  await prisma.device.upsert({
    where: { machineId },
    create: { machineId, hostname, os, agentVersion, enrollmentTokenHash: tokenHash },
    update: { hostname, os, agentVersion, enrollmentTokenHash: tokenHash, active: true },
  });
  res.json({ deviceToken: token });
});

ingestRouter.post('/', requireIngestAuth, async (req, res) => {
  const parsed = payloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_payload', detail: parsed.error.flatten() });
    return;
  }
  const { device: d, user: u, intervals, agentLog } = parsed.data;

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
  const { privacyStoreDomainOnly } = await getSettings();
  for (const iv of intervals) {
    const intervalStart = new Date(iv.intervalStart);
    const storedTitle = sanitizeWindowTitle(iv.foregroundApp, iv.windowTitle, privacyStoreDomainOnly);
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
        windowTitle: storedTitle,
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
        windowTitle: storedTitle,
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
  // Přibaleny log řádky z agenta – uložíme do in-memory storu pro „Log agenta" panel.
  if (agentLog && agentLog.length > 0) {
    appendAgentLog(device.id, agentLog);
  }

  const { employeeReportEnabled } = await getSettings();
  res.json({ accepted, hoursUpdated, deviceId: device.id, userId: user.id, employeeReportEnabled });
});

registerHealthIngest(ingestRouter);

// -----------------------------------------------------------------------------
// /api/v1/ingest/print – tiskové úlohy
// -----------------------------------------------------------------------------

const printJobSchema = z.object({
  jobAt: z.string().datetime(),
  printerName: z.string().max(255).optional(),
  documentName: z.string().max(500).optional(), // jen pokud agent má capturePrintDocName
  pages: z.number().int().min(0).max(100000).default(1),
  copies: z.number().int().min(0).max(10000).default(1),
  paperSize: z.string().max(32).optional(),
  color: z.boolean().optional(),
  duplex: z.boolean().optional(),
  sizeBytes: z.number().int().min(0).optional(),
});

const printPayloadSchema = z.object({
  machineId: z.string().min(1).max(128),
  sid: z.string().min(1).max(128).optional(),
  jobs: z.array(printJobSchema).max(500),
});

ingestRouter.post('/print', requireIngestAuth, async (req, res) => {
  const parsed = printPayloadSchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: 'invalid_payload' });
  const settings = await getSettings();
  if (!settings.printTrackingEnabled) return void res.json({ ok: true, skipped: 'feature_disabled' });

  const device = await prisma.device.findUnique({ where: { machineId: parsed.data.machineId }, select: { id: true } });
  if (!device) return void res.status(404).json({ error: 'device_not_found' });
  const user = parsed.data.sid
    ? await prisma.monitoredUser.findUnique({ where: { sid: parsed.data.sid }, select: { id: true } })
    : null;

  // Pokud admin v Settings vypnul capturePrintDocName, agent sice mohl jméno
  // poslat (ze starší konfigurace), ale my ho na serveru NEULOŽÍME.
  // Server-side enforcement zabraňuje úniku jména přes „zastaralý" agent.
  const stripDocName = !settings.capturePrintDocName;

  let accepted = 0;
  for (const j of parsed.data.jobs) {
    try {
      await prisma.printJob.create({
        data: {
          deviceId: device.id,
          userId: user?.id ?? null,
          printerName: j.printerName ?? null,
          documentName: stripDocName ? null : (j.documentName ?? null),
          pages: j.pages,
          copies: j.copies,
          paperSize: j.paperSize ?? null,
          color: j.color ?? null,
          duplex: j.duplex ?? null,
          sizeBytes: j.sizeBytes ?? null,
          jobAt: new Date(j.jobAt),
        },
      });
      accepted++;
    } catch { /* idempotence není kritická pro print logy */ }
  }
  res.json({ ok: true, accepted });
});

// -----------------------------------------------------------------------------
// /api/v1/ingest/usb – události na USB / removable discích
// -----------------------------------------------------------------------------

const usbEventSchema = z.object({
  eventAt: z.string().datetime(),
  action: z.enum(['CREATE', 'WRITE', 'DELETE', 'RENAME', 'READ']),
  driveLetter: z.string().max(8).optional(),
  driveLabel: z.string().max(255).optional(),
  fileName: z.string().max(500).optional(), // jen pokud captureUsbFilename
  fileExt: z.string().max(16).optional(),
  sizeBytes: z.union([z.number(), z.string()]).optional().transform((v) => {
    if (v === undefined) return undefined;
    if (typeof v === 'string') return BigInt(v);
    return BigInt(Math.max(0, Math.floor(v)));
  }),
});

const usbPayloadSchema = z.object({
  machineId: z.string().min(1).max(128),
  sid: z.string().min(1).max(128).optional(),
  events: z.array(usbEventSchema).max(1000),
});

ingestRouter.post('/usb', requireIngestAuth, async (req, res) => {
  const parsed = usbPayloadSchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: 'invalid_payload' });
  const settings = await getSettings();
  if (!settings.usbTrackingEnabled) return void res.json({ ok: true, skipped: 'feature_disabled' });

  const device = await prisma.device.findUnique({ where: { machineId: parsed.data.machineId }, select: { id: true } });
  if (!device) return void res.status(404).json({ error: 'device_not_found' });
  const user = parsed.data.sid
    ? await prisma.monitoredUser.findUnique({ where: { sid: parsed.data.sid }, select: { id: true } })
    : null;

  const stripName = !settings.captureUsbFilename;
  let accepted = 0;
  for (const e of parsed.data.events) {
    try {
      await prisma.usbFileEvent.create({
        data: {
          deviceId: device.id,
          userId: user?.id ?? null,
          action: e.action,
          driveLetter: e.driveLetter ?? null,
          driveLabel: e.driveLabel ?? null,
          fileName: stripName ? null : (e.fileName ?? null),
          fileExt: e.fileExt ?? null,
          sizeBytes: e.sizeBytes ?? null,
          eventAt: new Date(e.eventAt),
        },
      });
      accepted++;
    } catch { /* ignoruj duplicity */ }
  }
  res.json({ ok: true, accepted });
});
