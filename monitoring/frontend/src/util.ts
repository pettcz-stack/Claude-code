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
 * Jednotná škála hodnocení výsledků v celé aplikaci:
 * zelená = nejlepší, žlutá = střední, červená = nejhorší.
 * Pásma jsou stejná všude (KPI, žebříček, oddělení, detail…).
 */
export const SCORE_GOOD = '#10b981'; // zelená
export const SCORE_MID = '#f59e0b';  // žlutá / oranžová
export const SCORE_BAD = '#ef4444';  // červená
export const SCORE_GOOD_MIN = 75;
export const SCORE_MID_MIN = 50;

/** HEX barva pro výsledek dle pásma (na výplně pruhů, teček apod.). */
export function scoreHex(score: number): string {
  return score >= SCORE_GOOD_MIN ? SCORE_GOOD : score >= SCORE_MID_MIN ? SCORE_MID : SCORE_BAD;
}

/** Tailwind třída barvy textu pro výsledek dle pásma. */
export function scoreTextClass(score: number): string {
  return score >= SCORE_GOOD_MIN ? 'text-emerald-500' : score >= SCORE_MID_MIN ? 'text-amber-500' : 'text-red-500';
}

/** Slovní hodnocení výsledku (pro popisky). */
export function scoreWord(score: number): string {
  return score >= SCORE_GOOD_MIN ? 'výborné' : score >= SCORE_MID_MIN ? 'průměrné' : 'slabé';
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
