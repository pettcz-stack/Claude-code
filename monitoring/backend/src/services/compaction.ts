import { prisma } from '../db.js';

/**
 * Server-side compaction starých intervalů.
 *
 * Problém: agent posílá 60s intervaly. Pro 1000 uživatelů × 60 intervalů/h
 * × 8 h × 22 dnů = 10.5M řádků/měsíc raw dat. U produkčních pracovníků
 * (operátoři u strojů) je až 60 % intervalů "session locked / žádná aktivita"
 * – 600 řádků s prakticky identickým obsahem = plýtvání místa na disku.
 *
 * Řešení: jakmile je interval starší než `COMPACTION_AFTER_DAYS` (default 2),
 * jsou consecutive "neaktivní" intervaly mergnuté do jednoho s extended
 * `intervalSeconds`. Tj.:
 *
 *   09:00 locked 60s  ──┐
 *   09:01 locked 60s    │ → 09:00 locked 1800s (30 řádků → 1 řádek)
 *   09:02 locked 60s    │
 *   ...                 │
 *   09:29 locked 60s  ──┘
 *
 * Lossless pro analytiku: součet `intervalSeconds`/`activeSeconds`/...
 * zůstává stejný. DailyStat agreguje hodinově, ne po intervalech, takže není
 * dotčen. Top apps používá DailyAppStat (separátní), bez vlivu.
 *
 * Bezpečnost vůči concurrent ingest: kompaktujeme jen data >= 24 h stará,
 * agent nikdy nepostuje do minulosti tak hluboko.
 *
 * Kompakce probíhá v rámci jedné hodiny – nemerguje přes hour boundary,
 * aby heatmap a per-hour analytika fungovaly přesně.
 */

const COMPACTION_AFTER_DAYS = 2;
// Pravidla pro "lze sloučit": interval je "neaktivní" když je locked NEBO
// má < 3 sekundy aktivity a < 3 úhozy + kliky.
function isMergeable(it: {
  sessionLocked: boolean;
  activeSeconds: number;
  keystrokeCount: number;
  mouseEvents: number;
}): boolean {
  if (it.sessionLocked) return true;
  if (it.activeSeconds < 3 && it.keystrokeCount + it.mouseEvents < 3) return true;
  return false;
}

export type CompactionResult = {
  processedUsers: number;
  rowsBefore: number;
  rowsAfter: number;
  savedRows: number;
};

/**
 * Spustí compaction pro intervaly starší než COMPACTION_AFTER_DAYS.
 * Vrátí statistiku úspory. Idempotentní – už zkomprimované intervaly nejsou
 * znova mergeable (jeden velký row nemá s čím se mergnout).
 */
export async function compactOldIntervals(): Promise<CompactionResult> {
  const cutoff = new Date(Date.now() - COMPACTION_AFTER_DAYS * 86_400_000);

  // Najdi všechny uživatele, kteří mají něco ke kompakci.
  const candidates = await prisma.activityInterval.groupBy({
    by: ['userId'],
    where: { intervalStart: { lt: cutoff } },
    _count: { _all: true },
  });

  let rowsBefore = 0;
  let rowsAfter = 0;
  let processedUsers = 0;

  for (const u of candidates) {
    rowsBefore += u._count._all;
    processedUsers++;
    const before = u._count._all;
    const after = await compactUser(u.userId, cutoff);
    rowsAfter += after;
    // Throttle – nezahaltit DB při dlouhých provozech.
    if (processedUsers % 50 === 0) await new Promise((r) => setTimeout(r, 100));
    if (before > after) {
      // eslint-disable-next-line no-console
      console.log(`[compaction] user ${u.userId.slice(0, 8)}: ${before} -> ${after} (-${before - after})`);
    }
  }

  return { processedUsers, rowsBefore, rowsAfter, savedRows: rowsBefore - rowsAfter };
}

/**
 * Compaction pro jednoho uživatele. Načte všechny jeho staré intervaly,
 * najde consecutive mergeable bloky v rámci jedné hodiny a sloučí je.
 * Vrátí počet řádků PO kompakci.
 */
async function compactUser(userId: string, cutoff: Date): Promise<number> {
  const rows = await prisma.activityInterval.findMany({
    where: { userId, intervalStart: { lt: cutoff } },
    orderBy: { intervalStart: 'asc' },
  });
  if (rows.length < 2) return rows.length;

  const toDelete: string[] = [];
  const toUpdate: { id: string; intervalSeconds: number; activeSeconds: number; idleSeconds: number; keystrokeCount: number; mouseEvents: number; typingMs: number; typingKeystrokeCount: number }[] = [];

  // Sloučí consecutive mergeable intervaly. Skupina začíná prvním mergeable a končí
  // buď non-mergeable, koncem hodiny, nebo koncem dat. Skupinu reprezentuje "leader"
  // (první interval) který dostane sumu, ostatní jsou označeny pro delete.
  let leader: typeof rows[0] | null = null;
  let leaderSum = { intervalSeconds: 0, activeSeconds: 0, idleSeconds: 0, keystrokeCount: 0, mouseEvents: 0, typingMs: 0, typingKeystrokeCount: 0 };

  for (let i = 0; i < rows.length; i++) {
    const it = rows[i];
    const mergeable = isMergeable(it);
    const sameHour = leader
      ? Math.floor(leader.intervalStart.getTime() / 3_600_000) === Math.floor(it.intervalStart.getTime() / 3_600_000)
      : false;
    const consecutive = leader
      ? it.intervalStart.getTime() - (leader.intervalStart.getTime() + leaderSum.intervalSeconds * 1000) < 5_000 // < 5s gap
      : false;

    if (mergeable && leader && sameHour && consecutive) {
      // Pokračuje stejná skupina
      leaderSum.intervalSeconds += it.intervalSeconds;
      leaderSum.activeSeconds += it.activeSeconds;
      leaderSum.idleSeconds += it.idleSeconds;
      leaderSum.keystrokeCount += it.keystrokeCount;
      leaderSum.mouseEvents += it.mouseEvents;
      leaderSum.typingMs += it.typingMs;
      leaderSum.typingKeystrokeCount += it.typingKeystrokeCount;
      toDelete.push(it.id);
    } else {
      // Uzavři předchozí skupinu (pokud měla aspoň 2 členy → update leadera)
      if (leader && leaderSum.intervalSeconds > leader.intervalSeconds) {
        toUpdate.push({ id: leader.id, ...leaderSum });
      }
      // Začni novou skupinu jen pokud je tento interval mergeable
      if (mergeable) {
        leader = it;
        leaderSum = {
          intervalSeconds: it.intervalSeconds,
          activeSeconds: it.activeSeconds,
          idleSeconds: it.idleSeconds,
          keystrokeCount: it.keystrokeCount,
          mouseEvents: it.mouseEvents,
          typingMs: it.typingMs,
          typingKeystrokeCount: it.typingKeystrokeCount,
        };
      } else {
        leader = null;
      }
    }
  }
  // Uzavři poslední skupinu
  if (leader && leaderSum.intervalSeconds > leader.intervalSeconds) {
    toUpdate.push({ id: leader.id, ...leaderSum });
  }

  if (toUpdate.length === 0 && toDelete.length === 0) return rows.length;

  // Update leadery + delete ostatní (v transakci pro atomic).
  await prisma.$transaction(async (tx) => {
    for (const u of toUpdate) {
      await tx.activityInterval.update({ where: { id: u.id }, data: u });
    }
    if (toDelete.length > 0) {
      // SQLite limit 999 parametrů – po 500
      for (let i = 0; i < toDelete.length; i += 500) {
        await tx.activityInterval.deleteMany({ where: { id: { in: toDelete.slice(i, i + 500) } } });
      }
    }
  });

  return rows.length - toDelete.length;
}

/**
 * Plánovaný úkol – běží 1× za 24h. První běh 15 min po startu (po retention pruning).
 */
export function scheduleCompaction(): void {
  const run = async () => {
    try {
      const r = await compactOldIntervals();
      // eslint-disable-next-line no-console
      console.log(`[compaction] hotovo: ${r.processedUsers} uživatelů, ${r.rowsBefore} → ${r.rowsAfter} (-${r.savedRows}, -${Math.round((r.savedRows / Math.max(r.rowsBefore, 1)) * 100)}%)`);
    } catch (e) {
      console.error('[compaction] chyba:', e);
    }
  };
  setTimeout(run, 15 * 60 * 1000);
  setInterval(run, 24 * 60 * 60 * 1000);
}
