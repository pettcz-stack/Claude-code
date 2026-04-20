// Import config first so dotenv populates DATABASE_URL before Prisma initializes.
import "./config";
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  log: [
    { level: "warn", emit: "stdout" },
    { level: "error", emit: "stdout" },
  ],
});

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}
