import { prisma } from '../db.js';
import { saveHealthSnapshot, type HealthPayload, type DiskInfo } from './health.js';

/**
 * Vygeneruje realistické HW snapshoty pro demo zařízení (machineId začíná DEMO-PC-).
 * Spouští se při startu, pokud DeviceHealth ještě nemá záznamy a demo zařízení existují.
 * Variabilita: většina OK, ~15 % varování, ~5 % kritických – aby IT dashboard ukázal mix.
 */
export async function ensureDemoDeviceHealth(): Promise<void> {
  const existing = await prisma.deviceHealth.count();
  if (existing > 0) return;
  const demo = await prisma.device.findMany({
    where: { machineId: { startsWith: 'DEMO-PC-' } },
    select: { id: true, machineId: true, hostname: true },
  });
  if (demo.length === 0) return;

  const cpuModels = ['Intel Core i5-1145G7', 'Intel Core i7-12700H', 'AMD Ryzen 5 PRO 5650U', 'Intel Core i5-8265U', 'Intel Core i7-1165G7'];
  const makers = ['Dell', 'Lenovo', 'HP', 'Lenovo', 'Dell'];
  const models = ['Latitude 5520', 'ThinkPad T14', 'EliteBook 840 G8', 'ThinkPad X1 Carbon Gen 11', 'OptiPlex 7090'];

  for (let i = 0; i < demo.length; i++) {
    const d = demo[i];
    const bucket = Math.random();
    const profile: 'CRIT' | 'WARN' | 'OK' = bucket < 0.05 ? 'CRIT' : bucket < 0.2 ? 'WARN' : 'OK';
    const isLaptop = i % 3 !== 0; // ~2/3 notebooky

    const disks: DiskInfo[] = [{
      name: 'C:',
      totalGB: 512,
      freeGB: profile === 'CRIT' ? 12 : profile === 'WARN' ? 60 : 180 + Math.floor(Math.random() * 200),
      smartStatus: profile === 'CRIT' && Math.random() < 0.5 ? 'CRITICAL' : 'OK',
      reallocSectors: profile === 'CRIT' && Math.random() < 0.5 ? 5 + Math.floor(Math.random() * 20) : 0,
      pendingSectors: 0,
      powerOnHours: 8000 + Math.floor(Math.random() * 20000),
      tempC: 35 + Math.floor(Math.random() * 20),
    }];

    const biosAge = profile === 'WARN' && Math.random() < 0.5 ? 6 : 1 + Math.random() * 3; // roky
    const biosDate = new Date(Date.now() - biosAge * 365 * 86400 * 1000).toISOString();

    const payload: HealthPayload = {
      osName: 'Windows 11 Pro',
      osVersion: '23H2',
      uptimeSec: profile === 'WARN' && Math.random() < 0.4 ? 45 * 86400 : Math.floor(Math.random() * 7 * 86400),
      manufacturer: makers[i % makers.length],
      model: models[i % models.length],
      serial: `SN-DEMO-${10000 + i}`,
      biosVersion: '1.18.0',
      biosDate,
      cpuModel: cpuModels[i % cpuModels.length],
      cpuLoadPct: 8 + Math.floor(Math.random() * 40),
      ramTotalMB: [8192, 16384, 16384, 32768][i % 4],
      ramUsedPct: profile === 'WARN' && Math.random() < 0.3 ? 96 : 40 + Math.floor(Math.random() * 40),
      batteryPresent: isLaptop,
      batteryChargePct: isLaptop ? 60 + Math.floor(Math.random() * 40) : undefined,
      batteryHealthPct: isLaptop ? (profile === 'CRIT' ? 42 : profile === 'WARN' ? 65 : 80 + Math.floor(Math.random() * 18)) : undefined,
      batteryCycles: isLaptop ? 200 + Math.floor(Math.random() * 900) : undefined,
      onAcPower: isLaptop ? Math.random() < 0.7 : true,
      disks,
      antivirusEnabled: profile === 'CRIT' && Math.random() < 0.3 ? false : true,
      antivirusUpdated: profile === 'WARN' && Math.random() < 0.3 ? false : true,
      pendingUpdates: profile === 'WARN' && Math.random() < 0.4 ? 32 + Math.floor(Math.random() * 20) : Math.floor(Math.random() * 10),
      rebootPending: profile === 'WARN' && Math.random() < 0.3,
      reportedAt: new Date().toISOString(),
    };

    await saveHealthSnapshot(d.id, payload);
  }
}
