import { median } from "./stats.js";

export interface PricePoint {
  city: string | null;
  propertyType: string;
  price: number;
}

export interface CalibrationRow {
  city: string;
  propertyType: string;
  offeredMedian: number;
  realizedMedian: number;
  /** realizovaná / nabídková: <1 = prodává se pod inzercí. */
  coefficient: number;
  /** procentní rozdíl vůči nabídce, např. -8.5 (%). */
  diffPct: number;
  offeredCount: number;
  realizedCount: number;
}

/**
 * Hrubá kalibrace „nabídková → realizovaná cena" na úrovni město × typ.
 * Porovnává medián nabídkových cen (z inzerce) s mediánem realizovaných cen
 * (z katastru) ve stejné skupině a vrací koeficient.
 *
 * POZOR — omezení: porovnává ABSOLUTNÍ ceny, ne cenu za m² (realizované ceny
 * z katastru běžně nenesou plochu). Skupiny s různou skladbou nemovitostí
 * proto koeficient zkreslují. Pro přesnější kalibraci je třeba realizované
 * záznamy obohatit o plochu z popisných údajů KN a párovat po m².
 */
export function computeCalibration(
  offered: PricePoint[],
  realized: PricePoint[],
  minCount = 5,
): CalibrationRow[] {
  const key = (p: PricePoint) => `${(p.city ?? "?").trim()}|${p.propertyType}`;

  const offGroups = new Map<string, number[]>();
  for (const p of offered) {
    if (!p.city || !(p.price > 0)) continue;
    const arr = offGroups.get(key(p)) ?? [];
    arr.push(p.price);
    offGroups.set(key(p), arr);
  }

  const realGroups = new Map<string, number[]>();
  for (const p of realized) {
    if (!p.city || !(p.price > 0)) continue;
    const arr = realGroups.get(key(p)) ?? [];
    arr.push(p.price);
    realGroups.set(key(p), arr);
  }

  const rows: CalibrationRow[] = [];
  for (const [k, offVals] of offGroups) {
    const realVals = realGroups.get(k);
    if (!realVals) continue;
    if (offVals.length < minCount || realVals.length < minCount) continue;

    const offeredMedian = median(offVals)!;
    const realizedMedian = median(realVals)!;
    if (!(offeredMedian > 0)) continue;

    const coefficient = realizedMedian / offeredMedian;
    const [city, propertyType] = k.split("|") as [string, string];
    rows.push({
      city,
      propertyType,
      offeredMedian: Math.round(offeredMedian),
      realizedMedian: Math.round(realizedMedian),
      coefficient: Number(coefficient.toFixed(4)),
      diffPct: Number(((coefficient - 1) * 100).toFixed(1)),
      offeredCount: offVals.length,
      realizedCount: realVals.length,
    });
  }
  return rows.sort((a, b) => a.diffPct - b.diffPct);
}
