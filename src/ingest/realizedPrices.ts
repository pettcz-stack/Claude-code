import { prisma } from "../db.js";
import type { RealizedPriceRecord } from "../collectors/cuzk/types.js";

export interface RealizedIngestResult {
  fetched: number;
  created: number;
  skipped: number; // duplicity (už uložené)
  errors: number;
}

/**
 * Uloží realizované ceny z katastru. Deduplikace přes `rawKey` (řízení +
 * nemovitost + cena) — opakovaný import stejných dat nic nezdvojí.
 */
export async function ingestRealizedPrices(
  records: RealizedPriceRecord[],
): Promise<RealizedIngestResult> {
  const result: RealizedIngestResult = {
    fetched: records.length,
    created: 0,
    skipped: 0,
    errors: 0,
  };

  for (const r of records) {
    try {
      const res = await prisma.realizedPrice.upsert({
        where: { rawKey: r.rawKey },
        update: {}, // existující nepřepisujeme (data z katastru jsou neměnná)
        create: {
          source: "cuzk",
          kuCode: r.kuCode,
          kuName: r.kuName,
          cadastreType: r.cadastreType,
          propertyType: r.propertyType,
          parcelId: r.parcelId,
          price: r.price,
          groupSize: r.groupSize,
          rizeniId: r.rizeniId,
          listinaRef: r.listinaRef,
          dealDate: r.dealDate ? new Date(r.dealDate) : null,
          lat: r.lat,
          lon: r.lon,
          city: r.city,
          rawKey: r.rawKey,
        },
      });
      // upsert nevrací, zda vytvořil — rozlišíme podle importedAt ~ teď
      if (Date.now() - res.importedAt.getTime() < 5000) result.created++;
      else result.skipped++;
    } catch (err) {
      console.error(`[cuzk] chyba u ${r.rawKey}:`, err);
      result.errors++;
    }
  }
  return result;
}
