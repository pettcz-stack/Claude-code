import { getSettings } from './settings.js';

/**
 * Demo data jsou identifikovaná patternem ze seedu:
 *  - MonitoredUser.sid začíná `S-1-5-21-DEMO-`
 *  - Device.machineId začíná `DEMO-PC-`
 * Pokud je v Nastavení vypnuté „zobrazovat demo zařízení", vrátíme filtr,
 * který tyhle záznamy vyloučí. Pokud je zapnuté (default), vrátíme `{}`.
 */
export async function demoUserWhere(): Promise<{ sid?: { not: { startsWith: string } } }> {
  const s = await getSettings();
  return s.showDemoDevices ? {} : { sid: { not: { startsWith: 'S-1-5-21-DEMO-' } } };
}

export async function demoDeviceWhere(): Promise<{ machineId?: { not: { startsWith: string } } }> {
  const s = await getSettings();
  return s.showDemoDevices ? {} : { machineId: { not: { startsWith: 'DEMO-PC-' } } };
}

/** Vrátí seznam ID demo uživatelů, kteří mají být skryti (prázdné, pokud zobrazit). */
export async function hiddenDemoUserIds(): Promise<string[] | null> {
  const s = await getSettings();
  if (s.showDemoDevices) return null; // null = nefiltrovat
  const { prisma } = await import('../db.js');
  const rows = await prisma.monitoredUser.findMany({ where: { sid: { startsWith: 'S-1-5-21-DEMO-' } }, select: { id: true } });
  return rows.map((r) => r.id);
}
