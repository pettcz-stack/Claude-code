/** Čisté statistické funkce — bez DB, snadno testovatelné. */

export function median(values: number[]): number | null {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 === 0 ? (xs[mid - 1]! + xs[mid]!) / 2 : xs[mid]!;
}

export function mean(values: number[]): number | null {
  const xs = values.filter((v) => Number.isFinite(v));
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Počet dní mezi dvěma daty (zaokrouhleno dolů, min. 0). */
export function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/**
 * Agregace cen za m² do skupin (klíč → hodnoty). Vrací počet, průměr a medián.
 * Skupiny s méně než `minCount` vzorky se vynechají (statisticky bezcenné).
 */
export interface PriceAggRow {
  key: string;
  count: number;
  meanPricePerM2: number | null;
  medianPricePerM2: number | null;
}

export function aggregatePricePerM2(
  rows: Array<{ key: string; pricePerM2: number | null }>,
  minCount = 1,
): PriceAggRow[] {
  const groups = new Map<string, number[]>();
  for (const r of rows) {
    if (r.pricePerM2 == null) continue;
    const arr = groups.get(r.key) ?? [];
    arr.push(r.pricePerM2);
    groups.set(r.key, arr);
  }
  const out: PriceAggRow[] = [];
  for (const [key, values] of groups) {
    if (values.length < minCount) continue;
    out.push({
      key,
      count: values.length,
      meanPricePerM2: mean(values),
      medianPricePerM2: median(values),
    });
  }
  return out.sort((a, b) => b.count - a.count);
}
