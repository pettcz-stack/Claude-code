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
import { aggregateAllFast } from './services/aggregate.js';
import { ensureDefaultCategories } from './services/categories.js';
import { DEFAULT_WEB_RULES } from './services/classify.js';
import { ensureDefaultTips } from './services/tips.js';
import { ensureDefaultSites } from './services/sites.js';
import { saveSettings } from './services/settings.js';
import { ensureDemoDeviceHealth } from './services/healthDemo.js';
import { hashPassword } from './auth.js';
import { floorToDay, addDays, localParts, localDow, zonedToUtc } from './services/tz.js';
import { isCzHoliday } from './services/workcal.js';

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

// Persona – široká škála archetypů, aby dashboard nebyl flat.
// Distribuce mezi 1991 lidmi (přibližně):
//   top              ~8%   – exemplární zaměstnanec, dlouhé focus bloky
//   normal           ~28%  – průměrný pracovník
//   chatty           ~9%   – hodně Teams/Slack, málo "deep work"
//   social_media     ~11%  – pracuje, ale často FB/Insta/LinkedIn
//   streamer         ~5%   – YouTube/Netflix v pozadí
//   gamer            ~3%   – přes oběd hry
//   slacker          ~9%   – viditelně nízká aktivita
//   ghost            ~7%   – sotva zapne PC (terén, schůzky, klidnou má kávu)
//   absent_frequent  ~4%   – často nemocný/dovolená
//   sales_road       ~5%   – obchodník na cestách, krátké PC bursty
//   manager_busy     ~5%   – manažer, hodně schůzek (PC locked = na meetingu)
//   cheater_mouse    5 ks  – mouse jiggler
//   cheater_keyboard 4 ks  – AHK keyboard bot
//   cheater_subtle   6 ks  – podvádí jen Po/St
type Persona =
  | 'top' | 'normal' | 'chatty' | 'social_media' | 'streamer' | 'gamer'
  | 'slacker' | 'ghost' | 'absent_frequent' | 'sales_road' | 'manager_busy'
  | 'cheater_mouse' | 'cheater_keyboard' | 'cheater_subtle';

/**
 * Pokles efektivity při home office, kalibrovaný dle reálných výzkumů:
 *  - Stanford Bloom (2015): +13 % u call centra
 *  - McKinsey (2020): −20 % brzy po pandemii, postupně narovnal
 *  - ActivTrak benchmark (2023): průměr −8 % active time u hybrid pracovníků
 *  - Microsoft WTI (2023): coordination work down, focus work neutral
 *
 * Reálná čísla závisí silně na typu zaměstnance. Některé persony doma vykvetou
 * (focus), jiné selhávají kvůli distrakcím (Netflix/PS5/lednice).
 *
 * Průměr napříč firmou cca −15-20 %, což odpovídá konsenzu z výzkumu.
 */
function hoDipFor(p: Persona): number {
  switch (p) {
    case 'top':             return 0.08;  // workaholic, doma stejně válí
    case 'normal':          return 0.18;  // průměrný dip dle ActivTrak/McKinsey
    case 'chatty':          return 0.22;  // doma málo Teams meetingů = focus, ale i méně práce
    case 'social_media':    return 0.30;  // doma víc distrakcí (FB/Insta na telefonu)
    case 'streamer':        return 0.42;  // doma Netflix na velký TV
    case 'slacker':         return 0.45;  // doma si dovolí ještě víc
    case 'gamer':           return 0.55;  // PS5/Xbox přímo vedle
    case 'ghost':           return 0.05;  // skoro nepoužívá PC tak jako tak
    case 'absent_frequent': return 0.22;
    case 'sales_road':      return 0.10;  // pořád telefonuje, prostředí jedno
    case 'manager_busy':    return 0.15;  // meetingy probíhají stejně
    case 'cheater_mouse':
    case 'cheater_keyboard':
    case 'cheater_subtle':  return 0;     // strojový vzor je nepřerušitelný
  }
}

/**
 * Per-persona baseDiligence range = jakou část intervalu je člověk aktivně
 * (typing + mouse) když je u PC. Široký range mezi/uvnitř person → reálná variance.
 *
 * Tahle hodnota se přímo promítne do active/idle poměru = "% pracovní doby"
 * v dashboardu. Tj. baseDiligence 0.80 → ~80% aktivně, 20% idle.
 */
function baseDiligenceRangeFor(p: Persona): [number, number] {
  // Hodnoty kalibrovány na realisticky úspěšnou firmu:
  //   firm-wide skóre ~ 70 %, top ~ 90 %, normal ~ 75 %, slackeři ~ 30 %
  switch (p) {
    case 'top':             return [0.94, 0.99];
    case 'normal':          return [0.82, 0.94]; // většina firmy spadne sem (~70-80% skóre)
    case 'chatty':          return [0.65, 0.85];
    case 'social_media':    return [0.55, 0.80];
    case 'streamer':        return [0.50, 0.72];
    case 'gamer':           return [0.50, 0.75];
    case 'slacker':         return [0.25, 0.50];
    case 'ghost':           return [0.75, 0.92]; // operátor u stroje – když u PC tak makají
    case 'absent_frequent': return [0.65, 0.85];
    case 'sales_road':      return [0.78, 0.93]; // krátké soustředěné bursty
    case 'manager_busy':    return [0.70, 0.88];
    case 'cheater_mouse':
    case 'cheater_keyboard':
    case 'cheater_subtle':  return [0.95, 0.98];
  }
}

/**
 * Pravděpodobnost že interval bude "away" (= člověk u PC chvíli není).
 * **TOTO JE REALITA**: většina kancelářských zaměstnanců je u PC celých 6-7 h denně,
 * jen občas chodí na schůzku / na záchod / ke kafi.
 *
 * Hodnoty kalibrovány tak aby celofiremní průměr "u PC" činil ~75-80% pracovní
 * doby = ~6-6.5 h ze 8h. Realisticky.
 *
 * Výjimky (málo lidí, big effect):
 * - manager_busy 30%: hodně schůzek
 * - sales_road 40%: cestování za klienty
 * - ghost (jen výroba/sklad) 60%: operátoři u strojů
 */
function lockProbabilityFor(p: Persona): number {
  switch (p) {
    case 'ghost':           return 0.60; // výroba/sklad – operátoři
    case 'absent_frequent': return 0.18; // má jen víc absencí, ne víc lock
    case 'sales_road':      return 0.40;
    case 'manager_busy':    return 0.30;
    case 'chatty':          return 0.15; // občas přijde na meeting
    case 'slacker':         return 0.18; // občas se zdrží na cigaretě
    case 'social_media':    return 0.12;
    case 'streamer':        return 0.08;
    case 'gamer':           return 0.10;
    case 'top':             return 0.03; // top performeři skoro pořád u PC
    case 'normal':          return 0.07;
    case 'cheater_mouse':
    case 'cheater_keyboard':
    case 'cheater_subtle':  return 0;
  }
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

/**
 * Deterministická "kvalita dne" pro daného člověka. Hash userId+dayKey →
 * multiplier 0.55 - 1.45 (dramatický spread: skvělé dny, mizerné dny).
 * `consistency` per-user dále reguluje šíři: erratický pracovník má větší
 * rozkmit (0.4-1.6), stabilní pracovník menší (0.85-1.15).
 *
 * Bez tohoto by všechny dny vypadaly identicky (flat data).
 */
function dayQualityHash(userId: string, dayMs: number, consistency: number): number {
  let h = 0x12345678;
  const key = `${userId}#${dayMs}`;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) - h) + key.charCodeAt(i);
    h |= 0;
  }
  const n = ((h >>> 0) % 10000) / 10000; // 0..1
  // consistency 1.0 = stabilní (range 0.85-1.15), 0.0 = erratický (range 0.5-1.5)
  const half = 0.50 - consistency * 0.35; // 0.15 .. 0.50
  return (1.0 - half) + n * (2 * half);
}

/**
 * Křivka výkonu během dne (8:00 - 16:00). Vrací multiplier 0..1.2 pro daný interval.
 * Modeluje:
 *   08:00-09:00 → 0.65  warmup, e-maily, kafe
 *   09:00-11:30 → 1.10  dopolední peak (deep work)
 *   11:30-12:00 → 0.85  pre-lunch wind-down
 *   12:00-12:30 → 0.15  lunch (většinou idle/locked)
 *   12:30-13:00 → 0.50  zpět od oběda, pomalu se rozjíždí
 *   13:00-14:30 → 1.05  odpolední peak
 *   14:30-15:30 → 0.95  pozdní odpoledne
 *   15:30-16:00 → 0.55  end-of-day, balení do "tašky"
 */
function hourCurve(hour: number, minute: number): number {
  const t = hour + minute / 60;
  if (t < 9.0) return 0.65;
  if (t < 11.5) return 1.10;
  if (t < 12.0) return 0.85;
  if (t < 12.5) return 0.15; // oběd
  if (t < 13.0) return 0.50;
  if (t < 14.5) return 1.05;
  if (t < 15.5) return 0.95;
  return 0.55;
}

type PersonSpec = {
  name: string; dept: string; persona: Persona;
  baseDiligence: number; lockProb: number; consistency: number;
  fridayMul: number; startHour: number; lunchOffset: number; rate: number;
  // Demo extras – pro showcase scénáře
  showcase?: 'hero' | 'villain' | 'newHire' | 'returnFromLeave' | 'hybridWorker';
  /** Datum, od kdy se generují intervaly (jen pro newHire). Default = -29 dní zpět. */
  startedDaysAgo?: number;
  /** Týdenní rampa diligence (newHire/returning). Vrátí multiplier pro daný `weekFromStart`. */
  rampFn?: (weekFromStart: number) => number;
  /** HO clustering pattern (hybridWorker). True když daný den v týdnu = HO. dow: 0=Ne..6=So */
  hybridHoDow?: Set<number>;
};

function genPeople(): PersonSpec[] {
  rngState = 987654321; // reset pro deterministické pořadí
  const used = new Set<string>();
  const people: PersonSpec[] = [];

  // Plochý seznam oddělení (nafouknutý podle size)
  const depts: string[] = [];
  for (const d of DEPT_PLAN) {
    for (let i = 0; i < d.size; i++) depts.push(d.name);
  }

  for (const dept of depts) {
    let name = '';
    let unique = false;
    for (let tries = 0; tries < 500; tries++) {
      const male = rng() < 0.55;
      name = male
        ? `${pickFrom(FIRST_M)} ${pickFrom(LAST_M)}`
        : `${pickFrom(FIRST_F)} ${pickFrom(LAST_F)}`;
      if (!used.has(name)) { used.add(name); unique = true; break; }
    }
    if (!unique) {
      name = `${name} ${people.length + 1}`;
      used.add(name);
    }
    // Persona distribution (rng() deterministický → reseed = stejné osoby).
    // Manažeři u manažerských oddělení automaticky 'manager_busy', terénní
    // role automaticky 'sales_road' / 'ghost' s vyšší pravděpodobností.
    let persona: Persona;
    const r = rng();
    if (dept === 'Vedení') {
      // Vedení – manažeři, hodně schůzek
      persona = r < 0.70 ? 'manager_busy' : r < 0.90 ? 'top' : 'normal';
    } else if (dept === 'Audit' || dept === 'Právní' || dept === 'Compliance') {
      // Vážná oddělení, mostly top performers
      persona = r < 0.30 ? 'top' : r < 0.85 ? 'normal' : r < 0.95 ? 'chatty' : 'social_media';
    } else if (PRODUCTION_DEPTS.has(dept)) {
      // Výroba/sklad = operátoři u strojů (ghost), občas vedoucí směny normální
      persona = r < 0.75 ? 'ghost' : r < 0.85 ? 'normal' : r < 0.93 ? 'absent_frequent' : 'slacker';
    } else if (dept.startsWith('Obchod')) {
      // Obchodníci – někteří na cestách, někteří v kanceláři
      persona = r < 0.20 ? 'sales_road' : r < 0.30 ? 'top' : r < 0.55 ? 'normal' : r < 0.70 ? 'chatty' : r < 0.82 ? 'social_media' : r < 0.90 ? 'slacker' : r < 0.95 ? 'streamer' : 'gamer';
    } else if (dept === 'Zákaznický servis' || dept === 'Reklamace') {
      // Hodně Teams/Slack/CRM = chatty dominantní
      persona = r < 0.40 ? 'chatty' : r < 0.55 ? 'normal' : r < 0.70 ? 'social_media' : r < 0.80 ? 'top' : r < 0.90 ? 'slacker' : r < 0.97 ? 'streamer' : 'gamer';
    } else if (dept === 'IT' || dept === 'Vývoj' || dept === 'Datacentrum') {
      // Vývojáři – často deep focus, někdo streamer (hudba v pozadí)
      persona = r < 0.20 ? 'top' : r < 0.55 ? 'normal' : r < 0.65 ? 'streamer' : r < 0.75 ? 'chatty' : r < 0.85 ? 'social_media' : r < 0.92 ? 'gamer' : r < 0.97 ? 'slacker' : 'manager_busy';
    } else if (dept === 'Recepce') {
      // Recepce = pořád u PC, ale hodně přerušení (návštěvy)
      persona = r < 0.40 ? 'chatty' : r < 0.70 ? 'normal' : r < 0.85 ? 'social_media' : 'top';
    } else {
      // Standardní rozložení pro kancelářské profese.
      // KLÍČOVÁ ZMĚNA: 80%+ "běžných u PC" person (normal/top/chatty/social/streamer/slacker),
      // jen ~5% terénních / hodně absentních. Ne 25% jak dřív.
      if (r < 0.10) persona = 'top';
      else if (r < 0.45) persona = 'normal';
      else if (r < 0.60) persona = 'chatty';
      else if (r < 0.72) persona = 'social_media';
      else if (r < 0.78) persona = 'streamer';
      else if (r < 0.81) persona = 'gamer';
      else if (r < 0.90) persona = 'slacker';
      else if (r < 0.94) persona = 'absent_frequent'; // jen 4% – víc absencí, ne víc lock
      else if (r < 0.97) persona = 'sales_road';      // 3%
      else persona = 'manager_busy';                  // 3%
    }

    // Individuální baseDiligence ZE ŠIROKÉHO RANGU dané persony – ne fixed value.
    // Dva "normal" lidé budou mít diligence 0.55 vs 0.85 = výrazně jiný profil.
    const [dMin, dMax] = baseDiligenceRangeFor(persona);
    const baseDiligence = dMin + rng() * (dMax - dMin);

    // Individuální lockProb (±5 % okolo persony) – ne každý "normal" je stejně přítomný
    const lockProb = Math.max(0, Math.min(0.95, lockProbabilityFor(persona) + (rng() - 0.5) * 0.10));

    // Consistency: 0 = velmi erratický (rozkmit dny ±50 %), 1 = stabilní (±15 %)
    // Cheateři jsou strojově stabilní (~1.0), slackeři/ghost erratičtí.
    let consistency: number;
    if (persona.startsWith('cheater')) consistency = 0.95;
    else if (persona === 'top') consistency = 0.70 + rng() * 0.20;
    else if (persona === 'slacker' || persona === 'ghost') consistency = 0.10 + rng() * 0.30;
    else consistency = 0.35 + rng() * 0.45;

    // Friday dip per-person
    const fridayMul = 0.65 + rng() * 0.30; // 0.65-0.95 (širší než dřív)
    // Pracovní okno
    const startRoll = rng();
    const startHour = startRoll < 0.15 ? 7 : startRoll < 0.85 ? 8 : 9;
    const lunchOffset = (rng() < 0.5 ? -1 : 1) * Math.floor(rng() * 3) * 15;
    const [rateMin, rateMax] = rateRangeFor(dept);
    const rate = rngRange(rateMin, rateMax);
    people.push({ name, dept, persona, baseDiligence, lockProb, consistency, fridayMul, startHour, lunchOffset, rate });
  }

  // 15 cheaterů (0.75% z 1991) – 3 typy. Distribuovaní napříč odděleními ať detekce
  // má co řešit v různých kontextech.
  const cheaterAssign: { dept: string; persona: Persona }[] = [
    // Mouse jiggler (5 lidí) – nejtypičtější
    { dept: 'Obchod Export',     persona: 'cheater_mouse' },
    { dept: 'Obchod ČR',         persona: 'cheater_mouse' },
    { dept: 'Marketing',         persona: 'cheater_mouse' },
    { dept: 'Logistika',         persona: 'cheater_mouse' },
    { dept: 'Sklad',             persona: 'cheater_mouse' },
    // AHK keyboard bot (4 lidi)
    { dept: 'Ekonomika',         persona: 'cheater_keyboard' },
    { dept: 'Zákaznický servis', persona: 'cheater_keyboard' },
    { dept: 'IT',                persona: 'cheater_keyboard' },
    { dept: 'Personalistika',    persona: 'cheater_keyboard' },
    // Subtle (6 lidí) – cheatuje jen Po a St, ostatní dny normální. Tady je
    // potřeba lepší integrity-check, aby je detekce zachytila.
    { dept: 'Obchod EU',         persona: 'cheater_subtle' },
    { dept: 'Marketing',         persona: 'cheater_subtle' },
    { dept: 'Reklamace',         persona: 'cheater_subtle' },
    { dept: 'Konstrukce',        persona: 'cheater_subtle' },
    { dept: 'Kvalita',           persona: 'cheater_subtle' },
    { dept: 'Tréning',           persona: 'cheater_subtle' },
  ];
  for (const c of cheaterAssign) {
    const target = people.find((p) => p.dept === c.dept && p.persona === 'normal');
    if (target) {
      target.persona = c.persona;
      const [dMin, dMax] = baseDiligenceRangeFor(c.persona);
      target.baseDiligence = dMin + rng() * (dMax - dMin);
      target.lockProb = lockProbabilityFor(c.persona);
      target.consistency = c.persona.startsWith('cheater') ? 0.95 : target.consistency;
    }
  }

  // ── Showcase personas: memorable lidé pro demo "story-mode" ─────────────
  // Hardcoded konkrétní jména a profil. Admin při demu může říct:
  // "Tady Lisa Svobodová z Vývoje, 92% – naše hvězda. A tady Boris Novotný
  // ze Skladu, 28% + mouse jiggler – problém co řešíme."
  // Tyto lidi PŘEPÍŠEM nad standardní distribuci.
  function applyShowcase(index: number, spec: Partial<PersonSpec> & { name: string; dept: string }): void {
    if (index >= people.length) return;
    const target = people[index];
    Object.assign(target, spec);
  }

  // Najdi prvního člověka v daném dept a aplikuj showcase
  function applyByDept(dept: string, occurrence: number, spec: Partial<PersonSpec> & { name: string }): void {
    let count = 0;
    for (let i = 0; i < people.length; i++) {
      if (people[i].dept === dept) {
        if (count === occurrence) { applyShowcase(i, { ...spec, dept }); return; }
        count++;
      }
    }
  }

  // HERO #1: Lisa Svobodová – Vývoj – 92 % top performer
  applyByDept('Vývoj', 0, {
    name: 'Lisa Svobodová', persona: 'top',
    baseDiligence: 0.96, consistency: 0.90, lockProb: 0.04,
    fridayMul: 0.92, showcase: 'hero',
  });

  // HERO #2: Marek Beneš – Audit – 95 % konzistentní
  applyByDept('Audit', 0, {
    name: 'Marek Beneš', persona: 'top',
    baseDiligence: 0.97, consistency: 0.92, lockProb: 0.03,
    fridayMul: 0.93, showcase: 'hero',
  });

  // VILLAIN #1: Boris Novotný – Sklad – 25 %, mouse jiggler
  // Bude mít i evasion app activity (přidá se v seedEvasionActivity přes findCandidate)
  applyByDept('Sklad', 0, {
    name: 'Boris Novotný', persona: 'cheater_mouse',
    baseDiligence: 0.95, consistency: 0.95, lockProb: 0,
    fridayMul: 0.95, showcase: 'villain',
  });

  // VILLAIN #2: Karel Dvořák – Marketing – chronický slacker s evasion
  applyByDept('Marketing', 0, {
    name: 'Karel Dvořák', persona: 'slacker',
    baseDiligence: 0.28, consistency: 0.20, lockProb: 0.25,
    fridayMul: 0.65, showcase: 'villain',
  });

  // NEW HIRE: Anna Procházková – Personalistika – nastoupila před 12 dny
  // Rampa: týden 1 = 0.55× diligence (učení), týden 2 = 0.80×, týden 3+ = 0.95×
  applyByDept('Personalistika', 0, {
    name: 'Anna Procházková', persona: 'normal',
    baseDiligence: 0.82, consistency: 0.70, lockProb: 0.08,
    fridayMul: 0.88, showcase: 'newHire',
    startedDaysAgo: 12,
    rampFn: (week) => week === 0 ? 0.55 : week === 1 ? 0.80 : 0.95,
  });

  // RETURN FROM LEAVE: Eva Procházková – Konstrukce – týden NEMOC, vrací se
  applyByDept('Konstrukce', 0, {
    name: 'Eva Procházková', persona: 'normal',
    baseDiligence: 0.86, consistency: 0.75, lockProb: 0.06,
    fridayMul: 0.90, showcase: 'returnFromLeave',
  });

  // HYBRID WORKER: Tomáš Kratochvíl – Vývoj – Po-St kancelář, Čt-Pá HO
  applyByDept('Vývoj', 1, {
    name: 'Tomáš Kratochvíl', persona: 'normal',
    baseDiligence: 0.85, consistency: 0.78, lockProb: 0.07,
    fridayMul: 0.88, showcase: 'hybridWorker',
    hybridHoDow: new Set([4, 5]), // čt, pá
  });

  // Druhý hybrid – Markéta Holubová – Ekonomika
  applyByDept('Ekonomika', 0, {
    name: 'Markéta Holubová', persona: 'normal',
    baseDiligence: 0.84, consistency: 0.72, lockProb: 0.09,
    fridayMul: 0.85, showcase: 'hybridWorker',
    hybridHoDow: new Set([2, 4]), // út, čt (alternativní pattern)
  });

  return people;
}

const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const rnd = (n: number) => Math.floor(Math.random() * n);

type Person = {
  id: string; deviceId: string; dept: string;
  persona: Persona; baseDiligence: number; hoDip: number;
  lockProb: number; consistency: number;
  fridayMul: number; startHour: number; lunchOffset: number;
  monitors: number; workPool: Pick[]; siteBase: string;
  // Showcase
  showcase?: 'hero' | 'villain' | 'newHire' | 'returnFromLeave' | 'hybridWorker';
  startedDaysAgo?: number;
  rampFn?: (weekFromStart: number) => number;
  hybridHoDow?: Set<number>;
};

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
        update: { lastSeen: new Date(), agentVersion: '0.9.4', os: idx % 5 === 0 ? 'macOS 14' : 'Windows 11' },
        create: { machineId, hostname: `SINSU-PC-${String(idx + 1).padStart(4, '0')}`, os: idx % 5 === 0 ? 'macOS 14' : 'Windows 11', agentVersion: '0.9.4', lastSeen: new Date() },
      });
      created.push({
        id: user.id,
        deviceId: device.id,
        dept: p.dept,
        persona: p.persona,
        baseDiligence: p.baseDiligence,
        hoDip: hoDipFor(p.persona),
        lockProb: p.lockProb,
        consistency: p.consistency,
        fridayMul: p.fridayMul,
        startHour: p.startHour,
        lunchOffset: p.lunchOffset,
        showcase: p.showcase,
        startedDaysAgo: p.startedDaysAgo,
        rampFn: p.rampFn,
        hybridHoDow: p.hybridHoDow,
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

  // ── Plán absencí: kontinuální dovolené (5 dní v kuse), 3-denní nemoci, 1-denní wfh ──
  // Bez tohoto by každý člověk měl náhodné 1-denní výpadky a kalendář by vypadal jak švýcarský sýr.
  // S tímhle uvidíš v "Absences" view skutečné dovolenkové týdny.
  function planAbsences(c: Person): { day: number; type: 'NEMOC' | 'DOVOLENA' | 'HOME_OFFICE' }[] {
    if (c.persona.startsWith('cheater')) return [];
    const plan: { day: number; type: 'NEMOC' | 'DOVOLENA' | 'HOME_OFFICE' }[] = [];

    // SHOWCASE: returnFromLeave – týdenní NEMOC v dnech 17-21 (před ~3 týdny)
    if (c.showcase === 'returnFromLeave') {
      for (let i = 0; i < 5; i++) plan.push({ day: 17 + i, type: 'NEMOC' });
      return plan;
    }
    // SHOWCASE: hybridWorker – HO podle hybridHoDow (deterministicky kazdý den v týdnu)
    if (c.showcase === 'hybridWorker' && c.hybridHoDow) {
      const today = floorToDay(new Date());
      for (let dayBack = 1; dayBack <= 29; dayBack++) {
        const ds = addDays(today, -dayBack);
        const dow = localDow(ds);
        if (c.hybridHoDow.has(dow)) plan.push({ day: dayBack, type: 'HOME_OFFICE' });
      }
      return plan;
    }
    // SHOWCASE: newHire – nepřítomný před nástupem (žádný HO ani NEMOC, intervaly proste nebudou)
    if (c.showcase === 'newHire') {
      // 1 HO den po 2 týdnech (postupně zapracovává)
      plan.push({ day: 3, type: 'HOME_OFFICE' });
      return plan;
    }
    // SHOWCASE: hero – minimum absencí
    if (c.showcase === 'hero') {
      if (Math.random() < 0.30) plan.push({ day: 5 + Math.floor(Math.random() * 20), type: 'HOME_OFFICE' });
      return plan;
    }
    // SHOWCASE: villain – občas nezprávně absent
    if (c.showcase === 'villain') {
      if (Math.random() < 0.5) plan.push({ day: 8, type: 'NEMOC' });
      return plan;
    }

    // 25 % šance na celý týden dovolené v posledních 30 dnech
    if (Math.random() < 0.25) {
      const start = 5 + Math.floor(Math.random() * 20);
      for (let i = 0; i < 5; i++) plan.push({ day: start + i, type: 'DOVOLENA' });
    }
    if (Math.random() < 0.12) {
      const start = 2 + Math.floor(Math.random() * 25);
      for (let i = 0; i < 3; i++) plan.push({ day: start + i, type: 'NEMOC' });
    }
    if (Math.random() < 0.05) {
      plan.push({ day: 1 + Math.floor(Math.random() * 27), type: 'NEMOC' });
    }
    const hoTargetDays = c.persona === 'social_media' || c.persona === 'streamer' ? 3 : c.persona === 'top' ? 1 : 2;
    let hoCount = 0;
    for (let attempt = 0; attempt < 30 && hoCount < hoTargetDays * 4; attempt++) {
      const day = 1 + Math.floor(Math.random() * 28);
      if (plan.some((a) => a.day === day)) continue;
      plan.push({ day, type: 'HOME_OFFICE' });
      hoCount++;
    }
    return plan;
  }

  for (let pi = 0; pi < created.length; pi++) {
    const c = created[pi];
    const absenceMap = new Map<number, 'NEMOC' | 'DOVOLENA' | 'HOME_OFFICE'>();
    for (const a of planAbsences(c)) absenceMap.set(a.day, a.type);

    // Víkendová aktivita: persony která reálně pracují o víkendu (call duty,
    // sales follow-up, IT incidenty, workaholici). Cca 6 % pracovní síly typicky.
    // Saturday = 4× častěji než Sunday (Sunday je opravdu málokdo).
    const weekendWorker = (() => {
      // Definuj kdo má víkendovou aktivitu
      if (c.persona === 'cheater_mouse' || c.persona === 'cheater_keyboard') return true; // boti jedou pořád
      if (c.dept === 'Zákaznický servis' && rng() < 0.20) return true;  // 20 % zákaznického servisu
      if (c.dept === 'IT podpora' && rng() < 0.30) return true;          // 30 % IT supportu (on-call)
      if (c.dept === 'Datacentrum' && rng() < 0.40) return true;
      if (c.dept.startsWith('Obchod') && rng() < 0.10) return true;     // 10 % obchodníků
      if (c.persona === 'top' && rng() < 0.15) return true;              // 15 % top performerů (workaholic)
      if (c.persona === 'manager_busy' && rng() < 0.25) return true;     // 25 % manažerů občas dohání
      return false;
    })();

    // SHOWCASE: newHire – generujeme jen poslední `startedDaysAgo` dní (sparse data)
    const maxDayBack = c.showcase === 'newHire' && c.startedDaysAgo != null
      ? Math.min(30, c.startedDaysAgo)
      : 30;

    for (let dayBack = 0; dayBack < maxDayBack; dayBack++) {
      const dayStart = addDays(today, -dayBack);
      const lp = localParts(dayStart);
      const dow = localDow(dayStart);
      const date = dayStart;

      // Státní svátek (Po-Pá) → bez aktivity, žádný Absence record (svátky řeší isCzHoliday v scoring)
      if (dow >= 1 && dow <= 5 && isCzHoliday(dayStart)) continue;

      const isWeekend = dow === 0 || dow === 6;
      if (isWeekend) {
        if (!weekendWorker) continue;
        // Sunday: jen 25 % šance i pro weekendWorkery (rodina, klid)
        if (dow === 0 && Math.random() > 0.25) continue;
        // Saturday: 60 % šance
        if (dow === 6 && Math.random() > 0.60) continue;
      }

      const plannedAbs = absenceMap.get(dayBack);
      if (plannedAbs === 'NEMOC' || plannedAbs === 'DOVOLENA') {
        if (isWeekend) continue; // víkendovou nemoc/dovču neřešíme
        absences.push({ userId: c.id, date, type: plannedAbs, source: 'OKBASE' });
        continue;
      }
      const isHO = !isWeekend && plannedAbs === 'HOME_OFFICE';
      if (isHO) absences.push({ userId: c.id, date, type: 'HOME_OFFICE', source: 'OKBASE' });

      // Per-day variance
      let dayMul = dayQualityHash(c.id, dayStart.getTime(), c.consistency);

      // SHOWCASE: newHire rampa – multiplikátor podle týdne od nástupu
      if (c.showcase === 'newHire' && c.rampFn && c.startedDaysAgo != null) {
        const daysSinceStart = c.startedDaysAgo - dayBack;
        const weekFromStart = Math.max(0, Math.floor(daysSinceStart / 7));
        dayMul *= c.rampFn(weekFromStart);
      }
      // SHOWCASE: returnFromLeave rampa – pomalu zpět do tempa
      if (c.showcase === 'returnFromLeave') {
        // dayBack < 17 = po návratu (5 dní nemoci 17-21)
        if (dayBack < 17) {
          const daysBack = 17 - dayBack;
          const rampWeek = Math.floor(daysBack / 7);
          const mul = rampWeek === 0 ? 0.85 : rampWeek === 1 ? 0.92 : 0.98;
          dayMul *= mul;
        }
      }
      // Den v týdnu multiplikátor:
      //   víkend = velmi krátká aktivita (40 % škála, jen pár hodin)
      //   pátek = fridayMul, pondělí lehký warmup
      const dowMul = isWeekend ? 0.40 : dow === 5 ? c.fridayMul : dow === 1 ? 0.92 : 1.0;
      // Cheater_subtle: cheatuje jen Po a St
      const cheatToday = c.persona === 'cheater_subtle' && (dow === 1 || dow === 3);
      const effectivePersona: Persona = c.persona === 'cheater_subtle' && !cheatToday ? 'normal' : c.persona;

      // Pracovní okno – o víkendu kratší (2-4 h místo 8 h)
      let startH = c.startHour;
      let endH = startH + 8;
      if (isWeekend) {
        // Víkendová aktivita: typicky 9-12 nebo 14-17 (3 hodiny, ne 8)
        startH = Math.random() < 0.5 ? 9 : 14;
        endH = startH + 3;
      }
      // Lunch slot
      const lunchStartHour = 12;
      const lunchStartMin = c.lunchOffset;
      const lunchEndMin = lunchStartMin + 30;

      for (let hour = startH; hour < endH; hour++) {
        for (let min = 0; min < 60; min += 15) {
          const intervalStart = zonedToUtc(lp.year, lp.month, lp.day, hour, min);
          const isLunch = !isWeekend && hour === lunchStartHour && min >= lunchStartMin && min < lunchEndMin;
          const row = makeRow(c, intervalStart, isHO, hour, min, dayMul * dowMul, effectivePersona, isLunch);
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
    { appName: 'sldworks.exe', category: 'CAD / Konstrukce', type: 'WORK', seats: 200, costPerSeat: 4500 },
    { appName: 'navision.exe', category: 'Podnikový systém', type: 'WORK', seats: 1500, costPerSeat: 1500 },
    { appName: 'crm.exe', category: 'CRM', type: 'WORK', seats: 500, costPerSeat: 1200 },
    { appName: 'econ.exe', category: 'Podnikový systém', type: 'WORK', seats: 80, costPerSeat: 800 },
    { appName: 'excel.exe', category: 'Kancelář', type: 'WORK', seats: 2000, costPerSeat: 350 },
    { appName: 'code.exe', category: 'Vývoj', type: 'WORK', seats: 150, costPerSeat: 250 },
    { appName: 'powerpnt.exe', category: 'Kancelář', type: 'WORK', seats: 200, costPerSeat: 350 },
    { appName: 'projectpro.exe', category: 'Project management', type: 'WORK', seats: 50, costPerSeat: 800 },
    { appName: 'visiopro.exe', category: 'Diagramy', type: 'WORK', seats: 80, costPerSeat: 600 },
  ];
  for (const l of LICENSES) {
    await prisma.appCategory.upsert({
      where: { appName: l.appName },
      create: { appName: l.appName, category: l.category, type: l.type, licensed: true, seats: l.seats, costPerSeat: l.costPerSeat },
      update: { category: l.category, type: l.type, licensed: true, seats: l.seats, costPerSeat: l.costPerSeat },
    });
  }

  // ─── 5b) Obcházení monitoringu – software co simuluje aktivitu / udržuje "online" ──
  // Apps označené `category: 'Obcházení monitoringu'` se detekují v alerts.ts
  // (EVASION_SOFTWARE flag). Tohle je primární zájem IT auditora – uživatelé co
  // se PROAKTIVNĚ snaží obcházet monitoring (na rozdíl od pirátského SW, který
  // řeší licenční audit, ne integritu měření).
  //
  // Type=NON_WORK – obcházení monitoringu rozhodně není práce, ale skóre samotné
  // tím nehoříme; primární výstup je v Upozornění + suspicious flagu.
  const EVASION_APPS = [
    { appName: 'mouse_jiggler.exe',  category: 'Obcházení monitoringu', type: 'NON_WORK' }, // SW mouse jiggler
    { appName: 'move_mouse.exe',     category: 'Obcházení monitoringu', type: 'NON_WORK' }, // Move Mouse (open-source jiggler)
    { appName: 'autohotkey.exe',     category: 'Obcházení monitoringu', type: 'NON_WORK' }, // AHK – pravděpodobně skript co simuluje vstupy
    { appName: 'caffeine.exe',       category: 'Obcházení monitoringu', type: 'NON_WORK' }, // udržuje screen aktivní, blokuje spořič
    { appName: 'noscreensaver.exe',  category: 'Obcházení monitoringu', type: 'NON_WORK' },
    { appName: 'keep_alive.exe',     category: 'Obcházení monitoringu', type: 'NON_WORK' }, // utility "keep PC awake"
    { appName: 'desktop_wiggler.exe',category: 'Obcházení monitoringu', type: 'NON_WORK' },
    { appName: 'autoclicker.exe',    category: 'Obcházení monitoringu', type: 'NON_WORK' }, // auto-clicker
    { appName: 'mousekey.exe',       category: 'Obcházení monitoringu', type: 'NON_WORK' },
    { appName: 'process_hacker.exe', category: 'Obcházení monitoringu', type: 'NON_WORK' }, // pokus o killnutí agenta
  ];
  for (const a of EVASION_APPS) {
    await prisma.appCategory.upsert({
      where: { appName: a.appName },
      create: { appName: a.appName, category: a.category, type: a.type, licensed: false },
      update: { category: a.category, type: a.type, licensed: false },
    });
  }
  // Cleanup: pokud někde z minulé verze zůstaly entries "Pirátský software", smaž je
  await prisma.appCategory.deleteMany({ where: { category: 'Pirátský software' } });

  // ─── 6) Print, USB, HW health, Admins, Audit, Claims, Evasion, After-hours ─
  await seedPrintAndUsb(created);
  await seedDeviceHealth(created);
  await seedAdditionalAdmins();
  await seedAccessAuditSamples(created);
  await seedClassificationClaims(created);
  await seedEvasionActivity(created);
  await seedAfterHoursActivity(created);

  // ─── 7) Settings & aggregation ──────────────────────────────────────────
  await saveSettings({
    printTrackingEnabled: true,
    capturePrintDocName: true,
    usbTrackingEnabled: true,
    captureUsbFilename: true,
    showDemoDevices: true,
  });

  console.log('Spouštím rychlou bulk agregaci (1× findMany + bulk insert per uživatel)…');
  const aggT0 = Date.now();
  const agg = await aggregateAllFast();
  const aggSec = Math.round((Date.now() - aggT0) / 1000);
  console.log(`Seed hotov: ${created.length} uživatelů, ${absences.length} absencí, ${agg.hours} hodinových agregátů, ${agg.days} denních (agregace ${aggSec}s).`);
}

/**
 * Vyrobí 1 interval pro uživatele v konkrétní 15-min slot.
 *
 * Variance vrstvy (aby dashboard nebyl flat):
 *   1) `dayMul` ∈ 0.78-1.22 (per-day "kvalita dne", hash userId+den)
 *   2) `hourCurve(hour, min)` ∈ 0.15-1.10 (warmup, lunch, peak)
 *   3) `persona` – 10 typů s různými app pooly a frekvencemi nonwork
 *   4) `isLunch` – 30 min locked uprostřed dne
 *   5) Friday/Monday dow multiplikátor aplikovaný v `dayMul` callerem
 */
/**
 * Vyrobí 1 interval pro uživatele v konkrétní 15-min slot.
 *
 * DŮLEŽITÉ – škála:
 *   intervalSeconds: 900 (= 15 min reálného času)
 *   activeSeconds:   0-900 (= reálný čas aktivity v tom 15-min okně)
 *   keystrokeCount:  0-3000 (~ 200 kps/min × 15 min při focused typing)
 *   mouseEvents:     0-1000
 *   typingMs:        0-900_000
 *
 * Pozn.: Production agent posílá 60s intervaly, ale agregace sčítá activeSeconds
 * napříč všemi intervaly v hodině/dni, takže škála demo dat = škála produkce
 * (480 min/den max work pro 8h prac. doby).
 *
 * Variance vrstvy:
 *   1) `dayMul` ∈ 0.55-1.45 (per-day kvalita, hash userId+den × consistency)
 *   2) `hourCurve` ∈ 0.15-1.10 (warmup, lunch, peak)
 *   3) `persona` – 14 typů s různými app pooly
 *   4) `c.lockProb` per-user (sales/manageři často mimo PC)
 *   5) `isLunch` – obědová pauza
 *   6) Friday/Monday dow multiplikátor aplikovaný v `dayMul` callerem
 */
const INT_SEC = 900; // 15 min v sekundách
function makeRow(
  c: Person, intervalStart: Date, isHO: boolean,
  hour: number, minute: number, dayMul: number,
  persona: Persona, isLunch: boolean,
): Prisma.ActivityIntervalCreateManyInput | null {
  const last = c.siteBase.split('.')[1];
  const clientIp = isHO ? `192.168.${rnd(255)}.${rnd(255)}` : `${c.siteBase}.${last}.${rnd(254) + 1}`;

  const base: Prisma.ActivityIntervalCreateManyInput = {
    userId: c.id,
    deviceId: c.deviceId,
    intervalStart,
    intervalSeconds: INT_SEC,
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

  // Lunch break – idle, většina jen necháva PC zapnutý
  if (isLunch) {
    return Math.random() < 0.40
      ? { ...base, sessionLocked: true, idleSeconds: INT_SEC }
      : { ...base, idleSeconds: INT_SEC };
  }

  // Cheateři – konstantní strojový vzor po celých 15 min
  // (mouse jiggler: ~52 events/min × 15 = ~780; keyboard bot: ~180/min × 15 = ~2700)
  if (persona === 'cheater_mouse') {
    return { ...base, activeSeconds: INT_SEC, foregroundApp: 'chrome.exe', windowTitle: 'YouTube', mouseEvents: 780 + rnd(80), keystrokeCount: 0 };
  }
  if (persona === 'cheater_keyboard') {
    const ks = 2700 + rnd(120);
    return { ...base, activeSeconds: INT_SEC, foregroundApp: 'winword.exe', windowTitle: null, keystrokeCount: ks, mouseEvents: rnd(15), typingMs: INT_SEC * 1000, typingKeystrokeCount: ks };
  }

  // Mimo PC rozhodnutí – per-user lockProb modulovaný hodinou
  const hMul = hourCurve(hour, minute);
  const lockMul = hMul < 0.5 ? 1.4 : hMul > 1.0 ? 0.6 : 1.0;
  if (Math.random() < c.lockProb * lockMul) {
    return { ...base, sessionLocked: true, idleSeconds: INT_SEC };
  }

  // Gameři: 12:30-13:00 sneak hra (jen Po/St/Pá)
  const dow = new Date(intervalStart).getUTCDay();
  if (persona === 'gamer' && hour === 12 && minute >= 30 && (dow === 1 || dow === 3 || dow === 5)) {
    return { ...base, activeSeconds: 800, idleSeconds: 100, foregroundApp: 'steam.exe', windowTitle: pick(['Counter-Strike 2', 'Dota 2', 'League of Legends']), mouseEvents: 1200 + rnd(600), keystrokeCount: 600 + rnd(600) };
  }

  // ── Když JE u PC: výkon = baseDiligence × dayMul × hodinová křivka × HO dip ──
  const dipFactor = isHO ? 1 - c.hoDip : 1;
  const effectiveDiligence = Math.max(0.15, Math.min(0.98, c.baseDiligence * dayMul * dipFactor));

  // Aktivní čas v rámci 15-min slotu (max 900s):
  //   peakActive = baseline pro tento interval (kolik z 900s je aktivní)
  //   hourScale = škála dle hodiny (warmup 65%, peak 99%)
  const peakActive = Math.round(effectiveDiligence * INT_SEC); // 0-900
  const hourScale = 0.85 + hMul * 0.13; // 0.85-1.00 (mírnější penalty v warmup/wind-down)

  // Per-persona "non-work" pravděpodobnost
  let nonWorkProb: number;
  switch (persona) {
    case 'top':           nonWorkProb = 0.03; break;
    case 'slacker':       nonWorkProb = 0.45 - effectiveDiligence * 0.20; break;
    case 'social_media':  nonWorkProb = 0.22 - effectiveDiligence * 0.08; break;
    case 'streamer':      nonWorkProb = 0.30 - effectiveDiligence * 0.10; break;
    case 'chatty':        nonWorkProb = 0.08; break;
    case 'gamer':         nonWorkProb = 0.18 - effectiveDiligence * 0.05; break;
    default:              nonWorkProb = (1 - effectiveDiligence) * 0.30;
  }

  const r = Math.random();
  let app: string;
  let title: string | null = null;
  let active: number;

  if (persona === 'streamer' && hour >= 14 && Math.random() < 0.35) {
    app = 'chrome.exe'; title = pick(['YouTube – Long video essay', 'Netflix – Watching', 'Twitch – streamer live']);
    active = 150 + rnd(300); // 2.5-7.5 min ze 15 (běží to v pozadí)
  } else if (persona === 'social_media' && Math.random() < 0.18) {
    app = 'chrome.exe'; title = pick(['Facebook', 'Instagram', 'LinkedIn – feed']);
    active = Math.round((400 + rnd(300)) * hourScale);
  } else if (persona === 'chatty' && Math.random() < 0.45) {
    app = Math.random() < 0.7 ? 'teams.exe' : 'slack.exe';
    title = pick(['Obecné – chat', 'Tým call', 'Direct message']);
    active = Math.round((600 + rnd(250)) * hourScale);
  } else if (r < nonWorkProb) {
    if (Math.random() < 0.6) { app = 'chrome.exe'; title = pick(BROWSER_NONWORK_TITLES); }
    else { app = pick(NONWORK_APPS); }
    active = Math.round((450 + rnd(300)) * hourScale);
  } else if (r < nonWorkProb + 0.10) {
    app = 'chrome.exe'; title = pick(BROWSER_WORK_TITLES);
    active = Math.round((peakActive - rnd(120)) * hourScale);
  } else if (Math.random() < 0.03) {
    app = pick(UNKNOWN_APPS);
    active = Math.round((550 + rnd(250)) * hourScale);
  } else {
    const w = pick(c.workPool);
    app = w[0]; title = w[1];
    // Většina intervalů aktivních blízko peakActive (95 %), občas "thinking" interval (5 %)
    active = Math.random() > 0.95 ? rnd(200) : Math.round(peakActive * hourScale * (0.92 + Math.random() * 0.08));
  }

  active = Math.max(0, Math.min(INT_SEC, active));

  // Klávesy: pri active > 7 min a TYPING app, 600-3000 kláves (~typing rate 200/min)
  // dayMul modeluje že nějaký den někdo píše víc.
  const ks = active > 420 && TYPING_APPS.has(app)
    ? Math.round((600 + rnd(2400)) * dayMul)
    : Math.round(rnd(400));
  // Myš: pro CAD intenzivní (sldworks), jinak proporčně k aktivitě
  const mouse = app === 'sldworks.exe'
    ? 800 + rnd(1500)
    : active > 200 ? 150 + rnd(800) : rnd(120);
  // Typing session ms (0-900_000 = max 15 min)
  const typingMs = ks > 400 ? Math.min(INT_SEC * 1000, ks * 200) : 0;

  return {
    ...base,
    activeSeconds: active,
    idleSeconds: INT_SEC - active,
    foregroundApp: app,
    windowTitle: title,
    keystrokeCount: ks,
    mouseEvents: mouse,
    sessionLocked: active < 60 && Math.random() > 0.7,
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
    const isCheater = u.persona.startsWith('cheater');
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

/**
 * Seed software obcházení monitoringu: ~20 uživatelů má spuštěné nástroje
 * pro fingovanou aktivitu / udržení online statusu. Toto je primární zájem
 * IT auditora – uživatelé co PROAKTIVNĚ obcházejí měření (rozdíl proti
 * pirátskému SW, který řeší licenční audit).
 *
 * Persony narativně:
 *  - Mouse jiggler během oběda nebo schůzek (status zůstane "aktivní")
 *  - AutoHotkey skript co simuluje úhozy během dlouhých Teams callů
 *  - Caffeine.exe aby PC nezamknul (kdo nechce zadávat heslo)
 *  - Process Hacker (advanced) – pokus o killnutí agenta
 */
async function seedEvasionActivity(users: Person[]): Promise<void> {
  const existing = await prisma.activityInterval.count({
    where: { foregroundApp: { in: ['mouse_jiggler.exe', 'autohotkey.exe', 'caffeine.exe', 'move_mouse.exe'] } },
  });
  if (existing > 0) {
    console.log(`Demo evasion preskoceno – uz existuje ${existing} intervalu.`);
    return;
  }

  const findCandidate = (predicate: (u: Person) => boolean): Person | undefined =>
    users.find((u) => predicate(u) && !u.persona.startsWith('cheater'));

  // Plán: 20 uživatelů přes různé persony s různými evasion nástroji.
  // Intensity = hodin/týden kdy daný nástroj běží na popředí (mouse_jiggler
  // bývá většinou na pozadí, ale občas user otevře okno aby konfiguroval).
  const evasionPlan: { user: Person | undefined; app: string; intensityHoursPerWeek: number; reason: string }[] = [
    // 5× lidi co maskuji nepřítomnost u PC (sales, obchod, manažeři)
    { user: findCandidate((u) => u.dept === 'Obchod ČR'),         app: 'mouse_jiggler.exe',   intensityHoursPerWeek: 6, reason: 'Maskuje schůzky/cesty' },
    { user: users.filter((u) => u.dept === 'Obchod ČR')[25],      app: 'mouse_jiggler.exe',   intensityHoursPerWeek: 4, reason: 'Maskuje nečinnost' },
    { user: users.filter((u) => u.dept === 'Obchod Export')[8],   app: 'move_mouse.exe',      intensityHoursPerWeek: 5, reason: 'Long sales hovor – udržuje status' },
    { user: findCandidate((u) => u.dept === 'Zákaznický servis'), app: 'mouse_jiggler.exe',   intensityHoursPerWeek: 8, reason: 'Sleduje seriály v práci' },
    { user: users.filter((u) => u.dept === 'Marketing')[2],       app: 'desktop_wiggler.exe', intensityHoursPerWeek: 3, reason: 'Fake activity přes oběd' },
    // 4× AutoHotkey – simulace úhozů (často IT/Vývoj kteří znají skripty)
    { user: findCandidate((u) => u.dept === 'IT podpora'),        app: 'autohotkey.exe',      intensityHoursPerWeek: 10, reason: 'AHK skript simuluje typing' },
    { user: users.filter((u) => u.dept === 'IT')[5],              app: 'autohotkey.exe',      intensityHoursPerWeek: 6, reason: 'AHK skript' },
    { user: users.filter((u) => u.dept === 'Vývoj')[20],          app: 'autohotkey.exe',      intensityHoursPerWeek: 4, reason: 'AHK skript' },
    { user: findCandidate((u) => u.dept === 'Ekonomika'),         app: 'autohotkey.exe',      intensityHoursPerWeek: 5, reason: 'AHK skript' },
    // 5× Caffeine / NoScreenSaver – udržuje PC neuzamčené
    { user: findCandidate((u) => u.dept === 'Konstrukce'),        app: 'caffeine.exe',        intensityHoursPerWeek: 8, reason: 'PC nesmí usnout pres render' },
    { user: users.filter((u) => u.dept === 'Konstrukce')[60],     app: 'caffeine.exe',        intensityHoursPerWeek: 6, reason: 'CAD render keep alive' },
    { user: users.filter((u) => u.dept === 'Personalistika')[3],  app: 'noscreensaver.exe',   intensityHoursPerWeek: 5, reason: 'Maskuje delsi prestavku' },
    { user: findCandidate((u) => u.dept === 'Reklamace'),         app: 'keep_alive.exe',      intensityHoursPerWeek: 4, reason: 'Status v Teams' },
    { user: users.filter((u) => u.dept === 'Logistika')[5],       app: 'caffeine.exe',        intensityHoursPerWeek: 3, reason: 'Maskuje absence' },
    // 3× AutoClicker – fingovani repetitivni prace
    { user: findCandidate((u) => u.dept === 'Sklad'),             app: 'autoclicker.exe',     intensityHoursPerWeek: 4, reason: 'Auto-klikani na potvrzeni' },
    { user: findCandidate((u) => u.dept === 'Datacentrum'),       app: 'mousekey.exe',        intensityHoursPerWeek: 2, reason: 'Skriptovany klik' },
    { user: users.filter((u) => u.dept === 'Zákaznický servis')[10], app: 'autoclicker.exe',  intensityHoursPerWeek: 6, reason: 'Fake CRM klikani' },
    // 3× pokus o killnutí agenta (advanced – pravdepodobne IT lide)
    { user: users.filter((u) => u.dept === 'IT')[12],             app: 'process_hacker.exe',  intensityHoursPerWeek: 1, reason: 'Pokus o killnuti monitoring agenta' },
    { user: users.filter((u) => u.dept === 'Datacentrum')[3],     app: 'process_hacker.exe',  intensityHoursPerWeek: 1, reason: 'Pokus o killnuti agenta' },
    { user: findCandidate((u) => u.dept === 'Vývoj'),             app: 'process_hacker.exe',  intensityHoursPerWeek: 1, reason: 'Pokus o killnuti agenta' },
  ].filter((p) => p.user) as { user: Person; app: string; intensityHoursPerWeek: number; reason: string }[];

  const today = floorToDay(new Date());
  const newRows: Prisma.ActivityIntervalCreateManyInput[] = [];
  const usedSlots = new Set<string>();
  let injected = 0;
  for (const p of evasionPlan) {
    const user = p.user;
    if (!user) continue;
    const totalIntervals = Math.round(p.intensityHoursPerWeek * 4.3 * 4);
    const last = user.siteBase.split('.')[1];
    const clientIp = `${user.siteBase}.${last}.${rnd(254) + 1}`;
    let attempts = 0;
    let placed = 0;
    while (placed < totalIntervals && attempts < totalIntervals * 4) {
      attempts++;
      const dayBack = rnd(30);
      const dayStart = addDays(today, -dayBack);
      const dow = localDow(dayStart);
      if (dow === 0 || dow === 6) continue;
      const lp = localParts(dayStart);
      // Evasion aktivita – po pracovní době (17-19h), aby se nemíchala s běžnými intervaly.
      // (Reálně by mouse jiggler běžel CELOU pracovní dobu, ale to bychom museli
      // přepsat existující intervaly. Tady stačí ukázat že tool je nainstalovaný.)
      const hour = pick([17, 18, 19]);
      const min = pick([0, 15, 30, 45]);
      const intervalStart = zonedToUtc(lp.year, lp.month, lp.day, hour, min);
      const slotKey = `${user.id}|${intervalStart.getTime()}`;
      if (usedSlots.has(slotKey)) continue;
      usedSlots.add(slotKey);
      placed++;
      newRows.push({
        userId: user.id, deviceId: user.deviceId,
        intervalStart, intervalSeconds: 900,
        activeSeconds: 600 + rnd(250), idleSeconds: 0,
        foregroundApp: p.app, windowTitle: null,
        sessionLocked: false, monitorCount: user.monitors, clientIp,
        keystrokeCount: 200 + rnd(800),
        mouseEvents: 100 + rnd(400),
        typingMs: 300_000 + rnd(300_000),
        typingKeystrokeCount: 200 + rnd(800),
      });
      injected++;
    }
  }
  for (let i = 0; i < newRows.length; i += 500) {
    await prisma.activityInterval.createMany({ data: newRows.slice(i, i + 500) });
  }
  console.log(`Demo evasion: ${evasionPlan.length} uživatelů s ${injected} obcházecími intervaly.`);
}

/**
 * Seed pozdně-noční aktivita: ~3 % uživatelů má podezřelou aktivitu mezi 22:00-05:00.
 * Reálně může být:
 *  - Workaholic dohánějící deadline (legitimní)
 *  - Útočník stahující data (incident response)
 *  - Cheater spustil bot a šel domů (jiggler běží i v noci)
 *
 * V dashboard heatmapě se to projeví jako anomálie. Alerts to nyní (zatím)
 * nedetekuje – nechávám pro budoucí "unusual hours" detector.
 */
async function seedAfterHoursActivity(users: Person[]): Promise<void> {
  // Sample marker: hledáme intervaly po 21:00 UTC (= ~23:00 CEST). Pokud
  // existují, after-hours seed už proběhl. Žádný "normální" interval z hlavní
  // smyčky nemůže být po 21 UTC (work window končí v 16 lokálně = max 14 UTC).
  const sample = await prisma.$queryRawUnsafe<Array<{ c: number }>>(
    "SELECT COUNT(*) as c FROM ActivityInterval WHERE CAST(strftime('%H', intervalStart) AS INTEGER) >= 19",
  );
  const sampleCount = Number(sample?.[0]?.c ?? 0);
  if (sampleCount > 100) { console.log(`Demo after-hours preskocen – uz existuje ${sampleCount} intervalu.`); return; }

  // Vyber ~60 uživatelů (3 %) s pozdně-noční aktivitou.
  // Cheateři automaticky (boti běží non-stop), zbytek random workaholici / "stahovači"
  const nightWorkers: Person[] = [];
  for (const u of users) {
    if (u.persona.startsWith('cheater')) nightWorkers.push(u);
    else if (u.persona === 'top' && Math.random() < 0.10) nightWorkers.push(u);
    else if (u.persona === 'manager_busy' && Math.random() < 0.15) nightWorkers.push(u);
    else if (u.dept === 'Datacentrum' && Math.random() < 0.30) nightWorkers.push(u);
    else if (u.dept === 'IT podpora' && Math.random() < 0.20) nightWorkers.push(u);
    else if (Math.random() < 0.005) nightWorkers.push(u); // 0.5 % random
  }

  const today = floorToDay(new Date());
  const rows: Prisma.ActivityIntervalCreateManyInput[] = [];
  for (const u of nightWorkers) {
    const last = u.siteBase.split('.')[1];
    const clientIp = `${u.siteBase}.${last}.${rnd(254) + 1}`;
    const isCheater = u.persona.startsWith('cheater');
    // Cheateři: každý den 6 nočních intervalů (22:00-23:30)
    // Ostatní: jen 2-5 dnů za měsíc, kratší
    const nightDays = isCheater ? 25 : 2 + rnd(4);
    for (let dayBack = 1; dayBack <= nightDays; dayBack++) {
      const dayStart = addDays(today, -dayBack);
      const lp = localParts(dayStart);
      // Cheater: 22:00-23:45 = 8 intervalů; Workaholic: 21:00-23:00 = 8 int.
      const startHour = isCheater ? 22 : 21;
      const intervalCount = isCheater ? 6 : 4 + rnd(4);
      for (let i = 0; i < intervalCount; i++) {
        const hour = startHour + Math.floor(i / 4);
        const min = (i % 4) * 15;
        if (hour > 23) break;
        const intervalStart = zonedToUtc(lp.year, lp.month, lp.day, hour, min);
        const app = isCheater
          ? (u.persona === 'cheater_mouse' ? 'chrome.exe' : 'winword.exe')
          : pick(['outlook.exe', 'excel.exe', 'teams.exe', 'code.exe']);
        rows.push({
          userId: u.id, deviceId: u.deviceId,
          intervalStart, intervalSeconds: 900,
          activeSeconds: isCheater ? 900 : 500 + rnd(300),
          idleSeconds: isCheater ? 0 : 100 + rnd(300),
          foregroundApp: app, windowTitle: isCheater ? 'YouTube' : null,
          sessionLocked: false, monitorCount: u.monitors, clientIp,
          keystrokeCount: isCheater && app === 'winword.exe' ? 2700 + rnd(120) : 400 + rnd(800),
          mouseEvents: isCheater && app === 'chrome.exe' ? 780 + rnd(80) : 100 + rnd(300),
          typingMs: isCheater ? 900_000 : 200_000 + rnd(400_000),
          typingKeystrokeCount: isCheater && app === 'winword.exe' ? 2700 + rnd(120) : 400 + rnd(800),
        });
      }
    }
  }
  for (let i = 0; i < rows.length; i += 500) {
    // Bezpečné: after-hours intervaly jsou 21-23h (mimo všechny work windows)
    await prisma.activityInterval.createMany({ data: rows.slice(i, i + 500) });
  }
  console.log(`Demo after-hours: ${nightWorkers.length} uživatelů s ${rows.length} nočními intervaly.`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
