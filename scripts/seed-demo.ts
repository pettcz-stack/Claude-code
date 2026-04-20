// Fill the DB with realistic mock data so screenshots show content.
import { prisma } from "../backend/src/db";
import { encrypt } from "../backend/src/crypto";

async function main() {
  // Clean slate (except seed rules/templates).
  await prisma.evidence.deleteMany();
  await prisma.action.deleteMany();
  await prisma.classification.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.post.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.account.deleteMany();

  const fbAccount = await prisma.account.create({
    data: {
      platform: "FB",
      pageId: "123456789",
      pageName: "ALBIXON",
      accessTokenEncrypted: encrypt("FAKE-DEMO-TOKEN"),
      tokenExpiresAt: new Date(Date.now() + 45 * 24 * 3600 * 1000),
      active: true,
    },
  });
  const igAccount = await prisma.account.create({
    data: {
      platform: "IG",
      pageId: "987654321",
      pageName: "ALBIXON (IG)",
      accessTokenEncrypted: encrypt("FAKE-DEMO-TOKEN"),
      tokenExpiresAt: new Date(Date.now() + 6 * 24 * 3600 * 1000), // near expiry
      active: true,
    },
  });
  await prisma.account.create({
    data: {
      platform: "FB",
      pageId: "111222333",
      pageName: "BRILIX",
      accessTokenEncrypted: encrypt("FAKE-DEMO-TOKEN"),
      tokenExpiresAt: new Date(Date.now() + 58 * 24 * 3600 * 1000),
      active: true,
    },
  });

  const post1 = await prisma.post.create({
    data: {
      accountId: fbAccount.id,
      platformPostId: "post_1",
      postedAt: new Date(Date.now() - 8 * 3600 * 1000),
      contentPreview: "Nová generace ALBIXON zastřešení 2026 — teplejší bazén o 8 °C a menší spotřeba chemie.",
      permalink: "https://facebook.com/albixon/posts/post_1",
    },
  });
  const post2 = await prisma.post.create({
    data: {
      accountId: igAccount.id,
      platformPostId: "ig_media_1",
      postedAt: new Date(Date.now() - 24 * 3600 * 1000),
      contentPreview: "Jarní akce: -15 % na všechna polykarbonátová zastřešení do 30. dubna.",
      permalink: "https://instagram.com/p/demo",
    },
  });

  const comments = [
    {
      post: post1,
      author: "Jan Novák",
      text: "Vyhraj iPhone 15 zdarma! http://free-win.example",
      cat: "spam", conf: 0.97, action: "delete", lang: "cs",
      reasoning: "Obsahuje podezřelý odkaz a výzvu k výhře typickou pro phishing.",
      status: "actioned", actionBy: "auto:default-spam",
    },
    {
      post: post1,
      author: "Petr Svoboda",
      text: "ALBIXON je podvodnická firma, zakazky neplni a kradou zalohy! Radeji Mountfield nebo Desjoyaux.",
      cat: "brand_attack", conf: 0.88, action: "review", lang: "cs",
      reasoning: "Obvinění z podvodu bez důkazu + pozitivní srovnání s konkurencí (Mountfield, Desjoyaux).",
      status: "classified",
    },
    {
      post: post1,
      author: "Lucie K.",
      text: "Mám u vás objednané zastřešení od března, stále nic nepřišlo, podpora neodpovídá. Zklamání.",
      cat: "legitimate_criticism", conf: 0.92, action: "keep", lang: "cs",
      reasoning: "Oprávněná stížnost na dodací lhůtu a neresponzivní podporu.",
      status: "classified",
    },
    {
      post: post2,
      author: "Tomáš Dvořák",
      text: "Ty vole, za tyhle ceny ať jdou do háje…",
      cat: "vulgarity", conf: 0.88, action: "hide", lang: "cs",
      reasoning: "Vulgární výraz a urážlivý tón bez věcného obsahu.",
      status: "actioned", actionBy: "auto:default-vulgarity",
    },
    {
      post: post2,
      author: "Marie Horáková",
      text: "Super bazén, máme ho 3 roky a jsme naprosto spokojení! Doporučuji :)",
      cat: "positive", conf: 0.99, action: "keep", lang: "cs",
      reasoning: "Pozitivní zpětná vazba, doporučení.",
      status: "classified",
    },
    {
      post: post1,
      author: "Ondra",
      text: "Kolik stojí polykarbonátové zastřešení pro 8x4 m bazén?",
      cat: "neutral", conf: 0.95, action: "keep", lang: "cs",
      reasoning: "Věcný dotaz na cenu produktu.",
      status: "classified",
    },
    {
      post: post1,
      author: "SpamBot3000",
      text: "📢📢 Půjčka bez registru IHNED, volej 777 777 777",
      cat: "spam", conf: 0.99, action: "delete", lang: "cs",
      reasoning: "Reklama na půjčku bez registru s telefonním číslem.",
      status: "actioned", actionBy: "auto:default-spam",
    },
    {
      post: post2,
      author: "Anna B.",
      text: "Prosím o info, jestli vyrábíte i zastřešení pro přírodní koupací jezírka?",
      cat: "neutral", conf: 0.91, action: "keep", lang: "cs",
      reasoning: "Dotaz na nabízené produkty, bez negativního podtónu.",
      status: "new",
    },
    {
      post: post2,
      author: "Karel",
      text: "Reklamace číslo R-2024-0412, technik se vůbec neozval. Velmi nepříjemné.",
      cat: "legitimate_criticism", conf: 0.94, action: "keep", lang: "cs",
      reasoning: "Konkrétní reklamace s číslem případu, oprávněná stížnost.",
      status: "classified",
    },
  ];

  for (const c of comments) {
    const comment = await prisma.comment.create({
      data: {
        postId: c.post.id,
        platformCommentId: `plat_${Math.random().toString(36).slice(2, 10)}`,
        authorName: c.author,
        authorId: `uid_${Math.floor(Math.random() * 1e9)}`,
        text: c.text,
        createdAtPlatform: new Date(Date.now() - Math.floor(Math.random() * 6) * 3600 * 1000),
        status: c.status,
      },
    });
    await prisma.classification.create({
      data: {
        commentId: comment.id,
        category: c.cat,
        confidence: c.conf,
        reasoning: c.reasoning,
        recommendedAction: c.action,
        detectedLanguage: c.lang,
        modelUsed: "claude-haiku-4-5",
      },
    });
    if (c.status === "actioned" && c.actionBy) {
      await prisma.action.create({
        data: {
          commentId: comment.id,
          actionType: c.action === "delete" ? "delete" : "hide",
          performedBy: c.actionBy,
          success: true,
        },
      });
    }
    if (c.cat === "brand_attack" || c.cat === "vulgarity") {
      await prisma.evidence.create({
        data: {
          commentId: comment.id,
          category: c.cat,
          contentHash:
            "a".repeat(8) + Math.random().toString(16).slice(2, 10).padEnd(8, "0") + "b".repeat(48),
          snapshotJson: JSON.stringify({ text: c.text, author: c.author }),
          permalinkAtCapture: c.post.permalink,
        },
      });
    }
  }

  // Some audit entries.
  await prisma.auditLog.createMany({
    data: [
      { entityType: "Account", entityId: fbAccount.id, event: "oauth.linked", metadata: JSON.stringify({ platform: "FB" }) },
      { entityType: "Account", entityId: fbAccount.id, event: "fetch", metadata: JSON.stringify({ postsSeen: 12, newComments: 9 }) },
    ],
  });

  console.log("demo data ready");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
