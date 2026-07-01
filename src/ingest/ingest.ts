import { prisma } from "../db.js";
import { normalize } from "../core/normalize.js";
import type { RawListing } from "../core/types.js";

export interface IngestResult {
  fetched: number;
  created: number;
  updated: number;
  priceChanges: number;
  errors: number;
}

/**
 * Uloží dávku surových inzerátů. Pro každý:
 *  - nový → vytvoří Listing + první PriceHistory
 *  - existující → aktualizuje lastSeenAt, status zpět na "active";
 *    při změně ceny zapíše nový řádek do PriceHistory
 */
export async function ingest(
  raw: RawListing[],
  now: Date = new Date(),
): Promise<IngestResult> {
  const result: IngestResult = {
    fetched: raw.length,
    created: 0,
    updated: 0,
    priceChanges: 0,
    errors: 0,
  };

  for (const r of raw) {
    const n = normalize(r);
    try {
      const existing = await prisma.listing.findUnique({
        where: { source_externalId: { source: n.source, externalId: n.externalId } },
      });

      if (!existing) {
        const created = await prisma.listing.create({
          data: {
            source: n.source,
            externalId: n.externalId,
            url: n.url,
            title: n.title,
            dealType: n.dealType,
            propertyType: n.propertyType,
            layout: n.layout,
            areaM2: n.areaM2,
            price: n.price,
            pricePerM2: n.pricePerM2,
            currency: n.currency,
            locality: n.locality,
            city: n.city,
            lat: n.lat,
            lon: n.lon,
            dedupKey: n.dedupKey,
            status: "active",
            firstSeenAt: now,
            lastSeenAt: now,
          },
        });
        if (n.price != null) {
          await prisma.priceHistory.create({
            data: {
              listingId: created.id,
              price: n.price,
              pricePerM2: n.pricePerM2,
              seenAt: now,
            },
          });
        }
        result.created++;
        continue;
      }

      const priceChanged = n.price != null && n.price !== existing.price;
      await prisma.listing.update({
        where: { id: existing.id },
        data: {
          url: n.url,
          title: n.title,
          dealType: n.dealType,
          propertyType: n.propertyType,
          layout: n.layout,
          areaM2: n.areaM2,
          price: n.price,
          pricePerM2: n.pricePerM2,
          locality: n.locality,
          city: n.city,
          lat: n.lat,
          lon: n.lon,
          dedupKey: n.dedupKey,
          status: "active", // znovu spatřen → opět aktivní
          lastSeenAt: now,
          removedAt: null,
        },
      });
      if (priceChanged) {
        await prisma.priceHistory.create({
          data: {
            listingId: existing.id,
            price: n.price!,
            pricePerM2: n.pricePerM2,
            seenAt: now,
          },
        });
        result.priceChanges++;
      }
      result.updated++;
    } catch (err) {
      console.error(`[ingest] chyba u ${n.source}/${n.externalId}:`, err);
      result.errors++;
    }
  }

  return result;
}
