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

  const templates = [
    {
      name: "Oprávněná kritika – obecná odpověď",
      category: "legitimate_criticism",
      language: "cs",
      body:
        "Dobrý den {author}, děkujeme za zpětnou vazbu. Mrzí nás, že jste měl/a nepříjemnou zkušenost. " +
        "Ozvěte se prosím na info@albixon.cz nebo do DM, ať můžeme situaci prověřit a najít řešení. Tým ALBIXON",
    },
    {
      name: "Dotaz na cenu / produkt",
      category: "neutral",
      language: "cs",
      body:
        "Dobrý den {author}, rádi Vám poskytneme aktuální informace. Napište nám prosím do DM nebo na " +
        "info@albixon.cz a obchodní oddělení se Vám ozve. Tým ALBIXON",
    },
    {
      name: "Pochvala – poděkování",
      category: "positive",
      language: "cs",
      body: "Děkujeme mockrát za hezkou zpětnou vazbu, {author}! Moc si toho vážíme. Tým ALBIXON",
    },
    {
      name: "Útok na značku – odpověď s pozváním do DM",
      category: "brand_attack",
      language: "cs",
      body:
        "Dobrý den {author}, Vaše tvrzení nemůžeme nechat bez odpovědi. Ozvěte se nám prosím přímo na " +
        "info@albixon.cz s konkrétními detaily, abychom mohli situaci věcně posoudit. Tým ALBIXON",
    },
  ];

  for (const t of templates) {
    const exists = await prisma.replyTemplate.findFirst({ where: { name: t.name } });
    if (!exists) {
      await prisma.replyTemplate.create({ data: t });
      logger.info("seeded template", { name: t.name });
    }
  }

  logger.info("seed complete");
  await prisma.$disconnect();
}

main().catch((err) => {
  logger.error("seed failed", { err: String(err) });
  process.exit(1);
});
