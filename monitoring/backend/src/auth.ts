import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from './db.js';
import { config } from './config.js';

export type AdminCtx = { username: string; role: string };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AdminCtx;
    }
  }
}

/** scrypt hash ve formátu salt:hash (hex). Bez externích závislostí. */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const hash = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), 64);
  const expected = Buffer.from(hashHex, 'hex');
  return hash.length === expected.length && crypto.timingSafeEqual(hash, expected);
}

/** Vytvoří výchozího administrátora z env, pokud žádný účet neexistuje. */
export async function ensureAdmin(): Promise<void> {
  const count = await prisma.adminUser.count();
  if (count > 0) return;
  const username = config.adminUser;
  const password = config.adminPassword;
  await prisma.adminUser.create({
    data: { username, passwordHash: hashPassword(password), role: 'ADMIN' },
  });
  // eslint-disable-next-line no-console
  console.log(`Vytvořen výchozí admin účet "${username}" (změňte heslo přes ADMIN_PASSWORD).`);
}

/** HTTP Basic auth proti tabulce AdminUser. */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.header('authorization') ?? '';
  if (!header.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="WorkView"').status(401).json({ error: 'unauthorized' });
    return;
  }
  const [username, password] = Buffer.from(header.slice(6), 'base64').toString('utf8').split(':');
  const user = await prisma.adminUser.findUnique({ where: { username } });
  if (!user || !user.active || !verifyPassword(password ?? '', user.passwordHash)) {
    res.set('WWW-Authenticate', 'Basic realm="WorkView"').status(401).json({ error: 'unauthorized' });
    return;
  }
  req.admin = { username: user.username, role: user.role };
  next();
}

export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.admin?.role !== role) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    next();
  };
}

/** Zapíše záznam do auditu přístupů (GDPR). */
export async function logAccess(adminIdentity: string, action: string, detail: string, viewedUserId?: string) {
  await prisma.accessAudit.create({ data: { adminIdentity, action, detail, viewedUserId } });
}
