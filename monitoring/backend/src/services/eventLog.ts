/**
 * In-memory kruhový buffer posledních ~500 zajímavých událostí.
 * Slouží jako jednoduchý „diagnostický log" v dashboardu — admin se podívá,
 * vyfotí, pošle vývojáři. Vše zůstává jen v paměti procesu (zmizí restartem
 * kontejneru), takže neuchovává citlivá data déle, než je třeba.
 */

export type EventLevel = 'info' | 'warn' | 'error';

export interface AppEvent {
  ts: string; // ISO timestamp
  level: EventLevel;
  message: string;
  meta?: Record<string, unknown>;
}

const MAX = 500;
const buffer: AppEvent[] = [];

export function pushEvent(level: EventLevel, message: string, meta?: Record<string, unknown>): void {
  buffer.push({ ts: new Date().toISOString(), level, message, meta });
  if (buffer.length > MAX) buffer.splice(0, buffer.length - MAX);
}

/** Vrátí posledních `limit` událostí (nejnovější nahoře). */
export function recentEvents(limit = 100, levelFilter?: EventLevel): AppEvent[] {
  const src = levelFilter ? buffer.filter((e) => e.level === levelFilter) : buffer;
  return src.slice(-limit).reverse();
}

export function clearEvents(): void {
  buffer.length = 0;
}
