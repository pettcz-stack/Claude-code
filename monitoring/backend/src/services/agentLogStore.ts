/**
 * In-memory ring buffer log řádků z agentů, klíčovaný deviceId.
 * Slouží pro „Log agenta" panel v dashboardu (IT pohled → detail PC).
 *
 * Záznamy zmizí restartem kontejneru — neuchovávají se v DB, ať
 * nehromadíme citlivé operační detaily nad rámec nutného.
 */

export interface AgentLogLine {
  ts: string;       // ISO 8601 UTC od agenta
  message: string;
  receivedAt: string; // kdy to server přijal (pro detekci skew)
}

const MAX_PER_DEVICE = 300;
const store = new Map<string, AgentLogLine[]>();

export function appendAgentLog(deviceId: string, lines: { ts: string; message: string }[]): void {
  if (!lines.length) return;
  let buf = store.get(deviceId);
  if (!buf) { buf = []; store.set(deviceId, buf); }
  const now = new Date().toISOString();
  for (const l of lines) {
    if (typeof l?.message !== 'string' || typeof l?.ts !== 'string') continue;
    buf.push({ ts: l.ts, message: l.message.slice(0, 1000), receivedAt: now });
  }
  if (buf.length > MAX_PER_DEVICE) buf.splice(0, buf.length - MAX_PER_DEVICE);
}

export function getAgentLog(deviceId: string, limit = 200): AgentLogLine[] {
  const buf = store.get(deviceId) ?? [];
  return buf.slice(-limit).reverse(); // nejnovější nahoru
}
