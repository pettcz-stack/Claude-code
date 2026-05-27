import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from './db.js';
import { config } from './config.js';

export type AdminCtx = { id: string; username: string; role: string };

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

type Session = { id: string; username: string; role: string; expires: number };
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
  sessions.set(token, { id: user.id, username: user.username, role: user.role, expires: Date.now() + SESSION_TTL_MS });
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

/** Název HttpOnly cookie pro session. Stejný řetězec sdílí backend i frontend. */
export const SESSION_COOKIE = 'focus_session';

/** Vytáhne session token z HttpOnly cookie nebo (legacy) z Authorization headeru. */
export function readSessionToken(req: Request): string {
  const cookieHeader = req.header('cookie') ?? '';
  // Jednoduchý parse jednoho jmenovaného cookie – bez závislosti na cookie-parser.
  const match = new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`).exec(cookieHeader);
  if (match) return decodeURIComponent(match[1]);
  const header = req.header('authorization') ?? '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return '';
}

/** Autentizace primárně přes HttpOnly cookie, fallback Bearer header (legacy klienti). */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = readSessionToken(req);
  const s = token ? getSession(token) : null;
  if (!s) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  req.admin = { id: s.id, username: s.username, role: s.role };
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

/**
 * Zapíše záznam do auditu přístupů (GDPR čl. 32).
 *
 * Podporuje dvě volání:
 *   logAccess({ adminId, adminIdentity, action, detail, viewedUserId })  ← preferované
 *   logAccess(adminIdentity, action, detail, viewedUserId)               ← legacy
 *
 * `adminId` je cuid AdminUsera v okamžiku akce – po případném přejmenování
 * / smazání admina zůstane forenzně dohledatelné. `adminIdentity` (username
 * snapshot) je pro lidskou čitelnost.
 */
export async function logAccess(
  arg1: string | { adminId?: string; adminIdentity: string; action: string; detail: string; viewedUserId?: string },
  action?: string,
  detail?: string,
  viewedUserId?: string,
): Promise<void> {
  if (typeof arg1 === 'string') {
    await prisma.accessAudit.create({ data: { adminIdentity: arg1, action: action ?? 'UNKNOWN', detail: detail ?? '', viewedUserId } });
    return;
  }
  await prisma.accessAudit.create({
    data: {
      adminId: arg1.adminId,
      adminIdentity: arg1.adminIdentity,
      action: arg1.action,
      detail: arg1.detail,
      viewedUserId: arg1.viewedUserId,
    },
  });
}
