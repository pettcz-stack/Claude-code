// Demo data pro vývoj. ALBIXON-styl oddělení, vymyšlená jména, více lidí,
// včetně dvou s nepovolenými praktikami (simulátor myši, předmět na klávesnici).
// Vše jsou agregované metriky – žádný obsah.

import { Prisma } from '@prisma/client';
import { prisma } from './db.js';
import { aggregateAll } from './services/aggregate.js';
import { ensureDefaultCategories } from './services/categories.js';
import { DEFAULT_WEB_RULES } from './services/classify.js';
import { ensureDefaultTips } from './services/tips.js';
import { ensureDefaultSites } from './services/sites.js';

// Provozovna podle útvaru (pro lokální IP v demu): 10.30=Hořovice, 10.20=Praha, 10.10=Brno.
function siteBaseFor(dept: string): string {
  if (['Výroba', 'Montáže a servis', 'Konstrukce'].includes(dept)) return '10.30'; // Hořovice
  if (dept === 'Obchod Export') return '10.10'; // Brno
  if (dept === 'Logistika') return '10.40'; // Ostrava
  return '10.20'; // Praha
}

type Behavior = 'normal' | 'slacker' | 'cheater_mouse' | 'cheater_keyboard';

// 100 zaměstnanců – realistické rozložení po útvarech výrobní firmy (ALBIXON-styl).
const DEPT_PLAN: [string, number][] = [
  ['Výroba', 28], ['Montáže a servis', 16], ['Konstrukce', 10],
  ['Obchod ČR', 8], ['Obchod Export', 7], ['Logistika', 7],
  ['Ekonomika', 6], ['Marketing', 5], ['IT', 5], ['Vedení', 4], ['Personalistika', 4],
];
const FIRST_M = ['Jan', 'Petr', 'Martin', 'Tomáš', 'Jakub', 'Lukáš', 'Jiří', 'Pavel', 'Josef', 'David', 'Ondřej', 'Filip', 'Michal', 'Marek', 'Vojtěch', 'Adam', 'Roman', 'Aleš', 'Zdeněk', 'Karel', 'Miroslav', 'Daniel', 'Václav', 'Radek', 'Štěpán', 'Patrik', 'Matěj', 'Dominik', 'Libor', 'Stanislav'];
const FIRST_F = ['Eva', 'Lucie', 'Tereza', 'Veronika', 'Kateřina', 'Hana', 'Markéta', 'Jana', 'Petra', 'Lenka', 'Alena', 'Barbora', 'Kristýna', 'Michaela', 'Martina', 'Klára', 'Nikola', 'Simona', 'Monika', 'Denisa', 'Iveta', 'Zuzana', 'Gabriela', 'Adéla', 'Pavla'];
const LAST_M = ['Novák', 'Svoboda', 'Novotný', 'Dvořák', 'Černý', 'Procházka', 'Kučera', 'Veselý', 'Horák', 'Němec', 'Pospíšil', 'Marek', 'Pokorný', 'Beneš', 'Doležal', 'Zeman', 'Sedláček', 'Kratochvíl', 'Urban', 'Fiala', 'Říha', 'Kříž', 'Bartoš', 'Vaněk', 'Polák', 'Moravec', 'Holub', 'Štěpánek', 'Soukup', 'Konečný'];
const LAST_F = ['Nováková', 'Svobodová', 'Novotná', 'Dvořáková', 'Černá', 'Procházková', 'Kučerová', 'Veselá', 'Horáková', 'Němcová', 'Pospíšilová', 'Marková', 'Pokorná', 'Benešová', 'Doležalová', 'Zemanová', 'Sedláčková', 'Kratochvílová', 'Urbanová', 'Fialová', 'Říhová', 'Křížová', 'Bartošová', 'Vaňková', 'Poláková', 'Moravcová', 'Holubová', 'Štěpánková', 'Soukupová', 'Konečná'];

function genPeople(): { name: string; dept: string; behavior: Behavior; diligence: number }[] {
  let s = 987654321; // deterministický generátor (stejní lidé při každém seedu)
  const rng = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const pickFrom = <T,>(a: T[]) => a[Math.floor(rng() * a.length)];
  const used = new Set<string>();
  const depts: string[] = [];
  for (const [d, n] of DEPT_PLAN) for (let i = 0; i < n; i++) depts.push(d);

  const people: { name: string; dept: string; behavior: Behavior; diligence: number }[] = [];
  for (const dept of depts) {
    let name = '';
    for (let tries = 0; tries < 80; tries++) {
      const male = rng() < 0.62;
      name = male ? `${pickFrom(FIRST_M)} ${pickFrom(LAST_M)}` : `${pickFrom(FIRST_F)} ${pickFrom(LAST_F)}`;
      if (!used.has(name)) { used.add(name); break; }
    }
    const behavior: Behavior = rng() < 0.14 ? 'slacker' : 'normal';
    const diligence = behavior === 'slacker' ? 0.4 + rng() * 0.22 : 0.68 + rng() * 0.27;
    people.push({ name, dept, behavior, diligence });
  }
  // Dva ukázkoví „podvodníci" na konkrétní útvary (kvůli demu detekce praktik).
  const em = people.find((p) => p.dept === 'Obchod Export'); if (em) { em.behavior = 'cheater_mouse'; em.diligence = 0.9; }
  const ek = people.find((p) => p.dept === 'Ekonomika'); if (ek) { ek.behavior = 'cheater_keyboard'; ek.diligence = 0.9; }
  return people;
}

const PEOPLE = genPeople();

const NONWORK_APPS = ['steam.exe', 'spotify.exe'];
// Nezařazené (interní) aplikace – nejsou ve výchozích kategoriích → UNKNOWN.
const UNKNOWN_APPS = ['interni-nastroj.exe', 'utilitka.exe', 'firemni-app.exe'];
// Aplikace, kde se reálně píše (kvůli realistickému tempu úhozů). CAD/PDF = myš.
const TYPING_APPS = new Set(['winword.exe', 'excel.exe', 'outlook.exe', 'teams.exe', 'code.exe', 'navision.exe', 'crm.exe', 'econ.exe', 'powerpnt.exe']);

function rateFor(dept: string): number {
  const map: Record<string, number> = { 'Vedení': 750, 'IT': 560, 'Ekonomika': 460, 'Konstrukce': 500, 'Obchod Export': 520, 'Marketing': 420, 'Obchod ČR': 410 };
  return map[dept] ?? 360;
}

// Reálné aplikace ALBIXON podle útvaru. [proces, titulek okna|null].
type Pick = [string, string | null];
const T = (app: string, title: string | null = null): Pick => [app, title];
const POOL_COMMON: Pick[] = [T('outlook.exe'), T('teams.exe'), T('excel.exe'), T('chrome.exe', 'Intranet ALBIXON'), T('chrome.exe', 'OKbase – docházka')];
const POOLS: Record<string, Pick[]> = {
  'Vedení': [T('navision.exe'), T('excel.exe'), T('powerpnt.exe'), T('outlook.exe'), T('teams.exe'), T('chrome.exe', 'Power BI – reporty')],
  'Obchod ČR': [T('crm.exe'), T('crm.exe'), T('navision.exe'), T('excel.exe'), T('outlook.exe'), T('teams.exe'), T('chrome.exe', 'Microsoft Dynamics CRM')],
  'Obchod Export': [T('crm.exe'), T('crm.exe'), T('navision.exe'), T('excel.exe'), T('outlook.exe'), T('teams.exe')],
  'Marketing': [T('powerpnt.exe'), T('crm.exe'), T('excel.exe'), T('outlook.exe'), T('teams.exe'), T('chrome.exe', 'SharePoint – dokumenty')],
  'Konstrukce': [T('sldworks.exe'), T('sldworks.exe'), T('sldworks.exe'), T('excel.exe'), T('outlook.exe'), T('teams.exe'), T('acrobat.exe')],
  'Výroba': [T('navision.exe'), T('navision.exe'), T('excel.exe'), T('teams.exe'), T('chrome.exe', 'Intranet ALBIXON')],
  'Logistika': [T('navision.exe'), T('navision.exe'), T('excel.exe'), T('outlook.exe'), T('teams.exe')],
  'Montáže a servis': [T('crm.exe'), T('outlook.exe'), T('teams.exe'), T('chrome.exe', 'Intranet ALBIXON')],
  'Ekonomika': [T('econ.exe'), T('econ.exe'), T('navision.exe'), T('excel.exe'), T('outlook.exe'), T('teams.exe')],
  'Personalistika': [T('okbase.exe'), T('okbase.exe'), T('excel.exe'), T('winword.exe'), T('outlook.exe'), T('teams.exe')],
  'IT': [T('code.exe'), T('code.exe'), T('teams.exe'), T('outlook.exe'), T('navision.exe'), T('chrome.exe', 'Intranet ALBIXON')],
};
function buildPool(dept: string): Pick[] {
  return [...(POOLS[dept] ?? []), ...POOL_COMMON];
}
const BROWSER_WORK_TITLES = ['Intranet ALBIXON', 'OKbase – docházka', 'SharePoint – dokumenty', 'Microsoft Dynamics CRM', 'Power BI – reporty'];
const BROWSER_NONWORK_TITLES = ['YouTube', 'Facebook', 'Instagram', 'Novinky.cz', 'Seznam.cz - Email', 'Alza.cz'];

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const rnd = (n: number) => Math.floor(Math.random() * n);

type Person = { id: string; deviceId: string; behavior: Behavior; diligence: number; hoDip: number; monitors: number; workPool: Pick[]; siteBase: string };

// Kolik monitorů kdo má (z HW). Část lidí 2, IT i 3.
function monitorsFor(dept: string): number {
  if (dept === 'IT') return 3;
  if (['Konstrukce', 'Ekonomika', 'Vedení', 'Obchod Export'].includes(dept)) return 2;
  return 1;
}

function hoDipFor(b: Behavior): number {
  if (b === 'slacker') return 0.28; // doma viditelně poleví
  if (b.startsWith('cheater')) return 0; // podvodníci jedou stejně (vzor je strojový)
  return 0.07; // běžní lidé jen mírně
}

async function main() {
  // Zajisti výchozí kategorie aplikací, pravidla webů a tipy do reportu.
  await ensureDefaultCategories();
  await ensureDefaultTips();
  await prisma.site.deleteMany({}); // demo: vždy obnov plný seznam provozoven
  await ensureDefaultSites();
  for (const r of DEFAULT_WEB_RULES) {
    await prisma.webRule.upsert({
      where: { keyword: r.keyword },
      create: { keyword: r.keyword, category: r.category, type: r.type },
      update: { category: r.category, type: r.type },
    });
  }

  const created: Person[] = [];
  for (let i = 0; i < PEOPLE.length; i++) {
    const p = PEOPLE[i];
    const sid = `S-1-5-21-DEMO-${1000 + i}`;
    const user = await prisma.monitoredUser.upsert({
      where: { sid },
      update: { displayName: p.name, department: p.dept, hourlyRate: rateFor(p.dept) },
      create: { sid, displayName: p.name, department: p.dept, email: `${i}@albixon-demo.cz`, hourlyRate: rateFor(p.dept) },
    });
    const machineId = `DEMO-PC-${i + 1}`;
    const device = await prisma.device.upsert({
      where: { machineId },
      update: { lastSeen: new Date(), agentVersion: '0.1.0', os: 'Windows 11' },
      create: { machineId, hostname: `ALB-PC-${i + 1}`, os: 'Windows 11', agentVersion: '0.1.0', lastSeen: new Date() },
    });
    created.push({ id: user.id, deviceId: device.id, behavior: p.behavior, diligence: p.diligence, hoDip: hoDipFor(p.behavior), monitors: monitorsFor(p.dept), workPool: buildPool(p.dept), siteBase: siteBaseFor(p.dept) });
  }

  const userIds = created.map((c) => c.id);
  await prisma.activityInterval.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.activityHourly.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.dailyStat.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.dailyAppStat.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.absence.deleteMany({ where: { userId: { in: userIds } } });

  const now = new Date();
  const batch: Prisma.ActivityIntervalCreateManyInput[] = [];
  const absences: Prisma.AbsenceCreateManyInput[] = [];

  for (const c of created) {
    for (let dayBack = 0; dayBack < 30; dayBack++) {
      const day = new Date(now);
      day.setDate(day.getDate() - dayBack);
      const dow = day.getDay();
      if (dow === 0 || dow === 6) continue;
      const date = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()));

      // HR absence (OKbase): nemoc/dovolená → ten den bez PC aktivity (mimo podvodníky).
      if (!c.behavior.startsWith('cheater')) {
        const r = Math.random();
        const leave = r < 0.03 ? 'NEMOC' : r < 0.09 ? 'DOVOLENA' : null;
        if (leave) {
          absences.push({ userId: c.id, date, type: leave, source: 'OKBASE' });
          continue; // absence = žádné intervaly
        }
      }

      // Home office den (z OKbase by to byl fakt). Podvodníci jezdí do kanceláře.
      const isHO = c.behavior.startsWith('cheater') ? false : Math.random() < 0.25;
      if (isHO) {
        absences.push({ userId: c.id, date, type: 'HOME_OFFICE', source: 'OKBASE' });
      }

      for (let hour = 8; hour < 16; hour++) {
        for (let min = 0; min < 60; min += 5) {
          const intervalStart = new Date(day);
          intervalStart.setHours(hour, min, 0, 0);
          const row = makeRow(c, intervalStart, isHO);
          if (row) batch.push(row);
        }
      }
    }
  }

  for (let i = 0; i < batch.length; i += 1000) {
    await prisma.activityInterval.createMany({ data: batch.slice(i, i + 1000) });
  }
  if (absences.length) await prisma.absence.createMany({ data: absences });

  // Demo licence: reálné placené aplikace ALBIXON + seaty/cena (CZK/měsíc/licence).
  // Část je dobře využitá (zelená), část leží ladem (červená = úspora).
  // projectpro.exe nikdo nepoužívá → 100% plýtvání pro ukázku.
  // Počty licencí naladěné pro ~100 lidí: část je předplacená „do foroty"
  // (nevyužité licence = úspora), část dobře využitá.
  const LICENSES = [
    { appName: 'sldworks.exe', category: 'CAD / Konstrukce', type: 'WORK', seats: 25, costPerSeat: 4500 }, // SolidWorks – drahé, jen konstrukce
    { appName: 'navision.exe', category: 'Podnikový systém', type: 'WORK', seats: 90, costPerSeat: 1500 }, // Microsoft Navision
    { appName: 'crm.exe', category: 'CRM', type: 'WORK', seats: 55, costPerSeat: 1200 }, // Microsoft Dynamics CRM
    { appName: 'econ.exe', category: 'Podnikový systém', type: 'WORK', seats: 12, costPerSeat: 800 }, // E-CON
    { appName: 'excel.exe', category: 'Kancelář', type: 'WORK', seats: 110, costPerSeat: 350 }, // Office – téměř všichni
    { appName: 'code.exe', category: 'Vývoj', type: 'WORK', seats: 10, costPerSeat: 250 },
    { appName: 'okbase.exe', category: 'Docházka / HR', type: 'WORK', seats: 12, costPerSeat: 120 },
    { appName: 'projectpro.exe', category: 'Projektové řízení', type: 'WORK', seats: 15, costPerSeat: 900 }, // nikdo nepoužívá → 100% plýtvání
  ];
  // Vyčisti staré licence (ať audit ukazuje jen aktuální sadu).
  await prisma.appCategory.updateMany({ data: { licensed: false, seats: null, costPerSeat: null } });
  for (const l of LICENSES) {
    await prisma.appCategory.upsert({
      where: { appName: l.appName },
      create: { appName: l.appName, category: l.category, type: l.type, licensed: true, seats: l.seats, costPerSeat: l.costPerSeat },
      update: { category: l.category, type: l.type, licensed: true, seats: l.seats, costPerSeat: l.costPerSeat },
    });
  }

  const hours = await aggregateAll();
  // eslint-disable-next-line no-console
  console.log(`Seed hotov: ${created.length} uživatelů, ${batch.length} intervalů, ${absences.length} HO dnů, ${hours} agregátů.`);
}

function makeRow(c: Person, intervalStart: Date, isHO: boolean): Prisma.ActivityIntervalCreateManyInput | null {
  // Lokální IP: v kanceláři podsíť provozovny, na Home Office domácí síť → „Mimo firmu".
  const clientIp = isHO ? `192.168.1.${10 + rnd(240)}` : `${c.siteBase}.${rnd(254)}.${10 + rnd(240)}`;
  const base = { deviceId: c.deviceId, userId: c.id, intervalStart, intervalSeconds: 300, monitorCount: c.monitors, clientIp };

  // Podvodníci: vypadají „aktivně" celý den, ale vzor je strojový.
  if (c.behavior === 'cheater_mouse') {
    return { ...base, activeSeconds: 295, idleSeconds: 5, foregroundApp: 'excel.exe', windowTitle: null, keystrokeCount: 0, mouseEvents: 5 + rnd(2), sessionLocked: false };
  }
  if (c.behavior === 'cheater_keyboard') {
    return { ...base, activeSeconds: 300, idleSeconds: 0, foregroundApp: 'winword.exe', windowTitle: null, keystrokeCount: 585 + rnd(8), mouseEvents: 0, sessionLocked: false };
  }

  // Běžní lidé: občas PC off, mix práce/neutrál/mimopráce dle píle.
  // Na home office méně pilní lidé poleví víc (hoDip).
  const hoDip = isHO ? c.hoDip : 0;
  const offChance = (1 - c.diligence) * 0.25 + (intervalStart.getHours() >= 14 ? 0.08 : 0) + hoDip;
  if (Math.random() < offChance) return null;

  const nonWorkProb = (1 - c.diligence) * 0.35 + hoDip * 0.5;
  const r = Math.random();
  let app: string;
  let title: string | null = null;
  let active: number;
  if (r < nonWorkProb) {
    if (Math.random() < 0.5) { app = 'chrome.exe'; title = pick(BROWSER_NONWORK_TITLES); } else { app = pick(NONWORK_APPS); }
    active = 240 + rnd(60);
  } else if (r < nonWorkProb + 0.14) {
    app = 'chrome.exe'; title = pick(BROWSER_WORK_TITLES); active = 200 + rnd(90);
  } else if (Math.random() < 0.05) {
    // nezařazená interní aplikace → UNKNOWN (vyjmuto, dokud admin nezařadí)
    app = pick(UNKNOWN_APPS); active = 200 + rnd(90);
  } else {
    const w = pick(c.workPool);
    app = w[0]; title = w[1];
    active = Math.random() > 0.85 ? rnd(60) : 240 + rnd(60);
  }
  // CAD/PDF jsou ovládané hlavně myší → málo úhozů; psací aplikace hodně.
  const ks = active > 120 && TYPING_APPS.has(app) ? rnd(900) : rnd(120);
  const mouse = app === 'sldworks.exe' ? 200 + rnd(400) : active > 60 ? rnd(300) : rnd(30);
  return { ...base, activeSeconds: active, idleSeconds: 300 - active, foregroundApp: app, windowTitle: title, keystrokeCount: ks, mouseEvents: mouse, sessionLocked: active < 30 && Math.random() > 0.6 };
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
