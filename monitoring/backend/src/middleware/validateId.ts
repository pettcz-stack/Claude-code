import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

/**
 * Zod validátor pro Prisma cuid (default ID v naší schéma). Cuid má formát
 * `c<24 znaků a-z0-9>`. Slabší check `min(20).max(36)` zaručuje aspoň
 * sanity – odmítne prázdný string, super-dlouhý vstup nebo zjevné injection.
 *
 * Newer Prisma `cuid2` má jiný formát, takže neděláme striktní `^c\w{24}$`.
 */
const idSchema = z.string().min(20).max(36).regex(/^[a-zA-Z0-9_-]+$/, 'invalid_id');

/**
 * router.param callback – ověří hodnotu URL parametru jako cuid-like ID.
 * Použití:
 *   adminRouter.param('id', validateCuidParam);
 *   adminRouter.param('deviceId', validateCuidParam);
 * Bez validace by Prisma findUnique vrátil 500 / null a logoval stack –
 * tohle vrátí čistě 400 invalid_id ještě před vstupem do handleru.
 */
export function validateCuidParam(
  _req: Request,
  res: Response,
  next: NextFunction,
  value: string,
  name: string,
): void {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_id', param: name });
    return;
  }
  next();
}
