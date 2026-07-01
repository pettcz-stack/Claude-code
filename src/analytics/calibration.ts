import { prisma } from "../db.js";
import { computeCalibration, type CalibrationRow } from "../core/calibration.js";

/**
 * Načte nabídkové ceny (aktivní inzeráty, prodej) a realizované ceny
 * (z katastru) a spočítá kalibraci nabídka→prodej po městě a typu.
 */
export async function getCalibration(minCount = 5): Promise<CalibrationRow[]> {
  const [listings, realized] = await Promise.all([
    prisma.listing.findMany({
      where: { status: "active", dealType: "prodej", price: { not: null } },
      select: { city: true, propertyType: true, price: true },
    }),
    prisma.realizedPrice.findMany({
      select: { city: true, propertyType: true, price: true },
    }),
  ]);

  return computeCalibration(
    listings.map((l) => ({
      city: l.city,
      propertyType: l.propertyType,
      price: l.price!,
    })),
    realized.map((r) => ({
      city: r.city,
      propertyType: r.propertyType,
      price: r.price,
    })),
    minCount,
  );
}
