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

/** Barvy pro typy aktivity. */
export const TYPE_COLORS = {
  work: '#10b981',
  nonwork: '#ef4444',
  idle: '#cbd5e1',
  off: '#94a3b8',
};

export function chipClass(type: string): string {
  return type === 'NON_WORK' ? 'chip-nonwork' : type === 'WORK' ? 'chip-work' : 'chip-neutral';
}

export function typeLabel(type: string): string {
  return type === 'NON_WORK' ? 'mimo' : type === 'WORK' ? 'práce' : 'neutrál';
}

/** Krátký název dne z ISO data (pro grafy). */
export function shortDay(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}
