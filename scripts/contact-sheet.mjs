import puppeteer from "puppeteer";
import fs from "node:fs";
import path from "node:path";

const dir = "docs/screenshots";
const items = [
  ["01-queue.png", "1. Fronta"],
  ["02-audit.png", "2. Audit"],
  ["03-rules.png", "3. Pravidla"],
  ["04-templates.png", "4. Šablony"],
  ["05-accounts.png", "5. Účty"],
  ["06-stats.png", "6. Statistiky"],
  ["07-admin.png", "7. Admin"],
  ["08-queue-shortcuts.png", "8. Zkratky"],
  ["09-queue-drawer.png", "9. Detail"],
];

const cards = items
  .map(([file, label]) => {
    const p = path.resolve(dir, file);
    const b64 = fs.readFileSync(p).toString("base64");
    return `
      <figure>
        <img src="data:image/png;base64,${b64}" />
        <figcaption>${label}</figcaption>
      </figure>`;
  })
  .join("\n");

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0f172a; color: #e2e8f0; font-family: -apple-system, Segoe UI, sans-serif; padding: 32px; }
  header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 24px; border-bottom: 2px solid #334155; padding-bottom: 16px; }
  h1 { font-size: 28px; color: #2563eb; }
  .subtitle { color: #94a3b8; font-size: 14px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
  figure { background: #1e293b; border-radius: 12px; overflow: hidden; border: 1px solid #334155; }
  img { width: 100%; display: block; }
  figcaption { padding: 10px 14px; font-weight: 600; font-size: 16px; color: #f1f5f9; background: #0f172a; border-top: 1px solid #334155; }
  footer { margin-top: 24px; text-align: center; color: #64748b; font-size: 13px; }
</style>
</head>
<body>
  <header>
    <h1>Viktor čistič · ALBIXON moderace FB/IG</h1>
    <div class="subtitle">UI preview · ${new Date().toLocaleDateString("cs-CZ")}</div>
  </header>
  <div class="grid">${cards}</div>
  <footer>Plná dokumentace: docs/SCREENSHOTS.md · Rychlý start: QUICKSTART.md · Branch: claude/meta-comment-moderator-IXbw7</footer>
</body>
</html>`;

fs.writeFileSync("/tmp/contact.html", html);

const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1800, height: 1200, deviceScaleFactor: 1.3 });
  await page.goto(`file:///tmp/contact.html`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({
    path: "docs/screenshots/00-gallery.png",
    fullPage: true,
  });
  console.log("wrote docs/screenshots/00-gallery.png");
} finally {
  await browser.close();
}
