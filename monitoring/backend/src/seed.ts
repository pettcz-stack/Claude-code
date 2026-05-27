// Demo data pro vývoj. Sinsu Platform-styl oddělení, vymyšlená jména, více lidí,
// včetně dvou s nepovolenými praktikami (simulátor myši, předmět na klávesnici).
// Vše jsou agregované metriky – žádný obsah.

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

// Provozovna podle útvaru (pro lokální IP v demu): 10.30=Hořovice, 10.20=Praha, 10.10=Brno.
function siteBaseFor(dept: string): string {
  if (['Výroba', 'Montáže a servis'].includes(dept)) return '10.30'; // Hořovice
  if (dept === 'Konstrukce') return '10.50'; // Osov
  if (dept === 'Obchod Export') return '10.10'; // Brno
  if (dept === 'Logistika') return '10.40'; // Ostrava
  return '10.20'; // Praha
}

type Behavior = 'normal' | 'slacker' | 'cheater_mouse' | 'cheater_keyboard';

// 100 zaměstnanců – realistické rozložení po útvarech výrobní firmy (Sinsu Platform-styl).
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

// Reálné aplikace Sinsu Platform podle útvaru. [proces, titulek okna|null].
type Pick = [string, string | null];
const T = (app: string, title: string | null = null): Pick => [app, title];
const POOL_COMMON: Pick[] = [T('outlook.exe'), T('teams.exe'), T('excel.exe'), T('chrome.exe', 'Intranet Sinsu'), T('chrome.exe', 'OKbase – docházka')];
const POOLS: Record<string, Pick[]> = {
  'Vedení': [T('navision.exe'), T('excel.exe'), T('powerpnt.exe'), T('outlook.exe'), T('teams.exe'), T('chrome.exe', 'Power BI – reporty')],
  'Obchod ČR': [T('crm.exe'), T('crm.exe'), T('navision.exe'), T('excel.exe'), T('outlook.exe'), T('teams.exe'), T('chrome.exe', 'Microsoft Dynamics CRM')],
  'Obchod Export': [T('crm.exe'), T('crm.exe'), T('navision.exe'), T('excel.exe'), T('outlook.exe'), T('teams.exe')],
  'Marketing': [T('powerpnt.exe'), T('crm.exe'), T('excel.exe'), T('outlook.exe'), T('teams.exe'), T('chrome.exe', 'SharePoint – dokumenty')],
  'Konstrukce': [T('sldworks.exe'), T('sldworks.exe'), T('sldworks.exe'), T('excel.exe'), T('outlook.exe'), T('teams.exe'), T('acrobat.exe')],
  'Výroba': [T('navision.exe'), T('navision.exe'), T('excel.exe'), T('teams.exe'), T('chrome.exe', 'Intranet Sinsu')],
  'Logistika': [T('navision.exe'), T('navision.exe'), T('excel.exe'), T('outlook.exe'), T('teams.exe')],
  'Montáže a servis': [T('crm.exe'), T('outlook.exe'), T('teams.exe'), T('chrome.exe', 'Intranet Sinsu')],
  'Ekonomika': [T('econ.exe'), T('econ.exe'), T('navision.exe'), T('excel.exe'), T('outlook.exe'), T('teams.exe')],
  'Personalistika': [T('okbase.exe'), T('okbase.exe'), T('excel.exe'), T('winword.exe'), T('outlook.exe'), T('teams.exe')],
  'IT': [T('code.exe'), T('code.exe'), T('teams.exe'), T('outlook.exe'), T('navision.exe'), T('chrome.exe', 'Intranet Sinsu')],
};
function buildPool(dept: string): Pick[] {
  return [...(POOLS[dept] ?? []), ...POOL_COMMON];
}
const BROWSER_WORK_TITLES = ['Intranet Sinsu', 'OKbase – docházka', 'SharePoint – dokumenty', 'Microsoft Dynamics CRM', 'Power BI – reporty'];
const BROWSER_NONWORK_TITLES = ['YouTube', 'Facebook', 'Instagram', 'Novinky.cz', 'Seznam.cz - Email', 'Alza.cz'];

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const rnd = (n: number) => Math.floor(Math.random() * n);

type Person = { id: string; deviceId: string; dept: string; behavior: Behavior; diligence: number; hoDip: number; monitors: number; workPool: Pick[]; siteBase: string };

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
      create: { sid, displayName: p.name, department: p.dept, email: `${i}@sinsu-demo.cz`, hourlyRate: rateFor(p.dept) },
    });
    const machineId = `DEMO-PC-${i + 1}`;
    const device = await prisma.device.upsert({
      where: { machineId },
      update: { lastSeen: new Date(), agentVersion: '0.1.0', os: 'Windows 11' },
      create: { machineId, hostname: `ALB-PC-${i + 1}`, os: 'Windows 11', agentVersion: '0.1.0', lastSeen: new Date() },
    });
    created.push({ id: user.id, deviceId: device.id, dept: p.dept, behavior: p.behavior, diligence: p.diligence, hoDip: hoDipFor(p.behavior), monitors: monitorsFor(p.dept), workPool: buildPool(p.dept), siteBase: siteBaseFor(p.dept) });
  }

  const userIds = created.map((c) => c.id);
  await prisma.activityInterval.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.activityHourly.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.dailyStat.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.dailyAppStat.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.absence.deleteMany({ where: { userId: { in: userIds } } });

  const today = floorToDay(new Date()); // začátek dnešního místního dne (ČR)
  const batch: Prisma.ActivityIntervalCreateManyInput[] = [];
  const absences: Prisma.AbsenceCreateManyInput[] = [];

  for (const c of created) {
    for (let dayBack = 0; dayBack < 30; dayBack++) {
      const dayStart = addDays(today, -dayBack); // místní půlnoc daného dne (UTC instant)
      const lp = localParts(dayStart);
      const dow = localDow(dayStart);
      if (dow === 0 || dow === 6) continue;
      const date = dayStart;

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
          const intervalStart = zonedToUtc(lp.year, lp.month, lp.day, hour, min); // místní 8–16 h (ČR)
          const row = makeRow(c, intervalStart, isHO);
          if (row) batch.push(row);
        }
      }
    }
  }

  // Idempotentni seed: pokud uz intervaly existuji (z drivejsiho behu kdy byl
  // sentinel jine verze), preskoc, jinak by createMany padl na UNIQUE constraint.
  // SQLite/Prisma nepodporuje skipDuplicates v createMany pro tento driver.
  const existingIntervals = await prisma.activityInterval.count();
  if (existingIntervals === 0) {
    for (let i = 0; i < batch.length; i += 1000) {
      await prisma.activityInterval.createMany({ data: batch.slice(i, i + 1000) });
    }
    if (absences.length) await prisma.absence.createMany({ data: absences });
  } else {
    // eslint-disable-next-line no-console
    console.log(`Demo intervaly preskoceny – ${existingIntervals} uz existuje.`);
  }

  // Demo licence: reálné placené aplikace Sinsu Platform + seaty/cena (CZK/měsíc/licence).
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

  // Demo Print & USB events – sekce v dashboardu by jinak byla prázdná.
  await seedPrintAndUsb(created);

  // HW health snapshots pro IT > Zdraví zařízení tab.
  await seedDeviceHealth(created);

  // Další admin účty pro Přístupy sekci (manager, IT, viewer).
  await seedAdditionalAdmins();

  // Vzorek auditu přístupů – ukáže "Kdo se na koho díval".
  await seedAccessAuditSamples(created);

  // 2-3 OPEN classification claims (zaměstnanec si stěžuje na kategorizaci).
  await seedClassificationClaims(created);

  const hours = await aggregateAll();
  // eslint-disable-next-line no-console
  console.log(`Seed hotov: ${created.length} uživatelů, ${batch.length} intervalů, ${absences.length} HO dnů, ${hours} agregátů.`);
}

/**
 * Demo data pro Tisk & USB sekce v dashboardu. Bez nich vypadá tab prázdně
 * a investor / zákazník netuší, jak by feature vypadala v reálu.
 *
 * Hodnoty:
 *  - 30 dní zpětně, ~70% uživatelů aspoň občas tiskne (HR a Vedení nejvíc).
 *  - "Cheater" profily mají abnormálně velké objemy (vzorky pro odbor security).
 *  - USB události naopak řidší – běžně 1-2 events / týden / user, ale Konstrukce
 *    a Vedení občas vynáší CAD soubory nebo prezentace.
 */
async function seedPrintAndUsb(users: Person[]) {
  // Idempotentní: pokud uz existuji Print/USB zaznamy, preskoc.
  // Resi pripad, kdy uzivatel upgraduje seed bez `docker compose down -v`
  // (volume s .seeded sentinelem zustal, ale Print/USB tabulky jsou prazdne).
  const existingPrint = await prisma.printJob.count();
  const existingUsb = await prisma.usbFileEvent.count();
  if (existingPrint > 0 || existingUsb > 0) {
    // eslint-disable-next-line no-console
    console.log(`Demo Print/USB preskocen – uz existuji zaznamy (${existingPrint} tisk + ${existingUsb} USB).`);
    return;
  }

  const PRINTERS = ['HP LaserJet M404 (Tiskárna kancelář 1)', 'Canon iR-ADV C5550 (Tiskárna recepce)', 'Brother HL-L2370 (Tiskárna sklad)'];
  const PAPER_SIZES = ['A4', 'A4', 'A4', 'A4', 'A3', 'A4', 'A5']; // distribuce
  const DOC_NAMES = ['Faktura', 'Smlouva s dodavatelem', 'Cenová nabídka', 'Týdenní report', 'Technický výkres', 'Personální podklady', 'Návrh dovolené'];
  const USB_LABELS = ['SanDisk-USB-32GB', 'Kingston-DataTraveler', 'Externí HDD WD', 'Apple TimeMachine'];
  const USB_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'jpg', 'png', 'dwg', 'zip', 'mp4'];
  const ACTIONS = ['CREATE', 'WRITE', 'READ', 'DELETE'];

  const today = new Date();
  const printJobs: Prisma.PrintJobCreateManyInput[] = [];
  const usbEvents: Prisma.UsbFileEventCreateManyInput[] = [];

  for (const u of users) {
    const isHeavyPrinter = u.dept === 'Personalistika' || u.dept === 'Vedení' || u.dept === 'Ekonomika';
    const isCheater = u.behavior.startsWith('cheater');
    const printsPerWeek = isCheater ? 80 + rnd(40) : isHeavyPrinter ? 15 + rnd(15) : 3 + rnd(6);

    for (let d = 0; d < 30; d++) {
      const date = new Date(today); date.setDate(date.getDate() - d);
      // Tisk: jeden uživatel v den dělá 0–N úloh
      const jobsToday = Math.random() < 0.4 ? Math.round(printsPerWeek / 7 * (0.5 + Math.random())) : 0;
      for (let j = 0; j < jobsToday; j++) {
        const jobAt = new Date(date);
        jobAt.setHours(isCheater && Math.random() < 0.3 ? 19 + rnd(4) : 8 + rnd(8), rnd(60), rnd(60));
        printJobs.push({
          deviceId: u.deviceId,
          userId: u.id,
          printerName: pick(PRINTERS),
          documentName: Math.random() < 0.6 ? `${pick(DOC_NAMES)} ${1000 + rnd(9000)}.pdf` : null,
          pages: 1 + rnd(isCheater ? 50 : 10),
          copies: Math.random() < 0.1 ? 1 + rnd(5) : 1,
          paperSize: pick(PAPER_SIZES),
          color: Math.random() < 0.25,
          duplex: Math.random() < 0.4,
          sizeBytes: 50_000 + rnd(2_000_000),
          jobAt,
        });
      }

      // USB: výrazně řidší než tisk
      if (Math.random() < (isCheater ? 0.5 : 0.1)) {
        const eventsToday = isCheater ? 5 + rnd(20) : 1 + rnd(3);
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
            fileName: Math.random() < 0.4 ? `${pick(DOC_NAMES).toLowerCase().replace(/\s/g, '_')}_${rnd(1000)}.${ext}` : null,
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
  // eslint-disable-next-line no-console
  console.log(`Demo Print/USB: ${printJobs.length} tiskových úloh, ${usbEvents.length} USB událostí.`);

  // Zapni Print & USB tracking v Settings, aby data byla viditelná v UI.
  await saveSettings({
    printTrackingEnabled: true,
    capturePrintDocName: true,
    usbTrackingEnabled: true,
    captureUsbFilename: true,
  });
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

/**
 * Demo HW snapshots pro IT > Zdraví zařízení. Existující service vrací voidly
 * (zaměří se na demo devices), tady jen tenký wrapper s logem.
 */
async function seedDeviceHealth(_users: Person[]): Promise<void> {
  const before = await prisma.deviceHealth.count();
  await ensureDemoDeviceHealth();
  const after = await prisma.deviceHealth.count();
  // eslint-disable-next-line no-console
  console.log(`Demo HW health: ${after - before} novych snapshotu (drive ${before}).`);
}

/**
 * Demo admin účty – pro Přístupy sekci. Jeden ADMIN (default), 2× MANAGER
 * s přiřazenými odděleními, 1× IT, 1× VIEWER. Manageři mají rozsah jen
 * na svá oddělení, ať uživatel vidí RBAC v praxi.
 */
async function seedAdditionalAdmins(): Promise<void> {
  const existing = await prisma.adminUser.count({ where: { username: { not: 'admin' } } });
  if (existing > 0) {
    // eslint-disable-next-line no-console
    console.log(`Demo admins preskoceny – uz existuje ${existing} dalsi admin uctu.`);
    return;
  }

  const password = hashPassword('Demo1234!');
  const accounts = [
    { username: 'manager.obchod', fullName: 'Jan Novák – ředitel obchodu', role: 'MANAGER', depts: ['Obchod ČR', 'Obchod Export'] },
    { username: 'manager.vyroba', fullName: 'Petra Svobodová – vedoucí výroby', role: 'MANAGER', depts: ['Výroba', 'Montáže a servis'] },
    { username: 'it.spravce', fullName: 'Tomáš Procházka – IT správce', role: 'IT', depts: [] },
    { username: 'auditor', fullName: 'Hana Veselá – interní audit', role: 'VIEWER', depts: [] },
  ];

  for (const a of accounts) {
    const user = await prisma.adminUser.upsert({
      where: { username: a.username },
      update: {},
      create: {
        username: a.username,
        passwordHash: password,
        role: a.role,
        fullName: a.fullName,
        email: `${a.username}@sinsu-demo.cz`,
      },
    });
    for (const dept of a.depts) {
      await prisma.adminUserDepartment.upsert({
        where: { adminId_department: { adminId: user.id, department: dept } },
        update: {},
        create: { adminId: user.id, department: dept },
      });
    }
  }
  // eslint-disable-next-line no-console
  console.log(`Demo admins: ${accounts.length} uctu (heslo "Demo1234!" pro vsechny – jen demo).`);
}

/**
 * Demo audit přístupů – ukáže "Kdo se na koho díval" v Administraci.
 * Pár záznamů z posledních dní: admin koukl na top podezřelé, IT exportoval
 * intervaly, manager prohlížel své oddělení, atd.
 */
async function seedAccessAuditSamples(users: Person[]): Promise<void> {
  const existing = await prisma.accessAudit.count();
  if (existing > 5) {
    // eslint-disable-next-line no-console
    console.log(`Demo audit preskocen – uz existuje ${existing} zaznamu.`);
    return;
  }
  const admins = await prisma.adminUser.findMany({ select: { id: true, username: true } });
  if (admins.length === 0 || users.length === 0) return;

  const samples: Prisma.AccessAuditCreateManyInput[] = [];
  const now = Date.now();
  const action = ['VIEW', 'VIEW', 'VIEW', 'EXPORT', 'LOGIN'] as const;
  const detail = ['detail uzivatele 30 dni', 'integrity panel', 'score timeline', 'hourly export xlsx', 'admin sign-in'];

  for (let i = 0; i < 18; i++) {
    const admin = admins[i % admins.length];
    const target = users[(i * 7) % users.length];
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
  // eslint-disable-next-line no-console
  console.log(`Demo audit: ${samples.length} zaznamu o pristupech.`);
}

/**
 * Demo classification claims – pár zaměstnanců si stěžuje, že jejich
 * pracovní aplikace je nesprávně klasifikovaná. Pro Administrace → Klasifikace
 * → záložka Claims.
 */
async function seedClassificationClaims(users: Person[]): Promise<void> {
  const existing = await prisma.classificationClaim.count();
  if (existing > 0) {
    // eslint-disable-next-line no-console
    console.log(`Demo claims preskoceny – ${existing} uz existuje.`);
    return;
  }
  if (users.length < 3) return;
  const claims: Prisma.ClassificationClaimCreateManyInput[] = [
    {
      userId: users[0].id,
      target: 'projectpro.exe',
      targetKind: 'APP',
      suggested: 'WORK',
      note: 'Tohle je naše interní projektová appka, ne zábava. Klasifikujte prosím jako práci.',
      status: 'OPEN',
    },
    {
      userId: users[5 % users.length].id,
      target: 'linkedin.com',
      targetKind: 'TITLE',
      suggested: 'WORK',
      note: 'Hledám obchodní leady, není to soukromá zábava.',
      status: 'OPEN',
    },
    {
      userId: users[12 % users.length].id,
      target: 'youtube.com',
      targetKind: 'TITLE',
      suggested: 'WORK',
      note: 'Sledoval jsem školicí video o novém CRM. Ne reklamace zatím.',
      status: 'RESOLVED',
    },
  ];
  await prisma.classificationClaim.createMany({ data: claims });
  // eslint-disable-next-line no-console
  console.log(`Demo claims: ${claims.length} reklamaci klasifikace.`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
