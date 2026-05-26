import { prisma } from '../db.js';
import { demoDeviceWhere } from './demoFilter.js';

export type DiskInfo = {
  name: string; // např. C:
  totalGB?: number;
  freeGB?: number;
  smartStatus?: 'OK' | 'WARN' | 'CRITICAL' | 'UNKNOWN';
  reallocSectors?: number;
  pendingSectors?: number;
  powerOnHours?: number;
  tempC?: number;
};

export type HealthPayload = {
  reportedAt?: string;
  osName?: string;
  osVersion?: string;
  uptimeSec?: number;
  manufacturer?: string;
  model?: string;
  serial?: string;
  biosVersion?: string;
  biosDate?: string;
  cpuModel?: string;
  cpuLoadPct?: number;
  ramTotalMB?: number;
  ramUsedPct?: number;
  batteryPresent?: boolean;
  batteryChargePct?: number;
  batteryHealthPct?: number;
  batteryCycles?: number;
  onAcPower?: boolean;
  disks?: DiskInfo[];
  antivirusEnabled?: boolean;
  antivirusUpdated?: boolean;
  pendingUpdates?: number;
  rebootPending?: boolean;
};

export type HealthStatus = 'OK' | 'WARN' | 'CRITICAL';

/** Spočítá stav + seznam hlášek pro IT podle dat ze snapshotu. */
export function computeHealthStatus(p: HealthPayload): { status: HealthStatus; issues: string[] } {
  const critical: string[] = [];
  const warn: string[] = [];

  // Disky – SMART a místo
  for (const d of p.disks ?? []) {
    const label = d.name || 'disk';
    if (d.smartStatus === 'CRITICAL') critical.push(`SMART KRITICKÝ na ${label}`);
    else if (d.smartStatus === 'WARN') warn.push(`SMART varování na ${label}`);
    if ((d.reallocSectors ?? 0) > 0) critical.push(`Realokované sektory (${d.reallocSectors}) na ${label} – vyměnit disk`);
    if ((d.pendingSectors ?? 0) > 0) critical.push(`Čekající vadné sektory (${d.pendingSectors}) na ${label}`);
    if ((d.tempC ?? 0) >= 60) warn.push(`Vysoká teplota disku ${label}: ${d.tempC} °C`);
    if (d.totalGB && d.freeGB !== undefined) {
      const usedPct = Math.round(((d.totalGB - d.freeGB) / d.totalGB) * 100);
      if (usedPct >= 95) critical.push(`Disk ${label} plný (${usedPct} %)`);
      else if (usedPct >= 85) warn.push(`Disk ${label} skoro plný (${usedPct} %)`);
    }
  }

  // Baterie
  if (p.batteryPresent) {
    if (p.batteryHealthPct !== undefined) {
      if (p.batteryHealthPct < 50) critical.push(`Baterie opotřebená (${p.batteryHealthPct} %) – vyměnit`);
      else if (p.batteryHealthPct < 70) warn.push(`Baterie opotřebená (${p.batteryHealthPct} %)`);
    }
    if ((p.batteryCycles ?? 0) > 1000) warn.push(`Vysoký počet nabíjecích cyklů (${p.batteryCycles})`);
  }

  // RAM
  if ((p.ramUsedPct ?? 0) >= 95) warn.push(`Paměť RAM plná (${p.ramUsedPct} %)`);

  // Bezpečnost
  if (p.antivirusEnabled === false) critical.push('Antivirus vypnutý');
  if (p.antivirusUpdated === false) warn.push('Antivirus má staré definice');
  if ((p.pendingUpdates ?? 0) >= 30) warn.push(`Čeká ${p.pendingUpdates} aktualizací – dlouho nerestartováno`);
  if (p.rebootPending) warn.push('Čeká restart kvůli aktualizacím');

  // BIOS stáří
  if (p.biosDate) {
    const ageDays = (Date.now() - new Date(p.biosDate).getTime()) / 86_400_000;
    if (ageDays > 365 * 5) warn.push(`Starý BIOS (${Math.round(ageDays / 365)} let) – zvážit aktualizaci`);
  }

  // Uptime přes 30 dní = většinou neaktualizovaná Windows
  if ((p.uptimeSec ?? 0) > 30 * 86400) warn.push(`Bez restartu ${Math.round((p.uptimeSec ?? 0) / 86400)} dní`);

  const status: HealthStatus = critical.length > 0 ? 'CRITICAL' : warn.length > 0 ? 'WARN' : 'OK';
  return { status, issues: [...critical, ...warn] };
}

/** Uloží snapshot (upsert podle deviceId), spočítá a uloží status. */
export async function saveHealthSnapshot(deviceId: string, payload: HealthPayload): Promise<void> {
  const { status, issues } = computeHealthStatus(payload);
  const reportedAt = payload.reportedAt ? new Date(payload.reportedAt) : new Date();
  const data = {
    deviceId,
    reportedAt,
    osName: payload.osName ?? null,
    osVersion: payload.osVersion ?? null,
    uptimeSec: payload.uptimeSec ?? null,
    manufacturer: payload.manufacturer ?? null,
    model: payload.model ?? null,
    serial: payload.serial ?? null,
    biosVersion: payload.biosVersion ?? null,
    biosDate: payload.biosDate ? new Date(payload.biosDate) : null,
    cpuModel: payload.cpuModel ?? null,
    cpuLoadPct: payload.cpuLoadPct ?? null,
    ramTotalMB: payload.ramTotalMB ?? null,
    ramUsedPct: payload.ramUsedPct ?? null,
    batteryPresent: payload.batteryPresent ?? false,
    batteryChargePct: payload.batteryChargePct ?? null,
    batteryHealthPct: payload.batteryHealthPct ?? null,
    batteryCycles: payload.batteryCycles ?? null,
    onAcPower: payload.onAcPower ?? null,
    disksJson: payload.disks ? JSON.stringify(payload.disks) : null,
    antivirusEnabled: payload.antivirusEnabled ?? null,
    antivirusUpdated: payload.antivirusUpdated ?? null,
    pendingUpdates: payload.pendingUpdates ?? null,
    rebootPending: payload.rebootPending ?? null,
    status,
    issuesJson: JSON.stringify(issues),
  };
  await prisma.deviceHealth.upsert({
    where: { deviceId },
    create: data,
    update: data,
  });
}

export type DeviceHealthRow = {
  deviceId: string;
  hostname: string;
  machineId: string;
  primaryUser: string | null; // jméno posledního uživatele, který na PC pracoval
  primaryDepartment: string | null;
  reportedAt: string | null;
  lastSeen: string | null;
  status: HealthStatus | 'UNREPORTED';
  issues: string[];
  // sumarizace pro list
  osName: string | null;
  manufacturer: string | null;
  model: string | null;
  batteryHealthPct: number | null;
  ramUsedPct: number | null;
  diskTopUsedPct: number | null;
  pendingUpdates: number | null;
  antivirusEnabled: boolean | null;
};

export type DeviceHealthDetail = DeviceHealthRow & {
  osVersion: string | null;
  uptimeSec: number | null;
  serial: string | null;
  biosVersion: string | null;
  biosDate: string | null;
  cpuModel: string | null;
  cpuLoadPct: number | null;
  ramTotalMB: number | null;
  batteryPresent: boolean;
  batteryChargePct: number | null;
  batteryCycles: number | null;
  onAcPower: boolean | null;
  disks: DiskInfo[];
  antivirusUpdated: boolean | null;
  rebootPending: boolean | null;
};

function diskTopUsed(disks: DiskInfo[] | null): number | null {
  if (!disks?.length) return null;
  let max = 0;
  for (const d of disks) {
    if (d.totalGB && d.freeGB !== undefined) {
      const u = Math.round(((d.totalGB - d.freeGB) / d.totalGB) * 100);
      if (u > max) max = u;
    }
  }
  return max || null;
}

/** Seznam pro IT dashboard. Vrací řazený seznam s nejhoršími nahoře. */
export async function listDeviceHealth(): Promise<DeviceHealthRow[]> {
  const devices = await prisma.device.findMany({
    where: { active: true, ...(await demoDeviceWhere()) },
    select: { id: true, hostname: true, machineId: true, lastSeen: true, health: true },
  });

  // Pro každý device najdi posledního aktivního uživatele – ať IT pozná, čí PC to je.
  // Hostname (DESKTOP-153334QF) sám o sobě nestačí, oddělení a jméno je užitečnější.
  const deviceIds = devices.map((d) => d.id);
  const latest = await prisma.activityInterval.groupBy({
    by: ['deviceId', 'userId'],
    where: { deviceId: { in: deviceIds } },
    _max: { intervalStart: true },
  });
  // Pro každé device si zvol userId s nejnovějším intervalem.
  const lastByDevice = new Map<string, { userId: string; ts: Date }>();
  for (const r of latest) {
    if (!r._max.intervalStart) continue;
    const cur = lastByDevice.get(r.deviceId);
    if (!cur || r._max.intervalStart > cur.ts) lastByDevice.set(r.deviceId, { userId: r.userId, ts: r._max.intervalStart });
  }
  const userIds = [...new Set([...lastByDevice.values()].map((v) => v.userId))];
  const users = userIds.length === 0 ? [] : await prisma.monitoredUser.findMany({
    where: { id: { in: userIds } },
    select: { id: true, displayName: true, department: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const rows: DeviceHealthRow[] = devices.map((d) => {
    const h = d.health;
    const disks = h?.disksJson ? (JSON.parse(h.disksJson) as DiskInfo[]) : null;
    const lastUser = lastByDevice.get(d.id);
    const u = lastUser ? userMap.get(lastUser.userId) : null;
    return {
      deviceId: d.id,
      hostname: d.hostname,
      machineId: d.machineId,
      primaryUser: u?.displayName ?? null,
      primaryDepartment: u?.department ?? null,
      lastSeen: d.lastSeen ? d.lastSeen.toISOString() : null,
      reportedAt: h?.reportedAt ? h.reportedAt.toISOString() : null,
      status: (h?.status as HealthStatus) ?? 'UNREPORTED',
      issues: h?.issuesJson ? (JSON.parse(h.issuesJson) as string[]) : [],
      osName: h?.osName ?? null,
      manufacturer: h?.manufacturer ?? null,
      model: h?.model ?? null,
      batteryHealthPct: h?.batteryHealthPct ?? null,
      ramUsedPct: h?.ramUsedPct ?? null,
      diskTopUsedPct: diskTopUsed(disks),
      pendingUpdates: h?.pendingUpdates ?? null,
      antivirusEnabled: h?.antivirusEnabled ?? null,
    };
  });
  const order: Record<DeviceHealthRow['status'], number> = { CRITICAL: 0, WARN: 1, UNREPORTED: 2, OK: 3 };
  rows.sort((a, b) => order[a.status] - order[b.status] || a.hostname.localeCompare(b.hostname));
  return rows;
}

export async function getDeviceHealthDetail(deviceId: string): Promise<DeviceHealthDetail | null> {
  const d = await prisma.device.findUnique({
    where: { id: deviceId },
    select: { id: true, hostname: true, machineId: true, lastSeen: true, health: true },
  });
  if (!d) return null;
  const h = d.health;
  const disks = h?.disksJson ? (JSON.parse(h.disksJson) as DiskInfo[]) : [];
  // Poslední aktivní uživatel na tomto PC (jméno + oddělení), ať IT ví, čí stroj to je.
  const lastInterval = await prisma.activityInterval.findFirst({
    where: { deviceId },
    orderBy: { intervalStart: 'desc' },
    select: { user: { select: { displayName: true, department: true } } },
  });
  return {
    deviceId: d.id,
    hostname: d.hostname,
    machineId: d.machineId,
    primaryUser: lastInterval?.user.displayName ?? null,
    primaryDepartment: lastInterval?.user.department ?? null,
    lastSeen: d.lastSeen ? d.lastSeen.toISOString() : null,
    reportedAt: h?.reportedAt ? h.reportedAt.toISOString() : null,
    status: (h?.status as HealthStatus) ?? 'UNREPORTED',
    issues: h?.issuesJson ? (JSON.parse(h.issuesJson) as string[]) : [],
    osName: h?.osName ?? null,
    osVersion: h?.osVersion ?? null,
    uptimeSec: h?.uptimeSec ?? null,
    manufacturer: h?.manufacturer ?? null,
    model: h?.model ?? null,
    serial: h?.serial ?? null,
    biosVersion: h?.biosVersion ?? null,
    biosDate: h?.biosDate ? h.biosDate.toISOString() : null,
    cpuModel: h?.cpuModel ?? null,
    cpuLoadPct: h?.cpuLoadPct ?? null,
    ramTotalMB: h?.ramTotalMB ?? null,
    ramUsedPct: h?.ramUsedPct ?? null,
    batteryPresent: h?.batteryPresent ?? false,
    batteryChargePct: h?.batteryChargePct ?? null,
    batteryHealthPct: h?.batteryHealthPct ?? null,
    batteryCycles: h?.batteryCycles ?? null,
    onAcPower: h?.onAcPower ?? null,
    disks,
    pendingUpdates: h?.pendingUpdates ?? null,
    antivirusEnabled: h?.antivirusEnabled ?? null,
    antivirusUpdated: h?.antivirusUpdated ?? null,
    rebootPending: h?.rebootPending ?? null,
    diskTopUsedPct: diskTopUsed(disks),
  };
}
