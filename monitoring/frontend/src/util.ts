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
