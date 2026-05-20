import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

/** Konstantní-časové porovnání řetězců (ochrana proti timing útoku). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Autentizace agenta při ingestu sdíleným tokenem (Bearer), porovnání v
 * konstantním čase. Per-device tokeny / mTLS jsou na roadmapě.
 */
export function requireIngestToken(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || !safeEqual(token, config.ingestToken)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  next();
}
