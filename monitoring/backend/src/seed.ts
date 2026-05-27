// Demo data pro vývoj / pilot – realistická firma 1991 zaměstnanců.
//
// Vše jsou agregované metriky – žádný obsah kláves. Distribuce, plat, použité
// aplikace a chování per oddělení modelováno tak, aby vyhodnocení v dashboardu
// fungovalo logicky a propojeně:
//
//   - Konstrukce → SolidWorks (CAD = málo kláves, hodně myši, 2 monitory)
//   - Obchod → Dynamics CRM + Excel + Outlook (hodně kláves, telefonování)
//   - Výroba → málo PC času (operátoři u strojů; jen občas Navision)
//   - HR → LinkedIn jako WORK (DeptClassification override)
//   - 12 slackerů + 8 cheaterů (mouse jiggler / robotická pravidelnost)
//
// Seed je idempotentní – opakovaný běh přeskočí intervaly, print/usb,
// audit a claims, pokud už existují (gate `.count() === 0`).

import { Prisma } from '@prisma/client';
import { prisma } from './db.js';
import { aggregateAll } from './services/aggregate.js';
import { ensureDefaultCategories } from './services/categories.js';
import { DEFAULT_WEB_RULES } from './services/classify.js';
import { ensureDefaultTips } from './services/tips.js';
import { ensureDefaultSites } from './services/sites.js';
import { saveSettings } from './services/settings.js';
import { ensureDemoDeviceHealth } from './services/healthDemo.js';
import { hashPassword } from './auth.js';
import { floorToDay, addDays, localParts, localDow, zonedToUtc } from './services/tz.js';

// ─── Firma: 1991 zaměstnanců ────────────────────────────────────────────────
//
// Realistická struktura výrobního podniku s vývojem (Sinsu Platform-styl).
// Provozovny: Praha (vedení, IT, obchod, ekonomika), Brno (export),
// Hořovice (výroba), Osov (konstrukce), Ostrava (logistika).

type DeptSpec = {
  name: string;
  size: number;
  rate: [number, number]; // hodinová mzda CZK
  site: string; // 10.20 = Praha apod. (siteBaseFor)
  monitors: 1 | 2 | 3; // typický počet
};

const DEPT_PLAN: DeptSpec[] = [
  { name: 'Vedení',              size: 10,  rate: [700, 950], site: '10.20', monitors: 2 },
  { name: 'Právní',              size: 8,   rate: [550, 850], site: '10.20', monitors: 2 },
  { name: 'Audit',               size: 10,  rate: [550, 800], site: '10.20', monitors: 2 },
  { name: 'Compliance',          size: 14,  rate: [500, 750], site: '10.20', monitors: 2 },
  { name: 'Personalistika',      size: 22,  rate: [380, 550], site: '10.20', monitors: 1 },
  { name: 'HR Akademie',         size: 9,   rate: [420, 600], site: '10.20', monitors: 1 },
  { name: 'Tréning',             size: 12,  rate: [400, 550], site: '10.20', monitors: 1 },
  { name: 'Ekonomika',           size: 60,  rate: [400, 620], site: '10.20', monitors: 2 },
  { name: 'Marketing',           size: 30,  rate: [400, 600], site: '10.20', monitors: 1 },
  { name: 'Nákup',               size: 30,  rate: [420, 600], site: '10.20', monitors: 1 },
  { name: 'IT',                  size: 40,  rate: [500, 720], site: '10.20', monitors: 3 },
  { name: 'IT podpora',          size: 15,  rate: [360, 500], site: '10.20', monitors: 2 },
  { name: 'Datacentrum',         size: 10,  rate: [600, 850], site: '10.20', monitors: 3 },
  { name: 'Vývoj',               size: 80,  rate: [550, 850], site: '10.20', monitors: 3 },
  { name: 'Vědecké oddělení',    size: 30,  rate: [600, 900], site: '10.20', monitors: 2 },
  { name: 'Konstrukce',          size: 170, rate: [480, 720], site: '10.50', monitors: 2 },
  { name: 'Kvalita',             size: 45,  rate: [400, 550], site: '10.30', monitors: 1 },
  { name: 'Bezpečnost práce',    size: 12,  rate: [400, 500], site: '10.30', monitors: 1 },
  { name: 'Obchod ČR',           size: 200, rate: [380, 700], site: '10.20', monitors: 1 },
  { name: 'Obchod Export',       size: 100, rate: [450, 800], site: '10.10', monitors: 2 },
  { name: 'Obchod EU',           size: 60,  rate: [440, 750], site: '10.20', monitors: 1 },
  { name: 'Logistika',           size: 95,  rate: [340, 500], site: '10.40', monitors: 1 },
  { name: 'Sklad',               size: 75,  rate: [310, 420], site: '10.30', monitors: 1 },
  { name: 'Výroba — Hala 1',     size: 220, rate: [310, 460], site: '10.30', monitors: 1 },
  { name: 'Výroba — Hala 2',     size: 200, rate: [310, 460], site: '10.30', monitors: 1 },
  { name: 'Výroba — Hala 3',     size: 135, rate: [310, 460], site: '10.30', monitors: 1 },
  { name: 'Montáže a servis',    size: 130, rate: [340, 520], site: '10.30', monitors: 1 },
  { name: 'Údržba',              size: 45,  rate: [350, 500], site: '10.30', monitors: 1 },
  { name: 'Zákaznický servis',   size: 80,  rate: [330, 480], site: '10.20', monitors: 1 },
  { name: 'Reklamace',           size: 36,  rate: [340, 500], site: '10.20', monitors: 1 },
  { name: 'Recepce',             size: 8,   rate: [280, 350], site: '10.20', monitors: 1 },
];
// Suma: 10+8+10+14+22+9+12+60+30+30+40+15+10+80+30+170+45+12+200+100+60+85+95+220+200+135+130+45+80+36+8 = 1991

// ─── Jména: rozšířená Česká pool ────────────────────────────────────────────
const FIRST_M = [
  'Jan', 'Petr', 'Martin', 'Tomáš', 'Jakub', 'Lukáš', 'Jiří', 'Pavel', 'Josef', 'David',
  'Ondřej', 'Filip', 'Michal', 'Marek', 'Vojtěch', 'Adam', 'Roman', 'Aleš', 'Zdeněk', 'Karel',
  'Miroslav', 'Daniel', 'Václav', 'Radek', 'Štěpán', 'Patrik', 'Matěj', 'Dominik', 'Libor', 'Stanislav',
  'Antonín', 'František', 'Vladimír', 'Bohumil', 'Vlastimil', 'Robert', 'Richard', 'Milan', 'Jaroslav', 'Bohuslav',
  'Otakar', 'Igor', 'Šimon', 'Mikuláš', 'Kryštof', 'Radim', 'Vít', 'Otto', 'Norbert', 'Kamil',
  'Lubomír', 'Erik', 'Maxmilián', 'Oldřich', 'Eduard', 'Jaromír', 'Vlastislav', 'Cyril', 'Boris', 'Ivan',
];
const FIRST_F = [
  'Eva', 'Lucie', 'Tereza', 'Veronika', 'Kateřina', 'Hana', 'Markéta', 'Jana', 'Petra', 'Lenka',
  'Alena', 'Barbora', 'Kristýna', 'Michaela', 'Martina', 'Klára', 'Nikola', 'Simona', 'Monika', 'Denisa',
  'Iveta', 'Zuzana', 'Gabriela', 'Adéla', 'Pavla', 'Dana', 'Marie', 'Anna', 'Helena', 'Jitka',
  'Renata', 'Dagmar', 'Romana', 'Květa', 'Libuše', 'Vlasta', 'Soňa', 'Olga', 'Naďa', 'Iva',
  'Marcela', 'Eliška', 'Karolína', 'Sandra', 'Daniela', 'Sabina', 'Anita', 'Magdaléna', 'Pavlína', 'Šárka',
  'Andrea', 'Ivana', 'Vendula', 'Natálie', 'Beata', 'Linda', 'Edita', 'Žaneta', 'Tatiana', 'Mirka',
];
const LAST_M = [
  'Novák', 'Svoboda', 'Novotný', 'Dvořák', 'Černý', 'Procházka', 'Kučera', 'Veselý', 'Horák', 'Němec',
  'Pospíšil', 'Marek', 'Pokorný', 'Beneš', 'Doležal', 'Zeman', 'Sedláček', 'Kratochvíl', 'Urban', 'Fiala',
  'Říha', 'Kříž', 'Bartoš', 'Vaněk', 'Polák', 'Moravec', 'Holub', 'Štěpánek', 'Soukup', 'Konečný',
  'Vlček', 'Růžička', 'Hájek', 'Bureš', 'Šimek', 'Vávra', 'Beran', 'Šťastný', 'Tichý', 'Mareš',
  'Janda', 'Vacek', 'Kratochvílka', 'Hrubý', 'Vobořil', 'Mašek', 'Janoušek', 'Šafařík', 'Linhart', 'Bouček',
  'Smolík', 'Hron', 'Sláma', 'Hála', 'Sýkora', 'Toman', 'Kopecký', 'Šíma', 'Hruška', 'Krejčí',
];
const LAST_F = LAST_M.map((l) => {
  // Heuristic czechifikace: -ý → -á, -í → -í (Krejčí), -a → -ová s občasnými výjimkami.
  if (l.endsWith('ý')) return l.slice(0, -1) + 'á';
  if (l.endsWith('í')) return l; // Krejčí etc.
  if (l.endsWith('a')) return l + 'ová';
  return l + 'ová';
});

// Aplikace per oddělení – realistický pool, který se losuje pro každou aktivní hodinu.
type Pick = [string, string | null];
const T = (app: string, title: string | null = null): Pick => [app, title];

const POOL_COMMON: Pick[] = [
  T('outlook.exe'), T('teams.exe'), T('excel.exe'),
  T('chrome.exe', 'Intranet Sinsu'), T('chrome.exe', 'OKbase – docházka'),
];

const POOLS: Record<string, Pick[]> = {
  'Vedení':            [T('navision.exe'), T('excel.exe'), T('powerpnt.exe'), T('outlook.exe'), T('teams.exe'), T('chrome.exe', 'Power BI – reporty')],
  'Právní':            [T('winword.exe'), T('winword.exe'), T('acrobat.exe'), T('outlook.exe'), T('excel.exe'), T('chrome.exe', 'ASPI – právní informační systém')],
  'Audit':             [T('excel.exe'), T('excel.exe'), T('navision.exe'), T('winword.exe'), T('outlook.exe'), T('chrome.exe', 'Power BI – reporty')],
  'Compliance':        [T('winword.exe'), T('excel.exe'), T('outlook.exe'), T('acrobat.exe'), T('chrome.exe', 'Intranet Sinsu')],
  'Personalistika':    [T('okbase.exe'), T('okbase.exe'), T('excel.exe'), T('winword.exe'), T('outlook.exe'), T('teams.exe'), T('chrome.exe', 'LinkedIn – Hledání kandidátů')],
  'HR Akademie':       [T('teams.exe'), T('powerpnt.exe'), T('winword.exe'), T('outlook.exe'), T('chrome.exe', 'Učební portál Sinsu')],
  'Tréning':           [T('powerpnt.exe'), T('teams.exe'), T('outlook.exe'), T('winword.exe'), T('chrome.exe', 'Učební portál Sinsu')],
  'Ekonomika':         [T('econ.exe'), T('econ.exe'), T('navision.exe'), T('excel.exe'), T('outlook.exe'), T('teams.exe')],
  'Marketing':         [T('powerpnt.exe'), T('crm.exe'), T('excel.exe'), T('outlook.exe'), T('teams.exe'), T('chrome.exe', 'SharePoint – dokumenty')],
  'Nákup':             [T('navision.exe'), T('excel.exe'), T('outlook.exe'), T('chrome.exe', 'Intranet Sinsu – Nákup')],
  'IT':                [T('code.exe'), T('code.exe'), T('code.exe'), T('teams.exe'), T('outlook.exe'), T('chrome.exe', 'GitLab – repozitář')],
  'IT podpora':        [T('teams.exe'), T('outlook.exe'), T('chrome.exe', 'Helpdesk Sinsu – tikety'), T('navision.exe'), T('explorer.exe')],
  'Datacentrum':       [T('code.exe'), T('teams.exe'), T('chrome.exe', 'Grafana – monitoring'), T('chrome.exe', 'AWS Console')],
  'Vývoj':             [T('code.exe'), T('code.exe'), T('code.exe'), T('teams.exe'), T('outlook.exe'), T('chrome.exe', 'GitLab – repozitář')],
  'Vědecké oddělení':  [T('code.exe'), T('excel.exe'), T('winword.exe'), T('acrobat.exe'), T('chrome.exe', 'Scientific reports - ScienceDirect')],
  'Konstrukce':        [T('sldworks.exe'), T('sldworks.exe'), T('sldworks.exe'), T('sldworks.exe'), T('excel.exe'), T('outlook.exe'), T('teams.exe'), T('acrobat.exe')],
  'Kvalita':           [T('excel.exe'), T('navision.exe'), T('outlook.exe'), T('chrome.exe', 'Intranet Sinsu – Kvalita')],
  'Bezpečnost práce':  [T('excel.exe'), T('winword.exe'), T('outlook.exe'), T('chrome.exe', 'BOZP portál')],
  'Obchod ČR':         [T('crm.exe'), T('crm.exe'), T('navision.exe'), T('excel.exe'), T('outlook.exe'), T('teams.exe'), T('chrome.exe', 'Microsoft Dynamics CRM')],
  'Obchod Export':     [T('crm.exe'), T('crm.exe'), T('navision.exe'), T('excel.exe'), T('outlook.exe'), T('teams.exe'), T('chrome.exe', 'Microsoft Dynamics CRM')],
  'Obchod EU':         [T('crm.exe'), T('crm.exe'), T('navision.exe'), T('excel.exe'), T('outlook.exe'), T('teams.exe')],
  'Logistika':         [T('navision.exe'), T('navision.exe'), T('excel.exe'), T('outlook.exe'), T('teams.exe')],
  'Sklad':             [T('navision.exe'), T('excel.exe'), T('chrome.exe', 'WMS – sklad')],
  'Výroba — Hala 1':   [T('navision.exe'), T('teams.exe'), T('chrome.exe', 'Intranet Sinsu – Výroba')],
  'Výroba — Hala 2':   [T('navision.exe'), T('teams.exe'), T('chrome.exe', 'Intranet Sinsu – Výroba')],
  'Výroba — Hala 3':   [T('navision.exe'), T('teams.exe'), T('chrome.exe', 'Intranet Sinsu – Výroba')],
  'Montáže a servis':  [T('crm.exe'), T('outlook.exe'), T('teams.exe'), T('chrome.exe', 'Intranet Sinsu – Montáže')],
  'Údržba':            [T('navision.exe'), T('outlook.exe'), T('chrome.exe', 'CMMS – plán údržby')],
  'Zákaznický servis': [T('crm.exe'), T('crm.exe'), T('outlook.exe'), T('teams.exe'), T('chrome.exe', 'Helpdesk Sinsu – tikety')],
  'Reklamace':         [T('crm.exe'), T('navision.exe'), T('winword.exe'), T('outlook.exe')],
  'Recepce':           [T('outlook.exe'), T('teams.exe'), T('excel.exe'), T('chrome.exe', 'Intranet Sinsu')],
};

const BROWSER_WORK_TITLES = ['Intranet Sinsu', 'OKbase – docházka', 'SharePoint – dokumenty', 'Microsoft Dynamics CRM', 'Power BI – reporty', 'GitLab – repozitář', 'AWS Console', 'Grafana – monitoring'];
const BROWSER_NONWORK_TITLES = ['YouTube', 'Facebook', 'Instagram', 'Novinky.cz', 'Seznam.cz - Email', 'Alza.cz', 'Aktuálně.cz', 'iDNES.cz', 'Twitch', 'Bazos.cz'];

const NONWORK_APPS = ['steam.exe', 'spotify.exe'];
// Nezařazené (interní) aplikace – nejsou ve výchozích kategoriích → UNKNOWN.
const UNKNOWN_APPS = ['interni-nastroj.exe', 'utilitka.exe', 'firemni-app.exe'];
// Aplikace, kde se reálně píše. CAD/PDF = myš.
const TYPING_APPS = new Set(['winword.exe', 'excel.exe', 'outlook.exe', 'teams.exe', 'code.exe', 'navision.exe', 'crm.exe', 'econ.exe', 'powerpnt.exe', 'okbase.exe']);

// Útvary které mají málo PC času (operátoři u strojů, šofeři, recepce).
// Tito lidé budou mít většinu intervalů "session locked" nebo idle.
const PRODUCTION_DEPTS = new Set(['Výroba — Hala 1', 'Výroba — Hala 2', 'Výroba — Hala 3', 'Sklad', 'Údržba', 'Recepce', 'Montáže a servis']);

function siteBaseFor(dept: string): string {
  const spec = DEPT_PLAN.find((d) => d.name === dept);
  return spec?.site ?? '10.20';
}
function rateRangeFor(dept: string): [number, number] {
  const spec = DEPT_PLAN.find((d) => d.name === dept);
  return spec?.rate ?? [340, 480];
}
function monitorsFor(dept: string): number {
  const spec = DEPT_PLAN.find((d) => d.name === dept);
  return spec?.monitors ?? 1;
}
function buildPool(dept: string): Pick[] {
  return [...(POOLS[dept] ?? []), ...POOL_COMMON];
}

type Behavior = 'normal' | 'slacker' | 'cheater_mouse' | 'cheater_keyboard';

function hoDipFor(b: Behavior): number {
  if (b === 'slacker') return 0.28; // doma viditelně poleví
  if (b.startsWith('cheater')) return 0; // podvodníci jedou stejně (vzor je strojový)
  return 0.07; // běžní lidé jen mírně
}

// Deterministický pseudo-RNG (stejní lidé při každém seedu, ať demo zákazník
// vidí stejné případy a může na ně odkázat).
let rngState = 987654321;
function rng(): number {
  rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
  return rngState / 0x7fffffff;
}
function rngInt(max: number): number { return Math.floor(rng() * max); }
function rngRange(min: number, max: number): number { return min + Math.floor(rng() * (max - min + 1)); }
function pickFrom<T>(a: T[]): T { return a[Math.floor(rng() * a.length)]; }

function genPeople(): { name: string; dept: string; behavior: Behavior; diligence: number; rate: number }[] {
  rngState = 987654321; // reset pro deterministické pořadí
  const used = new Set<string>();
  const people: { name: string; dept: string; behavior: Behavior; diligence: number; rate: number }[] = [];

  // Plochý seznam oddělení (nafouknutý podle size)
  const depts: string[] = [];
  for (const d of DEPT_PLAN) {
    for (let i = 0; i < d.size; i++) depts.push(d.name);
  }

  for (const dept of depts) {
    let name = '';
    for (let tries = 0; tries < 500; tries++) {
      const male = rng() < 0.55;
      name = male
        ? `${pickFrom(FIRST_M)} ${pickFrom(LAST_M)}`
        : `${pickFrom(FIRST_F)} ${pickFrom(LAST_F)}`;
      if (!used.has(name)) { used.add(name); break; }
    }
    if (used.has(name)) {
      // Fallback – přidej číslo, ať jsou unikátní (statisticky nepravděpodobné při ~7k variant).
      name = `${name} ${people.length + 1}`;
      used.add(name);
    }
    const behavior: Behavior = rng() < 0.06 ? 'slacker' : 'normal';
    const diligence = behavior === 'slacker' ? 0.40 + rng() * 0.22 : 0.65 + rng() * 0.32;
    const [rateMin, rateMax] = rateRangeFor(dept);
    const rate = rngRange(rateMin, rateMax);
    people.push({ name, dept, behavior, diligence, rate });
  }

  // 8 cheaterů rozprostřených napříč odděleními, ať detekce v dashboardu má jasné případy.
  const cheaterAssign: { dept: string; behavior: Behavior }[] = [
    { dept: 'Obchod Export',     behavior: 'cheater_mouse' },
    { dept: 'Ekonomika',         behavior: 'cheater_keyboard' },
    { dept: 'Obchod ČR',         behavior: 'cheater_mouse' },
    { dept: 'Zákaznický servis', behavior: 'cheater_keyboard' },
    { dept: 'Marketing',         behavior: 'cheater_mouse' },
    { dept: 'Logistika',         behavior: 'cheater_mouse' },
    { dept: 'IT',                behavior: 'cheater_keyboard' },
    { dept: 'Personalistika',    behavior: 'cheater_keyboard' },
  ];
  for (const c of cheaterAssign) {
    const target = people.find((p) => p.dept === c.dept && p.behavior === 'normal');
    if (target) { target.behavior = c.behavior; target.diligence = 0.9; }
  }
  return people;
}

const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const rnd = (n: number) => Math.floor(Math.random() * n);

type Person = { id: string; deviceId: string; dept: string; behavior: Behavior; diligence: number; hoDip: number; monitors: number; workPool: Pick[]; siteBase: string };

async function main() {
  // ─── 1) Statická konfigurace ─────────────────────────────────────────────
  await ensureDefaultCategories();
  await ensureDefaultTips();
  await prisma.site.deleteMany({});
  await ensureDefaultSites();
  for (const r of DEFAULT_WEB_RULES) {
    await prisma.webRule.upsert({
      where: { keyword: r.keyword },
      create: { keyword: r.keyword, category: r.category, type: r.type },
      update: { category: r.category, type: r.type },
    });
  }

  // ─── 2) 1991 uživatelů + zařízení ────────────────────────────────────────
  // Nejprve smazat všechny STARÉ demo záznamy (z předchozích seed iterací
  // s jiným SID rozsahem nebo strukturou). Bez tohoto by se po update vrstvily
  // staré "duchové" uživatelé – uvidíš třeba 2114 místo 1991, protože stará
  // verze měla SIDy mimo aktuální rozsah a upsert je nesmaže.
  // Cascade smazání (intervaly, dailyStat, atd.) se postará Prisma onDelete.
  const planned = DEPT_PLAN.reduce((s, d) => s + d.size, 0);
  const validSids = new Set<string>();
  for (let i = 0; i < planned; i++) validSids.add(`S-1-5-21-DEMO-${1000 + i}`);
  const validMachineIds = new Set<string>();
  for (let i = 0; i < planned; i++) validMachineIds.add(`DEMO-PC-${i + 1}`);

  const allDemoUsers = await prisma.monitoredUser.findMany({
    where: { sid: { startsWith: 'S-1-5-21-DEMO-' } },
    select: { id: true, sid: true },
  });
  const stale = allDemoUsers.filter((u) => !validSids.has(u.sid));
  if (stale.length > 0) {
    console.log(`Mažu ${stale.length} starých demo uživatelů (mimo aktuální rozsah)…`);
    // SQLite limit – dávkové delete po 500
    for (let i = 0; i < stale.length; i += 500) {
      const ids = stale.slice(i, i + 500).map((u) => u.id);
      await prisma.monitoredUser.deleteMany({ where: { id: { in: ids } } });
    }
  }

  const allDemoDevices = await prisma.device.findMany({
    where: { machineId: { startsWith: 'DEMO-PC-' } },
    select: { id: true, machineId: true },
  });
  const staleDevices = allDemoDevices.filter((d) => !validMachineIds.has(d.machineId));
  if (staleDevices.length > 0) {
    console.log(`Mažu ${staleDevices.length} starých demo zařízení…`);
    for (let i = 0; i < staleDevices.length; i += 500) {
      const ids = staleDevices.slice(i, i + 500).map((d) => d.id);
      await prisma.device.deleteMany({ where: { id: { in: ids } } });
    }
  }

  console.log(`Seeduji ${planned} uživatelů v ${DEPT_PLAN.length} odděleních…`);
  const PEOPLE = genPeople();

  // Vytvoříme/aktualizujeme všechny v jediné transakci po batchích.
  const created: Person[] = [];
  const BATCH = 200;
  for (let bi = 0; bi < PEOPLE.length; bi += BATCH) {
    const slice = PEOPLE.slice(bi, bi + BATCH);
    for (let i = 0; i < slice.length; i++) {
      const p = slice[i];
      const idx = bi + i;
      const sid = `S-1-5-21-DEMO-${1000 + idx}`;
      const user = await prisma.monitoredUser.upsert({
        where: { sid },
        update: { displayName: p.name, department: p.dept, hourlyRate: p.rate },
        create: { sid, displayName: p.name, department: p.dept, email: `demo${idx}@sinsu-demo.cz`, hourlyRate: p.rate },
      });
      const machineId = `DEMO-PC-${idx + 1}`;
      const device = await prisma.device.upsert({
        where: { machineId },
        update: { lastSeen: new Date(), agentVersion: '0.9.2', os: idx % 5 === 0 ? 'macOS 14' : 'Windows 11' },
        create: { machineId, hostname: `SINSU-PC-${String(idx + 1).padStart(4, '0')}`, os: idx % 5 === 0 ? 'macOS 14' : 'Windows 11', agentVersion: '0.9.2', lastSeen: new Date() },
      });
      created.push({
        id: user.id,
        deviceId: device.id,
        dept: p.dept,
        behavior: p.behavior,
        diligence: p.diligence,
        hoDip: hoDipFor(p.behavior),
        monitors: monitorsFor(p.dept),
        workPool: buildPool(p.dept),
        siteBase: siteBaseFor(p.dept),
      });
    }
    if ((bi + BATCH) % 400 === 0 || bi + BATCH >= PEOPLE.length) {
      console.log(`  ${Math.min(bi + BATCH, PEOPLE.length)} / ${PEOPLE.length} uživatelů…`);
    }
  }

  // ─── 3) Reset aktivních dat těchto uživatelů ─────────────────────────────
  const userIds = created.map((c) => c.id);
  console.log('Mažu staré intervaly a absence (idempotentní reseed)…');
  for (let i = 0; i < userIds.length; i += 500) {
    const batch = userIds.slice(i, i + 500);
    await prisma.activityInterval.deleteMany({ where: { userId: { in: batch } } });
    await prisma.activityHourly.deleteMany({ where: { userId: { in: batch } } });
    await prisma.dailyStat.deleteMany({ where: { userId: { in: batch } } });
    await prisma.dailyAppStat.deleteMany({ where: { userId: { in: batch } } });
    await prisma.absence.deleteMany({ where: { userId: { in: batch } } });
  }

  // ─── 4) ActivityInterval – 30 dní, 15min intervaly ───────────────────────
  // Důvod 15min: 1991 lidí × 22 prac. dnů × 32 intervalů (8h × 4/h) = ~1.4M
  // řádků. Při 5min by to bylo 4.2M – seed by trval násobně déle. Pro reálné
  // produkční data agenta posílá 60s intervaly, ale demo to simuluje.
  console.log('Generuji intervaly aktivity (15min granularita, 30 dní)…');
  const today = floorToDay(new Date());
  let batch: Prisma.ActivityIntervalCreateManyInput[] = [];
  const absences: Prisma.AbsenceCreateManyInput[] = [];
  const FLUSH_AT = 1000;

  for (let pi = 0; pi < created.length; pi++) {
    const c = created[pi];
    for (let dayBack = 0; dayBack < 30; dayBack++) {
      const dayStart = addDays(today, -dayBack);
      const lp = localParts(dayStart);
      const dow = localDow(dayStart);
      if (dow === 0 || dow === 6) continue; // víkend – bez intervalů
      const date = dayStart;

      // Absence: ~3 % nemoc, ~7 % dovolená per workday. Cheaters jezdí vždy.
      if (!c.behavior.startsWith('cheater')) {
        const r = Math.random();
        const leave = r < 0.03 ? 'NEMOC' : r < 0.10 ? 'DOVOLENA' : null;
        if (leave) {
          absences.push({ userId: c.id, date, type: leave, source: 'OKBASE' });
          continue;
        }
      }

      const isHO = c.behavior.startsWith('cheater') ? false : Math.random() < 0.22;
      if (isHO) absences.push({ userId: c.id, date, type: 'HOME_OFFICE', source: 'OKBASE' });

      // 8 prac. hod × 4 intervalů (po 15 min)
      for (let hour = 8; hour < 16; hour++) {
        for (let min = 0; min < 60; min += 15) {
          const intervalStart = zonedToUtc(lp.year, lp.month, lp.day, hour, min);
          const row = makeRow(c, intervalStart, isHO);
          if (row) batch.push(row);
          if (batch.length >= FLUSH_AT) {
            await prisma.activityInterval.createMany({ data: batch });
            batch = [];
          }
        }
      }
    }
    if ((pi + 1) % 200 === 0) console.log(`  intervaly: ${pi + 1} / ${created.length} uživatelů`);
  }
  if (batch.length > 0) await prisma.activityInterval.createMany({ data: batch });
  if (absences.length > 0) {
    // SQLite limit – po 500
    for (let i = 0; i < absences.length; i += 500) {
      await prisma.absence.createMany({ data: absences.slice(i, i + 500) });
    }
  }
  console.log(`  Vytvořeno intervalů: ~${created.length * 22 * 32} (záleží na absencích)`);

  // ─── 5) Licence + utilization realistic ─────────────────────────────────
  console.log('Resetuji licence – realistická utilizace…');
  await prisma.appCategory.updateMany({ data: { licensed: false, seats: null, costPerSeat: null } });
  const LICENSES = [
    // Plně využité – seats odpovídá počtu uživatelů konstrukce
    { appName: 'sldworks.exe', category: 'CAD / Konstrukce', type: 'WORK', seats: 200, costPerSeat: 4500 },
    { appName: 'navision.exe', category: 'Podnikový systém', type: 'WORK', seats: 1500, costPerSeat: 1500 },
    { appName: 'crm.exe', category: 'CRM', type: 'WORK', seats: 500, costPerSeat: 1200 },
    { appName: 'econ.exe', category: 'Podnikový systém', type: 'WORK', seats: 80, costPerSeat: 800 },
    { appName: 'excel.exe', category: 'Kancelář', type: 'WORK', seats: 2000, costPerSeat: 350 },
    { appName: 'code.exe', category: 'Vývoj', type: 'WORK', seats: 150, costPerSeat: 250 },
    { appName: 'powerpnt.exe', category: 'Kancelář', type: 'WORK', seats: 200, costPerSeat: 350 },
    // Plýtvání – předplaceno víc než využíváno (úspora pro auditora)
    { appName: 'projectpro.exe', category: 'Project management', type: 'WORK', seats: 50, costPerSeat: 800 }, // nikdo nepoužívá
    { appName: 'visiopro.exe', category: 'Diagramy', type: 'WORK', seats: 80, costPerSeat: 600 }, // sotva 5 lidí
  ];
  for (const l of LICENSES) {
    await prisma.appCategory.upsert({
      where: { appName: l.appName },
      create: { appName: l.appName, category: l.category, type: l.type, licensed: true, seats: l.seats, costPerSeat: l.costPerSeat },
      update: { category: l.category, type: l.type, licensed: true, seats: l.seats, costPerSeat: l.costPerSeat },
    });
  }

  // ─── 6) Print, USB, HW health, Admins, Audit, Claims ────────────────────
  await seedPrintAndUsb(created);
  await seedDeviceHealth(created);
  await seedAdditionalAdmins();
  await seedAccessAuditSamples(created);
  await seedClassificationClaims(created);

  // ─── 7) Settings & aggregation ──────────────────────────────────────────
  await saveSettings({
    printTrackingEnabled: true,
    capturePrintDocName: true,
    usbTrackingEnabled: true,
    captureUsbFilename: true,
    showDemoDevices: true,
  });

  console.log('Spouštím agregaci (může trvat 1-3 min při 1.4M intervalech)…');
  const hours = await aggregateAll();
  console.log(`Seed hotov: ${created.length} uživatelů, ${absences.length} absencí, ${hours} agregačních párů.`);
}

/** Vyrobí 1 interval pro uživatele v konkrétní 15-min slot. */
function makeRow(c: Person, intervalStart: Date, isHO: boolean): Prisma.ActivityIntervalCreateManyInput | null {
  const last = c.siteBase.split('.')[1];
  const clientIp = isHO ? `192.168.${rnd(255)}.${rnd(255)}` : `${c.siteBase}.${last}.${rnd(254) + 1}`;

  const base: Prisma.ActivityIntervalCreateManyInput = {
    userId: c.id,
    deviceId: c.deviceId,
    intervalStart,
    intervalSeconds: 60, // agent posílá 60s; demo aproximuje 15min jako "průměr" stejné šance
    activeSeconds: 0,
    idleSeconds: 0,
    keystrokeCount: 0,
    mouseEvents: 0,
    sessionLocked: false,
    monitorCount: c.monitors,
    clientIp,
    typingMs: 0,
    typingKeystrokeCount: 0,
  };

  // Production workers mají málo PC času (60% intervalů locked, zbytek pomalu)
  if (PRODUCTION_DEPTS.has(c.dept) && Math.random() < 0.6) {
    return { ...base, sessionLocked: true, activeSeconds: 0, idleSeconds: 60 };
  }

  const dipFactor = isHO ? 1 - c.hoDip : 1;
  const effectiveDiligence = c.diligence * dipFactor;

  // Cheater behaviors: mouse jiggler (mírná mouse aktivita pořád), keyboard (rytmické úhozy)
  if (c.behavior === 'cheater_mouse') {
    return { ...base, activeSeconds: 60, idleSeconds: 0, foregroundApp: 'chrome.exe', windowTitle: 'YouTube', mouseEvents: 50 + rnd(20), keystrokeCount: 0 };
  }
  if (c.behavior === 'cheater_keyboard') {
    return { ...base, activeSeconds: 60, idleSeconds: 0, foregroundApp: 'winword.exe', windowTitle: null, keystrokeCount: 180 + rnd(15), mouseEvents: rnd(3), typingMs: 60_000, typingKeystrokeCount: 180 + rnd(15) };
  }

  const nonWorkProb = c.behavior === 'slacker' ? 0.32 : (1 - effectiveDiligence) * 0.55;
  const r = Math.random();
  let app: string;
  let title: string | null = null;
  let active: number;
  if (r < nonWorkProb) {
    if (Math.random() < 0.6) { app = 'chrome.exe'; title = pick(BROWSER_NONWORK_TITLES); }
    else { app = pick(NONWORK_APPS); }
    active = 30 + rnd(30);
  } else if (r < nonWorkProb + 0.10) {
    app = 'chrome.exe'; title = pick(BROWSER_WORK_TITLES); active = 40 + rnd(20);
  } else if (Math.random() < 0.04) {
    app = pick(UNKNOWN_APPS); active = 30 + rnd(30);
  } else {
    const w = pick(c.workPool);
    app = w[0]; title = w[1];
    active = Math.random() > 0.85 ? rnd(15) : 45 + rnd(15);
  }

  const ks = active > 30 && TYPING_APPS.has(app) ? rnd(220) : rnd(30);
  const mouse = app === 'sldworks.exe' ? 50 + rnd(100) : active > 15 ? rnd(75) : rnd(8);
  // Typing session: pokud > 30 znaků v intervalu, předpokládáme souvislý
  // typing pattern – pro fázi 2 KPM. (Realisticky agent posílá per-keydown.)
  const typingMs = ks > 30 ? Math.min(60_000, ks * 200) : 0;

  return {
    ...base,
    activeSeconds: active,
    idleSeconds: 60 - active,
    foregroundApp: app,
    windowTitle: title,
    keystrokeCount: ks,
    mouseEvents: mouse,
    sessionLocked: active < 8 && Math.random() > 0.6,
    typingMs,
    typingKeystrokeCount: typingMs > 0 ? ks : 0,
  };
}

async function seedPrintAndUsb(users: Person[]): Promise<void> {
  const existingPrint = await prisma.printJob.count();
  const existingUsb = await prisma.usbFileEvent.count();
  if (existingPrint > 0 || existingUsb > 0) {
    console.log(`Demo Print/USB preskocen – uz existuji zaznamy (${existingPrint} tisk + ${existingUsb} USB).`);
    return;
  }
  console.log('Generuji print + USB události…');

  const PRINTERS = ['HP LaserJet M404 (Tiskárna kancelář 1)', 'Canon iR-ADV C5550 (Tiskárna recepce)', 'Brother HL-L2370 (Tiskárna sklad)', 'HP Color LaserJet (Vedení)', 'Kyocera Ecosys (Konstrukce)'];
  const PAPER_SIZES = ['A4', 'A4', 'A4', 'A4', 'A3', 'A4', 'A5'];
  const DOC_NAMES = ['Faktura', 'Smlouva s dodavatelem', 'Cenová nabídka', 'Týdenní report', 'Technický výkres', 'Personální podklady', 'Návrh dovolené', 'Reklamační protokol', 'Servisní list', 'Mzdový lístek'];
  const USB_LABELS = ['SanDisk-USB-32GB', 'Kingston-DataTraveler', 'Externí HDD WD', 'Apple TimeMachine', 'Verbatim 64GB'];
  const USB_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'jpg', 'png', 'dwg', 'zip', 'mp4', 'step', 'iges'];
  const ACTIONS = ['CREATE', 'WRITE', 'READ', 'DELETE'];

  const today = new Date();
  const printJobs: Prisma.PrintJobCreateManyInput[] = [];
  const usbEvents: Prisma.UsbFileEventCreateManyInput[] = [];

  for (const u of users) {
    const isCheater = u.behavior.startsWith('cheater');
    // Tisk podle role: vedení/HR/ekonomika tisknou hodně, výroba málo
    const heavyPrinter = ['Personalistika', 'Vedení', 'Ekonomika', 'Reklamace', 'Právní'].includes(u.dept);
    const noPrinter = ['Výroba — Hala 1', 'Výroba — Hala 2', 'Výroba — Hala 3', 'Sklad', 'Údržba'].includes(u.dept);
    if (noPrinter && Math.random() < 0.85) continue; // většina jich neprintuje
    const printsPerWeek = isCheater ? 60 + rnd(50) : heavyPrinter ? 12 + rnd(15) : 2 + rnd(5);

    for (let d = 0; d < 30; d++) {
      const date = new Date(today); date.setDate(date.getDate() - d);
      const jobsToday = Math.random() < 0.4 ? Math.round(printsPerWeek / 7 * (0.5 + Math.random())) : 0;
      for (let j = 0; j < jobsToday; j++) {
        const jobAt = new Date(date);
        jobAt.setHours(isCheater && Math.random() < 0.25 ? 19 + rnd(4) : 8 + rnd(8), rnd(60), rnd(60));
        printJobs.push({
          deviceId: u.deviceId,
          userId: u.id,
          printerName: pick(PRINTERS),
          documentName: Math.random() < 0.55 ? `${pick(DOC_NAMES)} ${1000 + rnd(9000)}.pdf` : null,
          pages: 1 + rnd(isCheater ? 40 : 8),
          copies: Math.random() < 0.08 ? 1 + rnd(5) : 1,
          paperSize: pick(PAPER_SIZES),
          color: Math.random() < 0.20,
          duplex: Math.random() < 0.35,
          sizeBytes: 50_000 + rnd(2_000_000),
          jobAt,
        });
      }

      // USB events – konstrukce výrazně víc (CAD soubory), pak ostatní výjimečně
      const usbHeavy = ['Konstrukce', 'Vývoj', 'Vědecké oddělení', 'Marketing'].includes(u.dept);
      const usbProb = isCheater ? 0.4 : usbHeavy ? 0.15 : 0.05;
      if (Math.random() < usbProb) {
        const eventsToday = isCheater ? 5 + rnd(15) : 1 + rnd(3);
        for (let e = 0; e < eventsToday; e++) {
          const evAt = new Date(date);
          evAt.setHours(8 + rnd(10), rnd(60), rnd(60));
          const action = pick(ACTIONS);
          const ext = pick(USB_EXTENSIONS);
          usbEvents.push({
            deviceId: u.deviceId,
            userId: u.id,
            action,
            driveLetter: 'E:',
            driveLabel: pick(USB_LABELS),
            fileName: Math.random() < 0.35 ? `${pick(DOC_NAMES).toLowerCase().replace(/\s/g, '_')}_${rnd(1000)}.${ext}` : null,
            fileExt: ext,
            sizeBytes: action === 'DELETE' ? BigInt(0) : BigInt(1_000_000 + rnd(500_000_000)),
            eventAt: evAt,
          });
        }
      }
    }
  }

  if (printJobs.length > 0) {
    for (let i = 0; i < printJobs.length; i += 1000) {
      await prisma.printJob.createMany({ data: printJobs.slice(i, i + 1000) });
    }
  }
  if (usbEvents.length > 0) {
    for (let i = 0; i < usbEvents.length; i += 1000) {
      await prisma.usbFileEvent.createMany({ data: usbEvents.slice(i, i + 1000) });
    }
  }
  console.log(`Demo Print/USB: ${printJobs.length} úloh, ${usbEvents.length} USB událostí.`);
}

async function seedDeviceHealth(_users: Person[]): Promise<void> {
  const before = await prisma.deviceHealth.count();
  await ensureDemoDeviceHealth();
  const after = await prisma.deviceHealth.count();
  console.log(`Demo HW health: ${after - before} nových snapshotů (dříve ${before}).`);
}

async function seedAdditionalAdmins(): Promise<void> {
  const existing = await prisma.adminUser.count({ where: { username: { not: 'admin' } } });
  if (existing > 0) {
    console.log(`Demo admins preskoceny – uz existuje ${existing} dalsi admin uctu.`);
    return;
  }
  const password = hashPassword('Demo1234!');
  const accounts = [
    { username: 'manager.obchod', fullName: 'Jan Novák – ředitel obchodu', role: 'MANAGER', depts: ['Obchod ČR', 'Obchod Export', 'Obchod EU'] },
    { username: 'manager.vyroba', fullName: 'Petra Svobodová – vedoucí výroby', role: 'MANAGER', depts: ['Výroba — Hala 1', 'Výroba — Hala 2', 'Výroba — Hala 3', 'Montáže a servis'] },
    { username: 'manager.konstrukce', fullName: 'Marek Dvořák – vedoucí konstrukce', role: 'MANAGER', depts: ['Konstrukce', 'Vývoj'] },
    { username: 'manager.hr', fullName: 'Hana Procházková – personální ředitelka', role: 'MANAGER', depts: ['Personalistika', 'HR Akademie', 'Tréning'] },
    { username: 'it.spravce', fullName: 'Tomáš Procházka – IT správce', role: 'IT', depts: [] },
    { username: 'auditor', fullName: 'Hana Veselá – interní audit', role: 'VIEWER', depts: [] },
  ];
  for (const a of accounts) {
    const user = await prisma.adminUser.upsert({
      where: { username: a.username },
      update: {},
      create: { username: a.username, passwordHash: password, role: a.role, fullName: a.fullName, email: `${a.username}@sinsu-demo.cz` },
    });
    for (const dept of a.depts) {
      await prisma.adminUserDepartment.upsert({
        where: { adminId_department: { adminId: user.id, department: dept } },
        update: {},
        create: { adminId: user.id, department: dept },
      });
    }
  }
  console.log(`Demo admins: ${accounts.length} uctu (heslo "Demo1234!").`);
}

async function seedAccessAuditSamples(users: Person[]): Promise<void> {
  const existing = await prisma.accessAudit.count();
  if (existing > 5) {
    console.log(`Demo audit preskocen – uz existuje ${existing} zaznamu.`);
    return;
  }
  const admins = await prisma.adminUser.findMany({ select: { id: true, username: true } });
  if (admins.length === 0 || users.length === 0) return;

  const samples: Prisma.AccessAuditCreateManyInput[] = [];
  const now = Date.now();
  const action = ['VIEW', 'VIEW', 'VIEW', 'EXPORT', 'LOGIN'] as const;
  const detail = ['detail uzivatele 30 dni', 'integrity panel', 'score timeline', 'hourly export xlsx', 'admin sign-in'];
  for (let i = 0; i < 40; i++) {
    const admin = admins[i % admins.length];
    const target = users[(i * 73) % users.length];
    samples.push({
      adminId: admin.id,
      adminIdentity: admin.username,
      viewedUserId: action[i % action.length] === 'LOGIN' ? null : target.id,
      action: action[i % action.length],
      detail: detail[i % detail.length],
      createdAt: new Date(now - i * 6 * 3600 * 1000 - rnd(3600 * 1000)),
    });
  }
  await prisma.accessAudit.createMany({ data: samples });
  console.log(`Demo audit: ${samples.length} zaznamu o pristupech.`);
}

async function seedClassificationClaims(users: Person[]): Promise<void> {
  const existing = await prisma.classificationClaim.count();
  if (existing > 0) {
    console.log(`Demo claims preskoceny – ${existing} uz existuje.`);
    return;
  }
  if (users.length < 50) return;
  // Vyber uživatele z různých oddělení pro realističtější mix.
  const u1 = users.find((u) => u.dept === 'Konstrukce')!;
  const u2 = users.find((u) => u.dept === 'Personalistika')!;
  const u3 = users.find((u) => u.dept === 'IT')!;
  const u4 = users.find((u) => u.dept === 'Obchod ČR')!;
  const u5 = users.find((u) => u.dept === 'Marketing')!;
  const claims: Prisma.ClassificationClaimCreateManyInput[] = [
    { userId: u1.id, target: 'projectpro.exe', targetKind: 'APP', suggested: 'WORK', note: 'Naše interní projektová appka, ne zábava. Klasifikujte prosím jako práci.', status: 'OPEN' },
    { userId: u2.id, target: 'linkedin.com', targetKind: 'TITLE', suggested: 'WORK', note: 'Hledám kandidáty na pozice, není to soukromá zábava.', status: 'OPEN' },
    { userId: u3.id, target: 'youtube.com', targetKind: 'TITLE', suggested: 'WORK', note: 'Sledoval jsem školicí video o novém Kubernetes.', status: 'RESOLVED' },
    { userId: u4.id, target: 'utilitka.exe', targetKind: 'APP', suggested: 'WORK', note: 'Vlastní utility na export dat z CRM, je to pracovní nástroj.', status: 'OPEN' },
    { userId: u5.id, target: 'figma.com', targetKind: 'TITLE', suggested: 'WORK', note: 'Tvořím marketingové grafiky.', status: 'RESOLVED' },
  ];
  await prisma.classificationClaim.createMany({ data: claims });
  console.log(`Demo claims: ${claims.length} reklamaci klasifikace.`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
