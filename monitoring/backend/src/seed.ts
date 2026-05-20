// Seed bohatých demo dat pro vývoj dashboardu a skóre.
// Generuje ~4 týdny pracovních dnů, 8h denně, s občasnou mimopracovní aktivitou.
// Vše jsou jen agregované metriky – žádný obsah.

import { Prisma } from '@prisma/client';
import { prisma } from './db.js';
import { aggregateAll } from './services/aggregate.js';

const DEPARTMENTS = ['Obchod', 'Vývoj', 'Podpora'];
const WORK_APPS = ['winword.exe', 'excel.exe', 'outlook.exe', 'teams.exe', 'code.exe', 'sap.exe'];
const NEUTRAL_APPS = ['chrome.exe', 'msedge.exe'];
const NONWORK_APPS = ['steam.exe', 'facebook.com', 'youtube.com', 'spotify.exe', 'instagram.com'];

// profil píle 0..1 (vyšší = pracovitější)
const PROFILES = [0.92, 0.78, 0.65, 0.5, 0.35, 0.85];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
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
      update: { lastSeen: new Date(), agentVersion: '0.1.0', os: 'Windows 11' },
      create: { machineId, hostname: `PC-${i + 1}`, os: 'Windows 11', agentVersion: '0.1.0', lastSeen: new Date() },
    });
    users.push({ user, device, diligence: PROFILES[i] });
  }

  // čistý reset demo dat
  const userIds = users.map((u) => u.user.id);
  await prisma.activityInterval.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.activityHourly.deleteMany({ where: { userId: { in: userIds } } });

  const now = new Date();
  const batch: Prisma.ActivityIntervalCreateManyInput[] = [];

  for (const { user, device, diligence } of users) {
    for (let dayBack = 0; dayBack < 28; dayBack++) {
      const day = new Date(now);
      day.setDate(day.getDate() - dayBack);
      const dow = day.getDay();
      if (dow === 0 || dow === 6) continue; // víkend přeskočit

      for (let hour = 8; hour < 16; hour++) {
        // občas PC off (méně pilní vypadávají víc, hlavně odpoledne)
        const offChance = (1 - diligence) * 0.25 + (hour >= 14 ? 0.1 : 0);
        if (Math.random() < offChance) continue;

        for (let min = 0; min < 60; min += 5) {
          const intervalStart = new Date(day);
          intervalStart.setHours(hour, min, 0, 0);

          const nonWorkProb = (1 - diligence) * 0.35;
          const r = Math.random();
          let app: string;
          let active: number;
          if (r < nonWorkProb) {
            app = pick(NONWORK_APPS);
            active = 240 + Math.floor(Math.random() * 60);
          } else if (r < nonWorkProb + 0.15) {
            app = pick(NEUTRAL_APPS);
            active = 180 + Math.floor(Math.random() * 100);
          } else if (Math.random() > 0.85) {
            app = pick(WORK_APPS);
            active = Math.floor(Math.random() * 60); // krátká nečinnost
          } else {
            app = pick(WORK_APPS);
            active = 240 + Math.floor(Math.random() * 60);
          }
          const ks = active > 120 && WORK_APPS.includes(app) ? Math.floor(Math.random() * 900) : Math.floor(Math.random() * 150);

          batch.push({
            deviceId: device.id,
            userId: user.id,
            intervalStart,
            intervalSeconds: 300,
            activeSeconds: active,
            idleSeconds: 300 - active,
            foregroundApp: app,
            keystrokeCount: ks,
            mouseEvents: active > 60 ? Math.floor(Math.random() * 300) : Math.floor(Math.random() * 30),
            sessionLocked: active < 30 && Math.random() > 0.6,
          });
        }
      }
    }
  }

  // dávkové vložení
  for (let i = 0; i < batch.length; i += 1000) {
    await prisma.activityInterval.createMany({ data: batch.slice(i, i + 1000) });
  }

  const hours = await aggregateAll();
  // eslint-disable-next-line no-console
  console.log(`Seed hotov: ${users.length} uživatelů, ${batch.length} intervalů, ${hours} hodinových agregátů.`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
