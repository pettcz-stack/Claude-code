import { prisma } from '../db.js';
import { config } from '../config.js';

export type AppSettings = {
  alertsEnabled: boolean;
  alertRecipients: string[]; // e-maily pro upozornění
  offlineMinutes: number; // po kolika minutách bez dat hlásit „agent offline"
  funMode: boolean; // zábavný režim v reportu zaměstnance
  healthMode: boolean; // zdravotní režim (přestávky, pití, kalorie)
  growthMode: boolean; // rozvojový režim (moudra/citáty velikánů)
  interpretMonitors: boolean; // interpretace: doporučení druhého monitoru (nezasahuje do dat)
  employeeReportEnabled: boolean; // zpřístupnit report přímo zaměstnancům (ikonka v liště); default vyp.
  showDemoDevices: boolean; // zobrazovat ukázková (demo) zařízení a uživatele; default zap.
};

const KEYS = { enabled: 'alertsEnabled', recipients: 'alertRecipients', offline: 'offlineMinutes', fun: 'funMode', health: 'healthMode', growth: 'growthMode', interpretMon: 'interpretMonitors', empReport: 'employeeReportEnabled', showDemo: 'showDemoDevices' };

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
    growthMode: (map.get(KEYS.growth) ?? 'false') === 'true',
    interpretMonitors: (map.get(KEYS.interpretMon) ?? 'false') === 'true',
    employeeReportEnabled: (map.get(KEYS.empReport) ?? 'false') === 'true',
    showDemoDevices: (map.get(KEYS.showDemo) ?? 'true') !== 'false',
  };
}

export async function saveSettings(s: Partial<{ alertsEnabled: boolean; alertRecipients: string; offlineMinutes: number; funMode: boolean; healthMode: boolean; growthMode: boolean; interpretMonitors: boolean; employeeReportEnabled: boolean; showDemoDevices: boolean }>): Promise<void> {
  const ups: { key: string; value: string }[] = [];
  if (s.alertsEnabled !== undefined) ups.push({ key: KEYS.enabled, value: String(s.alertsEnabled) });
  if (s.alertRecipients !== undefined) ups.push({ key: KEYS.recipients, value: s.alertRecipients });
  if (s.offlineMinutes !== undefined) ups.push({ key: KEYS.offline, value: String(s.offlineMinutes) });
  if (s.funMode !== undefined) ups.push({ key: KEYS.fun, value: String(s.funMode) });
  if (s.healthMode !== undefined) ups.push({ key: KEYS.health, value: String(s.healthMode) });
  if (s.growthMode !== undefined) ups.push({ key: KEYS.growth, value: String(s.growthMode) });
  if (s.interpretMonitors !== undefined) ups.push({ key: KEYS.interpretMon, value: String(s.interpretMonitors) });
  if (s.employeeReportEnabled !== undefined) ups.push({ key: KEYS.empReport, value: String(s.employeeReportEnabled) });
  if (s.showDemoDevices !== undefined) ups.push({ key: KEYS.showDemo, value: String(s.showDemoDevices) });
  for (const u of ups) {
    await prisma.setting.upsert({ where: { key: u.key }, create: u, update: { value: u.value } });
  }
}
