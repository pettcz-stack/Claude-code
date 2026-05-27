import { getSettings } from './settings.js';
import { prisma } from '../db.js';

/**
 * Demo data jsou identifikovaná patternem ze seedu:
 *  - MonitoredUser.sid začíná `S-1-5-21-DEMO-`
 *  - Device.machineId začíná `DEMO-PC-`
 *
 * Settings.dataMode má 3 stavy:
 *  - 'both' (default) – {} (žádný filter)
 *  - 'real'           – vyloučí všechny DEMO záznamy
 *  - 'demo'           – ukáže POUZE DEMO záznamy (pro investorské demo / školení)
 */

/** Prisma where fragment pro MonitoredUser filter podle dataMode. */
export async function demoUserWhere(): Promise<{ sid?: { startsWith?: string; not?: { startsWith: string } } }> {
  const { dataMode } = await getSettings();
  if (dataMode === 'real') return { sid: { not: { startsWith: 'S-1-5-21-DEMO-' } } };
  if (dataMode === 'demo') return { sid: { startsWith: 'S-1-5-21-DEMO-' } };
  return {};
}

/** Prisma where fragment pro Device filter podle dataMode. */
export async function demoDeviceWhere(): Promise<{ machineId?: { startsWith?: string; not?: { startsWith: string } } }> {
  const { dataMode } = await getSettings();
  if (dataMode === 'real') return { machineId: { not: { startsWith: 'DEMO-PC-' } } };
  if (dataMode === 'demo') return { machineId: { startsWith: 'DEMO-PC-' } };
  return {};
}

/**
 * Vrátí seznam ID uživatelů, kteří mají být SKRYTÍ z dashboardu (kvůli
 * data mode filtru). Vrací:
 *   - null            – nefiltrovat (dataMode='both')
 *   - string[]        – tito uživatelé se neukáží
 *
 * Používá se v query, které nejdou snadno spojit s where klauzulí
 * (typicky raw SQL na PrintJob / UsbFileEvent).
 */
export async function hiddenDemoUserIds(): Promise<string[] | null> {
  const { dataMode } = await getSettings();
  if (dataMode === 'both') return null;
  if (dataMode === 'real') {
    const rows = await prisma.monitoredUser.findMany({
      where: { sid: { startsWith: 'S-1-5-21-DEMO-' } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
  // dataMode === 'demo': skryjeme všechny NE-demo uživatele
  const rows = await prisma.monitoredUser.findMany({
    where: { sid: { not: { startsWith: 'S-1-5-21-DEMO-' } } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
