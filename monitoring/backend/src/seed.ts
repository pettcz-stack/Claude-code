// Demo data pro vývoj. ALBIXON-styl oddělení, vymyšlená jména, více lidí,
// včetně dvou s nepovolenými praktikami (simulátor myši, předmět na klávesnici).
// Vše jsou agregované metriky – žádný obsah.

import { Prisma } from '@prisma/client';
import { prisma } from './db.js';
import { aggregateAll } from './services/aggregate.js';

type Behavior = 'normal' | 'slacker' | 'cheater_mouse' | 'cheater_keyboard';

const PEOPLE: { name: string; dept: string; behavior: Behavior; diligence: number }[] = [
  { name: 'Jan Procházka', dept: 'Vedení', behavior: 'normal', diligence: 0.9 },
  { name: 'Eva Dvořáková', dept: 'Obchod ČR', behavior: 'normal', diligence: 0.85 },
  { name: 'Petr Novák', dept: 'Obchod ČR', behavior: 'slacker', diligence: 0.5 },
  { name: 'Lucie Svobodová', dept: 'Obchod Export', behavior: 'normal', diligence: 0.82 },
  { name: 'Martin Kučera', dept: 'Obchod Export', behavior: 'cheater_mouse', diligence: 0.9 },
  { name: 'Tereza Veselá', dept: 'Marketing', behavior: 'normal', diligence: 0.78 },
  { name: 'Ondřej Černý', dept: 'Marketing', behavior: 'slacker', diligence: 0.42 },
  { name: 'Jakub Horák', dept: 'Konstrukce', behavior: 'normal', diligence: 0.88 },
  { name: 'Veronika Marková', dept: 'Konstrukce', behavior: 'normal', diligence: 0.8 },
  { name: 'Tomáš Pospíšil', dept: 'Výroba', behavior: 'normal', diligence: 0.72 },
  { name: 'Kateřina Němcová', dept: 'Logistika', behavior: 'slacker', diligence: 0.55 },
  { name: 'David Beneš', dept: 'Montáže a servis', behavior: 'normal', diligence: 0.83 },
  { name: 'Hana Kratochvílová', dept: 'Ekonomika', behavior: 'normal', diligence: 0.86 },
  { name: 'Roman Fiala', dept: 'Ekonomika', behavior: 'cheater_keyboard', diligence: 0.9 },
  { name: 'Markéta Urbanová', dept: 'Personalistika', behavior: 'normal', diligence: 0.8 },
  { name: 'Filip Doležal', dept: 'IT', behavior: 'normal', diligence: 0.87 },
];

const WORK_APPS = ['winword.exe', 'excel.exe', 'outlook.exe', 'teams.exe', 'code.exe', 'sap.exe'];
const NONWORK_APPS = ['steam.exe', 'spotify.exe'];
const BROWSER_WORK_TITLES = ['Jira – úkoly', 'Confluence – dokumentace', 'GitLab – merge request', 'Firemní CRM', 'SharePoint'];
const BROWSER_NONWORK_TITLES = ['YouTube', 'Facebook', 'Instagram', 'Novinky.cz', 'Seznam.cz - Email', 'Alza.cz'];

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const rnd = (n: number) => Math.floor(Math.random() * n);

async function main() {
  const created: { id: string; deviceId: string; behavior: Behavior; diligence: number }[] = [];
  for (let i = 0; i < PEOPLE.length; i++) {
    const p = PEOPLE[i];
    const sid = `S-1-5-21-DEMO-${1000 + i}`;
    const user = await prisma.monitoredUser.upsert({
      where: { sid },
      update: { displayName: p.name, department: p.dept },
      create: { sid, displayName: p.name, department: p.dept, email: `${i}@albixon-demo.cz` },
    });
    const machineId = `DEMO-PC-${i + 1}`;
    const device = await prisma.device.upsert({
      where: { machineId },
      update: { lastSeen: new Date(), agentVersion: '0.1.0', os: 'Windows 11' },
      create: { machineId, hostname: `ALB-PC-${i + 1}`, os: 'Windows 11', agentVersion: '0.1.0', lastSeen: new Date() },
    });
    created.push({ id: user.id, deviceId: device.id, behavior: p.behavior, diligence: p.diligence });
  }

  const userIds = created.map((c) => c.id);
  await prisma.activityInterval.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.activityHourly.deleteMany({ where: { userId: { in: userIds } } });

  const now = new Date();
  const batch: Prisma.ActivityIntervalCreateManyInput[] = [];

  for (const c of created) {
    for (let dayBack = 0; dayBack < 30; dayBack++) {
      const day = new Date(now);
      day.setDate(day.getDate() - dayBack);
      const dow = day.getDay();
      if (dow === 0 || dow === 6) continue;

      for (let hour = 8; hour < 16; hour++) {
        for (let min = 0; min < 60; min += 5) {
          const intervalStart = new Date(day);
          intervalStart.setHours(hour, min, 0, 0);
          const row = makeRow(c, intervalStart);
          if (row) batch.push(row);
        }
      }
    }
  }

  for (let i = 0; i < batch.length; i += 1000) {
    await prisma.activityInterval.createMany({ data: batch.slice(i, i + 1000) });
  }
  const hours = await aggregateAll();
  // eslint-disable-next-line no-console
  console.log(`Seed hotov: ${created.length} uživatelů, ${batch.length} intervalů, ${hours} hodinových agregátů.`);
}

function makeRow(
  c: { id: string; deviceId: string; behavior: Behavior; diligence: number },
  intervalStart: Date,
): Prisma.ActivityIntervalCreateManyInput | null {
  const base = { deviceId: c.deviceId, userId: c.id, intervalStart, intervalSeconds: 300 };

  // Podvodníci: vypadají „aktivně" celý den, ale vzor je strojový.
  if (c.behavior === 'cheater_mouse') {
    return { ...base, activeSeconds: 295, idleSeconds: 5, foregroundApp: 'excel.exe', windowTitle: null, keystrokeCount: 0, mouseEvents: 5 + rnd(2), sessionLocked: false };
  }
  if (c.behavior === 'cheater_keyboard') {
    return { ...base, activeSeconds: 300, idleSeconds: 0, foregroundApp: 'notepad.exe', windowTitle: null, keystrokeCount: 585 + rnd(8), mouseEvents: 0, sessionLocked: false };
  }

  // Běžní lidé: občas PC off, mix práce/neutrál/mimopráce dle píle.
  const offChance = (1 - c.diligence) * 0.25 + (intervalStart.getHours() >= 14 ? 0.08 : 0);
  if (Math.random() < offChance) return null;

  const nonWorkProb = (1 - c.diligence) * 0.35;
  const r = Math.random();
  let app: string;
  let title: string | null = null;
  let active: number;
  if (r < nonWorkProb) {
    if (Math.random() < 0.5) { app = 'chrome.exe'; title = pick(BROWSER_NONWORK_TITLES); } else { app = pick(NONWORK_APPS); }
    active = 240 + rnd(60);
  } else if (r < nonWorkProb + 0.18) {
    app = 'chrome.exe'; title = pick(BROWSER_WORK_TITLES); active = 200 + rnd(90);
  } else if (Math.random() > 0.85) {
    app = pick(WORK_APPS); active = rnd(60);
  } else {
    app = pick(WORK_APPS); active = 240 + rnd(60);
  }
  const ks = active > 120 && WORK_APPS.includes(app) ? rnd(900) : rnd(150);
  return { ...base, activeSeconds: active, idleSeconds: 300 - active, foregroundApp: app, windowTitle: title, keystrokeCount: ks, mouseEvents: active > 60 ? rnd(300) : rnd(30), sessionLocked: active < 30 && Math.random() > 0.6 };
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
