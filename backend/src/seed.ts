import { prisma } from "./db";
import { logger } from "./utils/logger";

async function main(): Promise<void> {
  // Seed default auto-moderation rules.
  const defaults = [
    { name: "Auto-delete spam", category: "spam", minConfidence: 0.9, action: "delete", enabled: true },
    { name: "Auto-hide vulgarity", category: "vulgarity", minConfidence: 0.85, action: "hide", enabled: true },
  ];

  for (const r of defaults) {
    const existing = await prisma.rule.findFirst({ where: { name: r.name } });
    if (!existing) {
      await prisma.rule.create({ data: r });
      logger.info("seeded rule", { name: r.name });
    }
  }

  await prisma.setting.upsert({
    where: { key: "auto_moderation_paused" },
    create: { key: "auto_moderation_paused", value: "false" },
    update: {},
  });

  logger.info("seed complete");
  await prisma.$disconnect();
}

main().catch((err) => {
  logger.error("seed failed", { err: String(err) });
  process.exit(1);
});
