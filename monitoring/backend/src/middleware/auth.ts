import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

/**
 * Autentizace agenta při ingestu sdíleným tokenem (Bearer).
 * Per-device tokeny / mTLS přijdou v Bloku 1.7.
 */
export function requireIngestToken(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || token !== config.ingestToken) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  next();
}
