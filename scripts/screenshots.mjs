import puppeteer from "puppeteer";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const USER = process.env.DASHBOARD_USERNAME ?? "honza";
const PASS = process.env.DASHBOARD_PASSWORD ?? "AdminSecret123!";

const pages = [
  { path: "/queue", file: "01-queue.png" },
  { path: "/audit", file: "02-audit.png" },
  { path: "/rules", file: "03-rules.png" },
  { path: "/templates", file: "04-templates.png" },
  { path: "/accounts", file: "05-accounts.png" },
  { path: "/stats", file: "06-stats.png" },
  { path: "/admin", file: "07-admin.png" },
];

mkdirSync("docs/screenshots", { recursive: true });

const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.authenticate({ username: USER, password: PASS });

  for (const p of pages) {
    const url = `${BASE}${p.path}`;
    console.log(`→ ${p.file}  (${url})`);
    await page.goto(url, { waitUntil: "networkidle0", timeout: 15000 });
    // Wait a beat so async data fetches render (tables, stats).
    await new Promise((r) => setTimeout(r, 1200));
    await page.screenshot({
      path: `docs/screenshots/${p.file}`,
      fullPage: true,
    });
  }

  // Also capture the Queue with the keyboard-shortcuts help overlay open.
  const page2 = await browser.newPage();
  await page2.setViewport({ width: 1440, height: 900 });
  await page2.authenticate({ username: USER, password: PASS });
  await page2.goto(`${BASE}/queue`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 800));
  await page2.keyboard.press("?");
  await new Promise((r) => setTimeout(r, 300));
  await page2.screenshot({ path: "docs/screenshots/08-queue-shortcuts.png", fullPage: false });

  // Comment detail drawer.
  await page2.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 200));
  await page2.keyboard.press("Enter");
  await new Promise((r) => setTimeout(r, 800));
  await page2.screenshot({ path: "docs/screenshots/09-queue-drawer.png", fullPage: false });

  console.log("done");
} finally {
  await browser.close();
}
