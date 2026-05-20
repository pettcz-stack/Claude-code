/** Začátek dne v UTC (data jsou ukládána v UTC). */
export function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

export function isoDate(d: Date): string {
  return startOfUtcDay(d).toISOString().slice(0, 10);
}

export function minutesToHm(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

export function utcHourOf(iso: string): number {
  return new Date(iso).getUTCHours();
}
