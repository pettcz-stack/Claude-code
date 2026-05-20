// Seed demo dat pro vývoj dashboardu (Blok 1.3). Generuje pár uživatelů,
// zařízení a syrové intervaly za poslední 3 pracovní dny.
// Vše jsou jen agregované metriky – žádný obsah.

import { prisma } from './db.js';
import { aggregateAll } from './services/aggregate.js';

const DEPARTMENTS = ['Obchod', 'Vývoj', 'Podpora'];
const APPS = ['winword.exe', 'excel.exe', 'chrome.exe', 'outlook.exe', 'teams.exe', 'code.exe'];

function alignToHour(d: Date): Date {
  const x = new Date(d);
  x.setMinutes(0, 0, 0);
  return x;
}

async function main() {
  // Uživatelé + zařízení
  const users = [];
  for (let i = 0; i < 6; i++) {
    const sid = `S-1-5-21-DEMO-${1000 + i}`;
    const user = await prisma.monitoredUser.upsert({
      where: { sid },
      update: {},
      create: {
        sid,
        displayName: `Zaměstnanec ${i + 1}`,
        department: DEPARTMENTS[i % DEPARTMENTS.length],
        email: `zamestnanec${i + 1}@firma.cz`,
      },
    });
    const machineId = `DEMO-PC-${i + 1}`;
    const device = await prisma.device.upsert({
      where: { machineId },
      update: { lastSeen: new Date() },
      create: { machineId, hostname: `PC-${i + 1}`, os: 'Windows 11', agentVersion: '0.1.0', lastSeen: new Date() },
    });
    users.push({ user, device });
  }

  // Intervaly za poslední 3 dny, 8:00–16:00, po minutě (zředěno na 5 min kvůli objemu)
  const now = new Date();
  let created = 0;
  for (const { user, device } of users) {
    for (let dayBack = 0; dayBack < 3; dayBack++) {
      const day = new Date(now);
      day.setDate(day.getDate() - dayBack);
      for (let hour = 8; hour < 16; hour++) {
        for (let min = 0; min < 60; min += 5) {
          const intervalStart = new Date(day);
          intervalStart.setHours(hour, min, 0, 0);
          const working = Math.random() > 0.25;
          const activeSeconds = working ? 240 + Math.floor(Math.random() * 60) : Math.floor(Math.random() * 60);
          const keystrokeCount = working ? Math.floor(Math.random() * 900) : 0;
          await prisma.activityInterval.upsert({
            where: {
              deviceId_userId_intervalStart: {
                deviceId: device.id,
                userId: user.id,
                intervalStart,
              },
            },
            update: {},
            create: {
              deviceId: device.id,
              userId: user.id,
              intervalStart,
              intervalSeconds: 300,
              activeSeconds,
              idleSeconds: 300 - activeSeconds,
              foregroundApp: APPS[Math.floor(Math.random() * APPS.length)],
              keystrokeCount,
              mouseEvents: working ? Math.floor(Math.random() * 300) : 0,
              sessionLocked: !working && Math.random() > 0.7,
            },
          });
          created++;
        }
      }
    }
  }
  const hours = await aggregateAll();
  // eslint-disable-next-line no-console
  console.log(`Seed hotov: ${users.length} uživatelů, ${created} intervalů, ${hours} hodinových agregátů.`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
