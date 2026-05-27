import { prisma } from '../db.js';
import { demoUserWhere } from './demoFilter.js';

/**
 * Souhrn tisku za období – per uživatel. Vrací top N podle počtu stran.
 * Pro dashboard sekci "Tisk & USB" – analyticky čtivý přehled, kdo nejvíc tiskne.
 */
export async function printSummary(from: Date, to: Date, limit = 100) {
  const userFilter = await demoUserWhere();
  const rows = await prisma.$queryRaw<Array<{
    userId: string | null;
    displayName: string | null;
    department: string | null;
    jobs: bigint;
    pages: bigint;
    color_pages: bigint;
    duplex_pages: bigint;
    a4_pages: bigint;
    a3_pages: bigint;
    other_pages: bigint;
  }>>`
    SELECT
      p."userId"           AS "userId",
      u."displayName"      AS "displayName",
      u."department"       AS "department",
      COUNT(p.id)          AS "jobs",
      COALESCE(SUM(p.pages * p.copies), 0)                          AS "pages",
      COALESCE(SUM(CASE WHEN p.color = true   THEN p.pages * p.copies ELSE 0 END), 0) AS "color_pages",
      COALESCE(SUM(CASE WHEN p.duplex = true  THEN p.pages * p.copies ELSE 0 END), 0) AS "duplex_pages",
      COALESCE(SUM(CASE WHEN p."paperSize" = 'A4' THEN p.pages * p.copies ELSE 0 END), 0) AS "a4_pages",
      COALESCE(SUM(CASE WHEN p."paperSize" = 'A3' THEN p.pages * p.copies ELSE 0 END), 0) AS "a3_pages",
      COALESCE(SUM(CASE WHEN p."paperSize" NOT IN ('A4','A3') OR p."paperSize" IS NULL THEN p.pages * p.copies ELSE 0 END), 0) AS "other_pages"
    FROM "PrintJob" p
    LEFT JOIN "MonitoredUser" u ON u.id = p."userId"
    WHERE p."jobAt" >= ${from} AND p."jobAt" < ${to}
    GROUP BY p."userId", u."displayName", u."department"
    ORDER BY "pages" DESC
    LIMIT ${limit}
  `;

  // Filtruj demo uživatele (where uplatnit na MonitoredUser – pokud existuje filter)
  const filtered = rows.filter((r) => {
    if (!r.userId) return true;
    // demo filter je where klauzule typu { id: { in: [...] } } – aplikujeme ručně přes id check
    if (typeof userFilter === 'object' && 'id' in userFilter) {
      const f = userFilter as { id?: { in?: string[] } };
      if (f.id?.in) return f.id.in.includes(r.userId);
    }
    return true;
  });

  return filtered.map((r) => ({
    userId: r.userId,
    displayName: r.displayName ?? '—',
    department: r.department,
    jobs: Number(r.jobs),
    pages: Number(r.pages),
    colorPages: Number(r.color_pages),
    duplexPages: Number(r.duplex_pages),
    a4Pages: Number(r.a4_pages),
    a3Pages: Number(r.a3_pages),
    otherPages: Number(r.other_pages),
  }));
}

/** Detail tiskových úloh jednoho uživatele – pro drill-down v UI. */
export async function userPrintJobs(userId: string, from: Date, to: Date, limit = 500) {
  return prisma.printJob.findMany({
    where: { userId, jobAt: { gte: from, lt: to } },
    orderBy: { jobAt: 'desc' },
    take: limit,
    select: {
      id: true, jobAt: true, printerName: true, documentName: true,
      pages: true, copies: true, paperSize: true, color: true, duplex: true,
    },
  });
}

/**
 * Souhrn USB přesunů per uživatel – kdo nejvíc kopíruje na/z USB.
 * Klíčový ukazatel pro DLP (data loss prevention) compliance.
 */
export async function usbSummary(from: Date, to: Date, limit = 100) {
  const userFilter = await demoUserWhere();
  const rows = await prisma.$queryRaw<Array<{
    userId: string | null;
    displayName: string | null;
    department: string | null;
    events: bigint;
    write_events: bigint;
    read_events: bigint;
    delete_events: bigint;
    total_bytes: bigint | null;
    write_bytes: bigint | null;
  }>>`
    SELECT
      e."userId"             AS "userId",
      u."displayName"        AS "displayName",
      u."department"         AS "department",
      COUNT(e.id)            AS "events",
      COALESCE(SUM(CASE WHEN e.action IN ('CREATE','WRITE') THEN 1 ELSE 0 END), 0) AS "write_events",
      COALESCE(SUM(CASE WHEN e.action = 'READ'              THEN 1 ELSE 0 END), 0) AS "read_events",
      COALESCE(SUM(CASE WHEN e.action = 'DELETE'            THEN 1 ELSE 0 END), 0) AS "delete_events",
      COALESCE(SUM(e."sizeBytes"), 0)                                              AS "total_bytes",
      COALESCE(SUM(CASE WHEN e.action IN ('CREATE','WRITE') THEN e."sizeBytes" ELSE 0 END), 0) AS "write_bytes"
    FROM "UsbFileEvent" e
    LEFT JOIN "MonitoredUser" u ON u.id = e."userId"
    WHERE e."eventAt" >= ${from} AND e."eventAt" < ${to}
    GROUP BY e."userId", u."displayName", u."department"
    ORDER BY "write_bytes" DESC, "events" DESC
    LIMIT ${limit}
  `;

  const filtered = rows.filter((r) => {
    if (!r.userId) return true;
    if (typeof userFilter === 'object' && 'id' in userFilter) {
      const f = userFilter as { id?: { in?: string[] } };
      if (f.id?.in) return f.id.in.includes(r.userId);
    }
    return true;
  });

  return filtered.map((r) => ({
    userId: r.userId,
    displayName: r.displayName ?? '—',
    department: r.department,
    events: Number(r.events),
    writeEvents: Number(r.write_events),
    readEvents: Number(r.read_events),
    deleteEvents: Number(r.delete_events),
    totalBytes: Number(r.total_bytes ?? 0),
    writeBytes: Number(r.write_bytes ?? 0),
  }));
}

/** Detail USB událostí jednoho uživatele. */
export async function userUsbEvents(userId: string, from: Date, to: Date, limit = 500) {
  const rows = await prisma.usbFileEvent.findMany({
    where: { userId, eventAt: { gte: from, lt: to } },
    orderBy: { eventAt: 'desc' },
    take: limit,
    select: {
      id: true, eventAt: true, action: true,
      driveLetter: true, driveLabel: true,
      fileName: true, fileExt: true, sizeBytes: true,
    },
  });
  // BigInt → number pro JSON serializaci (max safe integer pokrývá ~9 PB, dost pro velikosti souborů)
  return rows.map((r) => ({ ...r, sizeBytes: r.sizeBytes !== null ? Number(r.sizeBytes) : null }));
}
