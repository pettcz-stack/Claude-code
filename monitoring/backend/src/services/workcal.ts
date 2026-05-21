import { prisma } from '../db.js';
import { localParts, localDow, dayKey, addDays, floorToDay } from './tz.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Velikonoční neděle (záp. církev) – Meeus/Jones/Butcher. Vrací kalendářní datum. */
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

/** Kalendářní „měsíc-den" z UTC-půlnočního data. */
const mdUtc = (x: Date) => `${x.getUTCMonth() + 1}-${x.getUTCDate()}`;

/** Je daný den (místní čas) český státní svátek? */
export function isCzHoliday(d: Date): boolean {
  const p = localParts(d);
  const md = `${p.month}-${p.day}`;
  const fixed = new Set(['1-1', '5-1', '5-8', '7-5', '7-6', '9-28', '10-28', '11-17', '12-24', '12-25', '12-26']);
  if (fixed.has(md)) return true;
  const e = easterSunday(p.year);
  const goodFriday = new Date(e.getTime() - 2 * DAY_MS); // Velký pátek
  const easterMonday = new Date(e.getTime() + DAY_MS); // Velikonoční pondělí
  return md === mdUtc(goodFriday) || md === mdUtc(easterMonday);
}

/** Množina dní (YYYY-MM-DD), které jsou v období Po–Pá a zároveň státní svátek. */
export function holidayWeekdaySet(from: Date, to: Date): Set<string> {
  const s = new Set<string>();
  for (let d = floorToDay(from); d.getTime() < to.getTime(); d = addDays(d, 1)) {
    const dow = localDow(d);
    if (dow >= 1 && dow <= 5 && isCzHoliday(d)) s.add(dayKey(d));
  }
  return s;
}

export type AbsenceInfo = { days: Set<string>; vacation: number; sick: number };

/** Dny dovolené/nemoci na uživatele (jen Po–Pá, mimo svátky) z HR (Absence). */
export async function absenceByUser(userIds: string[], from: Date, to: Date, holidays: Set<string>): Promise<Map<string, AbsenceInfo>> {
  const rows = await prisma.absence.findMany({
    where: { userId: { in: userIds }, type: { in: ['DOVOLENA', 'NEMOC'] }, date: { gte: from, lt: to } },
    select: { userId: true, date: true, type: true },
  });
  const map = new Map<string, AbsenceInfo>();
  for (const r of rows) {
    const dow = localDow(r.date);
    const key = dayKey(r.date);
    if (dow < 1 || dow > 5 || holidays.has(key)) continue; // víkend/svátek se neřeší
    let info = map.get(r.userId);
    if (!info) { info = { days: new Set(), vacation: 0, sick: 0 }; map.set(r.userId, info); }
    if (info.days.has(key)) continue;
    info.days.add(key);
    if (r.type === 'DOVOLENA') info.vacation++; else info.sick++;
  }
  return map;
}

/**
 * Efektivní počet pracovních dní = Po–Pá v období MINUS státní svátky MINUS
 * dny, kdy byl zaměstnanec na dovolené/nemoci. Z těchto dní se počítá fond,
 * takže volno (dovolená/nemoc/svátek) NEsnižuje skóre.
 */
export function effectiveWorkdays(from: Date, to: Date, holidays: Set<string>, absenceDays?: Set<string>): number {
  let n = 0;
  for (let d = floorToDay(from); d.getTime() < to.getTime(); d = addDays(d, 1)) {
    const dow = localDow(d);
    if (dow < 1 || dow > 5) continue;
    const key = dayKey(d);
    if (holidays.has(key)) continue;
    if (absenceDays?.has(key)) continue;
    n++;
  }
  return Math.max(n, 1);
}
