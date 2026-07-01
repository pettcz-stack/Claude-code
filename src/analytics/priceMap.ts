import { prisma } from "../db.js";
import { median, mean, daysBetween } from "../core/stats.js";

export interface PriceMapPoint {
  city: string;
  lat: number;
  lon: number;
  count: number;
  medianPricePerM2: number | null;
  meanPricePerM2: number | null;
}

export interface PriceMapFilters {
  dealType?: string; // default "prodej"
  propertyType?: string; // default "byt"
}

/**
 * Cenová mapa: aktivní inzeráty s cenou/m² a GPS, seskupené podle města.
 * Pro každé město: centroid (průměr GPS), počet, medián a průměr ceny/m².
 */
export async function getPriceMap(
  filters: PriceMapFilters = {},
): Promise<PriceMapPoint[]> {
  const dealType = filters.dealType ?? "prodej";
  const propertyType = filters.propertyType ?? "byt";

  const rows = await prisma.listing.findMany({
    where: {
      status: "active",
      dealType,
      propertyType,
      pricePerM2: { not: null },
      lat: { not: null },
      lon: { not: null },
      city: { not: null },
    },
    select: { city: true, lat: true, lon: true, pricePerM2: true },
  });

  const groups = new Map<
    string,
    { lats: number[]; lons: number[]; ppm2: number[] }
  >();
  for (const r of rows) {
    const g = groups.get(r.city!) ?? { lats: [], lons: [], ppm2: [] };
    g.lats.push(r.lat!);
    g.lons.push(r.lon!);
    g.ppm2.push(r.pricePerM2!);
    groups.set(r.city!, g);
  }

  const points: PriceMapPoint[] = [];
  for (const [city, g] of groups) {
    points.push({
      city,
      lat: mean(g.lats)!,
      lon: mean(g.lons)!,
      count: g.ppm2.length,
      medianPricePerM2: median(g.ppm2),
      meanPricePerM2: mean(g.ppm2) ? Math.round(mean(g.ppm2)!) : null,
    });
  }
  return points.sort((a, b) => b.count - a.count);
}

export interface OverviewStats {
  totalActive: number;
  totalRemoved: number;
  byDealType: Record<string, number>;
  byPropertyType: Record<string, number>;
  lastRuns: Array<{
    source: string;
    finishedAt: Date | null;
    fetched: number;
    created: number;
    priceChanges: number;
  }>;
}

export async function getOverview(): Promise<OverviewStats> {
  const [totalActive, totalRemoved, deals, props, runs] = await Promise.all([
    prisma.listing.count({ where: { status: "active" } }),
    prisma.listing.count({ where: { status: "removed" } }),
    prisma.listing.groupBy({
      by: ["dealType"],
      where: { status: "active" },
      _count: true,
    }),
    prisma.listing.groupBy({
      by: ["propertyType"],
      where: { status: "active" },
      _count: true,
    }),
    prisma.collectRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 5,
      select: {
        source: true,
        finishedAt: true,
        fetched: true,
        created: true,
        priceChanges: true,
      },
    }),
  ]);

  const byDealType: Record<string, number> = {};
  for (const d of deals) byDealType[d.dealType] = d._count as number;
  const byPropertyType: Record<string, number> = {};
  for (const p of props) byPropertyType[p.propertyType] = p._count as number;

  return { totalActive, totalRemoved, byDealType, byPropertyType, lastRuns: runs };
}

export interface SoldEstimate {
  id: number;
  url: string;
  title: string;
  city: string | null;
  propertyType: string;
  layout: string | null;
  areaM2: number | null;
  lastPrice: number | null;
  lastPricePerM2: number | null;
  daysOnMarket: number;
  removedAt: Date | null;
}

/**
 * Odhady prodejů: inzeráty označené jako removed. lastPrice je poslední
 * NABÍDKOVÁ cena při zmizení (ne realizovaná) — viz upozornění v README.
 */
export async function getSoldEstimates(limit = 200): Promise<SoldEstimate[]> {
  const rows = await prisma.listing.findMany({
    where: { status: "removed" },
    orderBy: { removedAt: "desc" },
    take: limit,
  });
  return rows.map((l) => ({
    id: l.id,
    url: l.url,
    title: l.title,
    city: l.city,
    propertyType: l.propertyType,
    layout: l.layout,
    areaM2: l.areaM2,
    lastPrice: l.lastPrice ?? l.price,
    lastPricePerM2:
      (l.lastPrice ?? l.price) && l.areaM2
        ? Math.round((l.lastPrice ?? l.price)! / l.areaM2)
        : null,
    daysOnMarket: daysBetween(l.firstSeenAt, l.removedAt ?? new Date()),
    removedAt: l.removedAt,
  }));
}
