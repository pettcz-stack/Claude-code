// Import config first so dotenv populates DATABASE_URL before Prisma initializes.
import "./config";
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  log: [
    { level: "warn", emit: "stdout" },
    { level: "error", emit: "stdout" },
  ],
});

// Enable SQLite WAL mode + reasonable pragmas once at startup so reads never
// block writes (important during bursts of webhook-triggered classification).
// NO-OP for Postgres — the $executeRawUnsafe is silently ignored by the
// Postgres driver parser (we try/catch to be safe).
(async () => {
  if (!process.env.DATABASE_URL?.startsWith("file:")) return;
  try {
    await prisma.$executeRawUnsafe("PRAGMA journal_mode = WAL");
    await prisma.$executeRawUnsafe("PRAGMA synchronous = NORMAL");
    await prisma.$executeRawUnsafe("PRAGMA busy_timeout = 5000");
  } catch {
    // ignore — the server might not be ready yet; reads work either way.
  }
})();

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}
