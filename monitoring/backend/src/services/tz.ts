// Časové pásmo aplikace. Dny a hodiny se počítají v lokálním čase ČR
// (Europe/Prague, tj. SEČ/SELČ vč. letního času), ne v UTC – aby „den" běžel
// od místní půlnoci do půlnoci a heatmapa „kdy se pracuje" ukazovala místní hodiny.
//
// Implementováno přes vestavěné Intl.DateTimeFormat (žádná externí závislost),
// které DST řeší korektně. Hodnoty se v DB stále ukládají jako UTC instanty –
// jen zarovnané na hranice místního dne/hodiny.

export const APP_TIME_ZONE = 'Europe/Prague';

const dtf = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  second: number;
}

/** Rozloží UTC instant na složky místního času (Europe/Prague). */
export function localParts(d: Date): LocalParts {
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(d)) {
    if (part.type !== 'literal') p[part.type] = part.value;
  }
  return {
    year: +p.year,
    month: +p.month,
    day: +p.day,
    hour: +p.hour,
    minute: +p.minute,
    second: +p.second,
  };
}

/** Posun místního času oproti UTC (ms) v daný okamžik: localWallClock − UTC. */
function offsetMs(d: Date): number {
  const p = localParts(d);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(d.getTime() / 1000) * 1000;
}

/** Z místních složek (Europe/Prague) vyrobí odpovídající UTC instant. DST-safe. */
export function zonedToUtc(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  // Dvojí korekce kvůli přechodu letního/zimního času.
  let utc = guess - offsetMs(new Date(guess));
  utc = guess - offsetMs(new Date(utc));
  return new Date(utc);
}

/** Zarovná na začátek místního dne (00:00 Europe/Prague) jako UTC instant. */
export function floorToDay(d: Date): Date {
  const p = localParts(d);
  return zonedToUtc(p.year, p.month, p.day);
}

/** Zarovná na začátek místní hodiny (Europe/Prague) jako UTC instant. */
export function floorToHour(d: Date): Date {
  const p = localParts(d);
  return zonedToUtc(p.year, p.month, p.day, p.hour);
}

/** Klíč dne ve formátu YYYY-MM-DD podle místního času. */
export function dayKey(d: Date): string {
  const p = localParts(d);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Místní hodina dne (0-23). */
export function localHour(d: Date): number {
  return localParts(d).hour;
}

/** Místní den v týdnu (0 = neděle … 6 = sobota). */
export function localDow(d: Date): number {
  const p = localParts(d);
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
}

/** Přičte n místních dní k instantu a vrátí začátek toho místního dne. DST-safe. */
export function addDays(d: Date, n: number): Date {
  const p = localParts(d);
  return zonedToUtc(p.year, p.month, p.day + n);
}
