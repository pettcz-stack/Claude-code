import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';
import { prisma } from '../db.js';

/** Konstantní-časové porovnání řetězců (ochrana proti timing útoku). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Autentizace agenta sdíleným INGEST_TOKEN. Používá se POUZE pro enrollment
 * endpoint (POST /enroll), který agent volá při prvním běhu k získání
 * per-device tokenu. Pro běžný /ingest se používá requireIngestAuth.
 */
export function requireEnrollmentToken(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || !safeEqual(token, config.ingestToken)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  next();
}

/**
 * Autentizace agenta při ingestu. Akceptuje (v tomto pořadí):
 *  1) per-device token (preferované) – sha256(token) shodný s Device.enrollmentTokenHash
 *  2) sdílený INGEST_TOKEN (legacy) – pro starší agenty před v0.3 a pro úplně
 *     první ingest před dokončením enrollmentu.
 *
 * Po úspěchu cesty 1 vyplní req.deviceId / req.deviceMachineId (audit).
 * Cesta 2 nevyplňuje deviceId – routing si zařízení dohledá podle machineId
 * z payloadu.
 *
 * Roadmapa v0.4: cesta 2 přestane být povolená; INGEST_TOKEN bude scope-d
 * jen na /enroll. Tato dvojcesta umožňuje bezvýpadkovou migraci stávajících
 * nasazení (agenti se sami enrollnou při příští komunikaci).
 */
export async function requireIngestAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const hash = hashToken(token);
  const device = await prisma.device.findFirst({
    where: { enrollmentTokenHash: hash, active: true },
    select: { id: true, machineId: true },
  });
  if (device) {
    req.deviceId = device.id;
    req.deviceMachineId = device.machineId;
    return next();
  }
  if (safeEqual(token, config.ingestToken)) {
    return next();
  }
  res.status(401).json({ error: 'unauthorized' });
}

// Pro zpětnou kompatibilitu zachováme starý název jako alias na enrollment auth.
// Žádný stávající kód si nevšimne, ale jasně signalizujeme, že shared token
// je teď jen pro enrollment.
export const requireIngestToken = requireEnrollmentToken;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      deviceId?: string;
      deviceMachineId?: string;
    }
  }
}
