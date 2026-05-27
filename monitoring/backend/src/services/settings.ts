import { prisma } from '../db.js';
import { config } from '../config.js';

export type DataMode = 'real' | 'demo' | 'both';

export type AppSettings = {
  alertsEnabled: boolean;
  alertRecipients: string[]; // e-maily pro upozornění
  offlineMinutes: number; // po kolika minutách bez dat hlásit „agent offline"
  funMode: boolean; // zábavný režim v reportu zaměstnance
  healthMode: boolean; // zdravotní režim (přestávky, pití, kalorie)
  growthMode: boolean; // rozvojový režim (moudra/citáty velikánů)
  interpretMonitors: boolean; // interpretace: doporučení druhého monitoru (nezasahuje do dat)
  employeeReportEnabled: boolean; // zpřístupnit report přímo zaměstnancům (ikonka v liště); default vyp.
  /**
   * Filtr dat v dashboardu:
   *   - 'real' = jen reálné záznamy (skrýt vše s `DEMO-PC-` / `S-1-5-21-DEMO-`)
   *   - 'demo' = jen ukázkové záznamy (pro demo investorovi / školení)
   *   - 'both' = obojí dohromady (default, vhodné pro vývoj / demo s real overlayem)
   */
  dataMode: DataMode;
  /** Legacy: showDemoDevices = (dataMode !== 'real'). Drží se kvůli starým API. */
  showDemoDevices: boolean;
  privacyStoreDomainOnly: boolean; // pro prohlížeč ukládat jen doménu místo titulku okna; default vyp.
  retentionDaysIntervals: number; // mazat syrové intervaly starší než N dní (agregáty zůstávají)
  selfAuditEnabled: boolean; // ukázat zaměstnanci panel „kdo se na moje data díval"; default vyp.
  // Tisk & USB monitoring (opt-in, GDPR rizika)
  printTrackingEnabled: boolean; // ingest /print akceptuje úlohy; default vyp.
  capturePrintDocName: boolean; // ukládat název dokumentu (citlivý údaj!); default vyp.
  usbTrackingEnabled: boolean; // ingest /usb akceptuje události; default vyp.
  captureUsbFilename: boolean; // ukládat název souboru (citlivý!); default vyp.
};

const KEYS = {
  enabled: 'alertsEnabled', recipients: 'alertRecipients', offline: 'offlineMinutes',
  fun: 'funMode', health: 'healthMode', growth: 'growthMode',
  interpretMon: 'interpretMonitors', empReport: 'employeeReportEnabled',
  dataMode: 'dataMode',
  showDemo: 'showDemoDevices', // legacy klíč, drží se pro migraci
  domainOnly: 'privacyStoreDomainOnly',
  retention: 'retentionDaysIntervals', selfAudit: 'selfAuditEnabled',
  printTrack: 'printTrackingEnabled', printDoc: 'capturePrintDocName',
  usbTrack: 'usbTrackingEnabled', usbName: 'captureUsbFilename',
};

function parseDataMode(raw: string | undefined, legacyShowDemo: string | undefined): DataMode {
  if (raw === 'real' || raw === 'demo' || raw === 'both') return raw;
  // Backward compat: pokud `dataMode` v DB ještě není, odvodíme z `showDemoDevices`.
  // showDemo=true → 'both', false → 'real'. Demo-only musí admin zapnout explicitně.
  if (legacyShowDemo === 'false') return 'real';
  return 'both';
}

export async function getSettings(): Promise<AppSettings> {
  const rows = await prisma.setting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const recipientsRaw = map.get(KEYS.recipients);
  const recipients = (recipientsRaw && recipientsRaw.length > 0 ? recipientsRaw.split(',') : config.report.recipients)
    .map((s) => s.trim())
    .filter(Boolean);

  const dataMode = parseDataMode(map.get(KEYS.dataMode), map.get(KEYS.showDemo));

  return {
    alertsEnabled: (map.get(KEYS.enabled) ?? 'true') !== 'false',
    alertRecipients: recipients,
    offlineMinutes: Number(map.get(KEYS.offline) ?? 20),
    funMode: (map.get(KEYS.fun) ?? 'false') === 'true',
    healthMode: (map.get(KEYS.health) ?? 'false') === 'true',
    growthMode: (map.get(KEYS.growth) ?? 'false') === 'true',
    interpretMonitors: (map.get(KEYS.interpretMon) ?? 'false') === 'true',
    employeeReportEnabled: (map.get(KEYS.empReport) ?? 'false') === 'true',
    dataMode,
    showDemoDevices: dataMode !== 'real',
    privacyStoreDomainOnly: (map.get(KEYS.domainOnly) ?? 'false') === 'true',
    // Default 30 dnů – kompromis mezi GDPR minimalizací (čl. 5/1/c) a auditní
    // historií. Agregáty (DailyStat, DailyAppStat) drží 540 dnů → roční přehled
    // skóre + Top apps bez surových titulků. Pro 1991 uživatelů to znamená cca
    // 7 GB SQLite místo 21 GB při 90 dnech. Admin může upravit v Settings.
    retentionDaysIntervals: Number(map.get(KEYS.retention) ?? 30),
    selfAuditEnabled: (map.get(KEYS.selfAudit) ?? 'false') === 'true',
    printTrackingEnabled: (map.get(KEYS.printTrack) ?? 'false') === 'true',
    capturePrintDocName: (map.get(KEYS.printDoc) ?? 'false') === 'true',
    usbTrackingEnabled: (map.get(KEYS.usbTrack) ?? 'false') === 'true',
    captureUsbFilename: (map.get(KEYS.usbName) ?? 'false') === 'true',
  };
}

export type SettingsPatch = Partial<{
  alertsEnabled: boolean; alertRecipients: string; offlineMinutes: number;
  funMode: boolean; healthMode: boolean; growthMode: boolean;
  interpretMonitors: boolean; employeeReportEnabled: boolean;
  dataMode: DataMode;
  showDemoDevices: boolean; // legacy, mapuje se na dataMode
  privacyStoreDomainOnly: boolean;
  retentionDaysIntervals: number; selfAuditEnabled: boolean;
  printTrackingEnabled: boolean; capturePrintDocName: boolean;
  usbTrackingEnabled: boolean; captureUsbFilename: boolean;
}>;

export async function saveSettings(s: SettingsPatch): Promise<void> {
  const ups: { key: string; value: string }[] = [];
  if (s.alertsEnabled !== undefined) ups.push({ key: KEYS.enabled, value: String(s.alertsEnabled) });
  if (s.alertRecipients !== undefined) ups.push({ key: KEYS.recipients, value: s.alertRecipients });
  if (s.offlineMinutes !== undefined) ups.push({ key: KEYS.offline, value: String(s.offlineMinutes) });
  if (s.funMode !== undefined) ups.push({ key: KEYS.fun, value: String(s.funMode) });
  if (s.healthMode !== undefined) ups.push({ key: KEYS.health, value: String(s.healthMode) });
  if (s.growthMode !== undefined) ups.push({ key: KEYS.growth, value: String(s.growthMode) });
  if (s.interpretMonitors !== undefined) ups.push({ key: KEYS.interpretMon, value: String(s.interpretMonitors) });
  if (s.employeeReportEnabled !== undefined) ups.push({ key: KEYS.empReport, value: String(s.employeeReportEnabled) });
  if (s.dataMode !== undefined) {
    ups.push({ key: KEYS.dataMode, value: s.dataMode });
    // Drž legacy klíč v sync (pro starý frontend nebo monitoring kódu).
    ups.push({ key: KEYS.showDemo, value: String(s.dataMode !== 'real') });
  } else if (s.showDemoDevices !== undefined) {
    // Legacy update – odvodíme dataMode.
    ups.push({ key: KEYS.showDemo, value: String(s.showDemoDevices) });
    ups.push({ key: KEYS.dataMode, value: s.showDemoDevices ? 'both' : 'real' });
  }
  if (s.privacyStoreDomainOnly !== undefined) ups.push({ key: KEYS.domainOnly, value: String(s.privacyStoreDomainOnly) });
  if (s.retentionDaysIntervals !== undefined) ups.push({ key: KEYS.retention, value: String(s.retentionDaysIntervals) });
  if (s.selfAuditEnabled !== undefined) ups.push({ key: KEYS.selfAudit, value: String(s.selfAuditEnabled) });
  if (s.printTrackingEnabled !== undefined) ups.push({ key: KEYS.printTrack, value: String(s.printTrackingEnabled) });
  if (s.capturePrintDocName !== undefined) ups.push({ key: KEYS.printDoc, value: String(s.capturePrintDocName) });
  if (s.usbTrackingEnabled !== undefined) ups.push({ key: KEYS.usbTrack, value: String(s.usbTrackingEnabled) });
  if (s.captureUsbFilename !== undefined) ups.push({ key: KEYS.usbName, value: String(s.captureUsbFilename) });
  for (const u of ups) {
    await prisma.setting.upsert({ where: { key: u.key }, create: u, update: { value: u.value } });
  }
}
