/**
 * Jednoduchá in-memory cache s krátkou platností (TTL) pro náročné read dotazy
 * dashboardu. Výrazně zrychlí proklikávání (stejné období/oddělení se nepočítá
 * znovu). Při zápisu dat (ingest) nebo změně nastavení se cache vyprázdní.
 */
type Entry = { exp: number; val: unknown };
const store = new Map<string, Entry>();
let inflight = new Map<string, Promise<unknown>>();

// Delší platnost je bezpečná: cache se vyprázdní při ingestu dat i změně
// nastavení, takže nikdy neukáže zastaralá data.
const DEFAULT_TTL = 5 * 60_000; // 5 min

/** Vrátí z cache, nebo spočítá přes fn a uloží. Sdílí i probíhající výpočet. */
export async function memo<T>(key: string, fn: () => Promise<T>, ttlMs = DEFAULT_TTL): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.exp > now) return hit.val as T;

  const running = inflight.get(key);
  if (running) return running as Promise<T>;

  const p = (async () => {
    try {
      const val = await fn();
      store.set(key, { exp: Date.now() + ttlMs, val });
      return val;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p as Promise<T>;
}

/** Vyprázdní celou cache (po ingestu dat / změně nastavení). */
export function clearCache(): void {
  store.clear();
  inflight = new Map();
}
