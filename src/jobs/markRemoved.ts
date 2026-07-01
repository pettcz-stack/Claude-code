import { prisma } from "../db.js";
import { config } from "../config.js";

/**
 * Označí aktivní inzeráty, které jsme delší dobu (SOLD_AFTER_DAYS) neviděli,
 * jako "removed". Uloží lastPrice = poslední známou cenu — to je náš ODHAD
 * prodejní ceny (POZOR: je to nabídková cena při zmizení, ne realizovaná).
 * Vrací počet takto označených inzerátů.
 */
export async function markRemoved(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - config.soldAfterDays * 86_400_000);

  const stale = await prisma.listing.findMany({
    where: { status: "active", lastSeenAt: { lt: cutoff } },
    select: { id: true, price: true },
  });

  for (const l of stale) {
    await prisma.listing.update({
      where: { id: l.id },
      data: { status: "removed", removedAt: now, lastPrice: l.price },
    });
  }
  return stale.length;
}
