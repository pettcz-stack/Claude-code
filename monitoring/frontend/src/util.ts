// Časy se ukládají v UTC. Dashboard je zobrazuje v MÍSTNÍM čase prohlížeče
// (pro uživatele v ČR = Europe/Prague, včetně letního času).

/** Začátek dne v místním čase prohlížeče. */
export function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** YYYY-MM-DD z místních složek data. */
export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function minutesToHm(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

/** Hodina dne (0–23) v místním čase z ISO časové značky. */
export function localHourOf(iso: string): number {
  return new Date(iso).getHours();
}

/** Barvy pro typy aktivity (kategorie času). */
export const TYPE_COLORS = {
  work: '#10b981',
  nonwork: '#ef4444',
  idle: '#cbd5e1',
  off: '#94a3b8',
};

/**
 * Jednotná PLYNULÁ škála hodnocení v celé aplikaci:
 * 0 % červená → oranžová → žlutá → limetková → zelená 100 %.
 * Číslo i pruh tak mají odstín přesně podle své hodnoty (ne jen 3 barvy).
 * Použité odstíny jsou Tailwind *-600/700 → čitelné jako text i jako výplň.
 */
const SCORE_STOPS: { at: number; rgb: [number, number, number] }[] = [
  { at: 0, rgb: [220, 38, 38] },   // #dc2626 červená
  { at: 20, rgb: [234, 88, 12] },  // #ea580c oranžová
  { at: 40, rgb: [217, 119, 6] },  // #d97706 jantarová
  { at: 55, rgb: [202, 138, 4] },  // #ca8a04 žlutá
  { at: 70, rgb: [101, 163, 13] }, // #65a30d limetková
  { at: 85, rgb: [22, 163, 74] },  // #16a34a zelená
  { at: 100, rgb: [21, 128, 61] }, // #15803d sytě zelená
];
const hex2 = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
const rgbHex = (rgb: [number, number, number]) => `#${hex2(rgb[0])}${hex2(rgb[1])}${hex2(rgb[2])}`;

/** HEX barva odstínu pro skóre 0–100 (plynulá interpolace). Pro text i výplně. */
export function scoreColor(score: number): string {
  const s = Math.max(0, Math.min(100, score));
  let lo = SCORE_STOPS[0];
  let hi = SCORE_STOPS[SCORE_STOPS.length - 1];
  for (let i = 0; i < SCORE_STOPS.length - 1; i++) {
    if (s >= SCORE_STOPS[i].at && s <= SCORE_STOPS[i + 1].at) { lo = SCORE_STOPS[i]; hi = SCORE_STOPS[i + 1]; break; }
  }
  const span = hi.at - lo.at || 1;
  const t = (s - lo.at) / span;
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  return rgbHex([mix(lo.rgb[0], hi.rgb[0]), mix(lo.rgb[1], hi.rgb[1]), mix(lo.rgb[2], hi.rgb[2])]);
}

/** CSS gradient odpovídající škále (pro proužek v legendě). */
export const SCORE_GRADIENT_CSS = `linear-gradient(90deg, ${SCORE_STOPS.map((s) => `${rgbHex(s.rgb)} ${s.at}%`).join(', ')})`;

/** Zpětně kompatibilní alias – výplň pruhu dle skóre. */
export const scoreHex = scoreColor;

/** Slovní hodnocení výsledku (pro popisky). */
export function scoreWord(score: number): string {
  return score >= 70 ? 'výborné' : score >= 45 ? 'průměrné' : 'slabé';
}

export function chipClass(type: string): string {
  return type === 'NON_WORK' ? 'chip-nonwork' : type === 'WORK' ? 'chip-work' : 'chip-neutral';
}

export function typeLabel(type: string): string {
  if (type === 'NON_WORK') return 'mimo';
  if (type === 'WORK') return 'práce';
  if (type === 'UNKNOWN') return 'nezařazeno';
  return 'neutrál';
}

/** Krátký název dne z ISO data (pro grafy). */
export function shortDay(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

/** Zkratka dne v týdnu (Po–Ne) z YYYY-MM-DD (UTC). */
export function dowShort(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00Z');
  return ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'][d.getUTCDay()];
}
export function isWeekend(isoDate: string): boolean {
  const dow = new Date(isoDate + 'T00:00:00Z').getUTCDay();
  return dow === 0 || dow === 6;
}

/** Velikonoční neděle (záp. církev) pro daný rok – Meeus/Jones/Butcher. */
function easterSunday(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, month - 1, day));
}

/** Český státní svátek pro YYYY-MM-DD → název, jinak null. */
export function czHoliday(isoDate: string): string | null {
  const d = new Date(isoDate + 'T00:00:00Z');
  const y = d.getUTCFullYear();
  const md = `${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
  const fixed: Record<string, string> = {
    '1-1': 'Nový rok', '5-1': 'Svátek práce', '5-8': 'Den vítězství',
    '7-5': 'Cyril a Metoděj', '7-6': 'Jan Hus', '9-28': 'Sv. Václav',
    '10-28': 'Vznik ČSR', '11-17': 'Den boje za svobodu',
    '12-24': 'Štědrý den', '12-25': '1. svátek vánoční', '12-26': '2. svátek vánoční',
  };
  if (fixed[md]) return fixed[md];
  const easter = easterSunday(y);
  const goodFri = new Date(easter.getTime() - 2 * 86400000);
  const easterMon = new Date(easter.getTime() + 86400000);
  const sameDay = (a: Date) => a.getUTCMonth() === d.getUTCMonth() && a.getUTCDate() === d.getUTCDate();
  if (sameDay(goodFri)) return 'Velký pátek';
  if (sameDay(easterMon)) return 'Velikonoční pondělí';
  return null;
}
