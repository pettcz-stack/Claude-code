import { prisma } from '../db.js';
import { config } from '../config.js';

export type AppSettings = {
  alertsEnabled: boolean;
  alertRecipients: string[]; // e-maily pro upozornění
  offlineMinutes: number; // po kolika minutách bez dat hlásit „agent offline"
  funMode: boolean; // zábavný režim v reportu zaměstnance
  healthMode: boolean; // zdravotní režim (přestávky, pití, kalorie)
};

const KEYS = { enabled: 'alertsEnabled', recipients: 'alertRecipients', offline: 'offlineMinutes', fun: 'funMode', health: 'healthMode' };

export async function getSettings(): Promise<AppSettings> {
  const rows = await prisma.setting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const recipientsRaw = map.get(KEYS.recipients);
  // Fallback na env REPORT_RECIPIENTS, dokud není v UI nastaveno.
  const recipients = (recipientsRaw && recipientsRaw.length > 0 ? recipientsRaw.split(',') : config.report.recipients)
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    alertsEnabled: (map.get(KEYS.enabled) ?? 'true') !== 'false',
    alertRecipients: recipients,
    offlineMinutes: Number(map.get(KEYS.offline) ?? 20),
    funMode: (map.get(KEYS.fun) ?? 'false') === 'true',
    healthMode: (map.get(KEYS.health) ?? 'false') === 'true',
  };
}

export async function saveSettings(s: Partial<{ alertsEnabled: boolean; alertRecipients: string; offlineMinutes: number; funMode: boolean; healthMode: boolean }>): Promise<void> {
  const ups: { key: string; value: string }[] = [];
  if (s.alertsEnabled !== undefined) ups.push({ key: KEYS.enabled, value: String(s.alertsEnabled) });
  if (s.alertRecipients !== undefined) ups.push({ key: KEYS.recipients, value: s.alertRecipients });
  if (s.offlineMinutes !== undefined) ups.push({ key: KEYS.offline, value: String(s.offlineMinutes) });
  if (s.funMode !== undefined) ups.push({ key: KEYS.fun, value: String(s.funMode) });
  if (s.healthMode !== undefined) ups.push({ key: KEYS.health, value: String(s.healthMode) });
  for (const u of ups) {
    await prisma.setting.upsert({ where: { key: u.key }, create: u, update: { value: u.value } });
  }
}
