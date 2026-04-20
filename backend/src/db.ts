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
