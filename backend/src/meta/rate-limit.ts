// Simple per-page token-bucket to stay within Graph API limits.
// Default: 180 calls/hour/page (conservative — Meta allows 200/user/hour).

const WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_MAX = 180;

interface Bucket {
  timestamps: number[];
  max: number;
}

const buckets = new Map<string, Bucket>();

export function takeSlot(pageId: string, max = DEFAULT_MAX): boolean {
  const now = Date.now();
  const bucket = buckets.get(pageId) ?? { timestamps: [], max };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < WINDOW_MS);
  if (bucket.timestamps.length >= bucket.max) {
    buckets.set(pageId, bucket);
    return false;
  }
  bucket.timestamps.push(now);
  buckets.set(pageId, bucket);
  return true;
}

export async function withBackoff<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const delay = Math.min(30_000, 1000 * 2 ** i);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
