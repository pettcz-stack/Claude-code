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
  await prisma.adminUser.create({
    data: { username: config.adminUser, passwordHash: hashPassword(config.adminPassword), role: 'ADMIN' },
  });
  // eslint-disable-next-line no-console
  console.log(`Vytvořen výchozí admin účet "${config.adminUser}" (změňte heslo přes ADMIN_PASSWORD).`);
}

// --- Session tokeny (po přihlášení) -------------------------------------------------
// Krátkodobé bezpečné tokeny v paměti. Scrypt se počítá jen 1× při přihlášení,
// ne na každý požadavek (ochrana proti DoS a standardní vzor).

type Session = { username: string; role: string; expires: number };
const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 h

function newToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** Ověří jméno/heslo a vydá session token. Vrací null při neúspěchu. */
export async function login(username: string, password: string): Promise<{ token: string; role: string; username: string } | null> {
  const user = await prisma.adminUser.findUnique({ where: { username } });
  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) return null;
  const token = newToken();
  sessions.set(token, { username: user.username, role: user.role, expires: Date.now() + SESSION_TTL_MS });
  return { token, role: user.role, username: user.username };
}

export function destroySession(token: string): void {
  sessions.delete(token);
}

function getSession(token: string): Session | null {
  const s = sessions.get(token);
  if (!s) return null;
  if (s.expires < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return s;
}

/** Autentizace přes Bearer session token. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const s = token ? getSession(token) : null;
  if (!s) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  req.admin = { username: s.username, role: s.role };
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
