import puppeteer from "puppeteer";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3001";
mkdirSync("docs/screenshots/live", { recursive: true });

async function run() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    // Admin: full tour
    const adminPage = await browser.newPage();
    await adminPage.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.2 });
    await adminPage.authenticate({ username: "honza", password: "AdminSecret123!" });

    await adminPage.goto(`${BASE}/queue`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 1000));
    await adminPage.screenshot({ path: "docs/screenshots/live/01-admin-queue.png", fullPage: false });
    console.log("✓ 01-admin-queue");

    // Keyboard shortcuts overlay (trigger with '?')
    await adminPage.keyboard.press("?");
    await new Promise((r) => setTimeout(r, 400));
    await adminPage.screenshot({ path: "docs/screenshots/live/02-admin-shortcuts.png", fullPage: false });
    console.log("✓ 02-admin-shortcuts");
    await adminPage.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 200));

    // Detail drawer (Enter on first row)
    await adminPage.keyboard.press("Enter");
    await new Promise((r) => setTimeout(r, 900));
    await adminPage.screenshot({ path: "docs/screenshots/live/03-admin-drawer.png", fullPage: false });
    console.log("✓ 03-admin-drawer");
    await adminPage.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 300));

    // Admin page
    await adminPage.goto(`${BASE}/admin`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 900));
    await adminPage.screenshot({ path: "docs/screenshots/live/04-admin-settings.png", fullPage: true });
    console.log("✓ 04-admin-settings");

    // Usage page
    await adminPage.goto(`${BASE}/usage`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 900));
    await adminPage.screenshot({ path: "docs/screenshots/live/05-admin-usage.png", fullPage: true });
    console.log("✓ 05-admin-usage");

    // Stats
    await adminPage.goto(`${BASE}/stats`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 900));
    await adminPage.screenshot({ path: "docs/screenshots/live/06-admin-stats.png", fullPage: true });
    console.log("✓ 06-admin-stats");

    await adminPage.close();

    // Moderator: fewer links, no delete button
    const modPage = await browser.newPage();
    await modPage.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.2 });
    await modPage.authenticate({ username: "petra", password: "ModSecret456@" });
    await modPage.goto(`${BASE}/queue`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 900));
    await modPage.screenshot({ path: "docs/screenshots/live/07-moderator-queue.png", fullPage: false });
    console.log("✓ 07-moderator-queue (vidíš: role=moderator, žádné Pravidla/Šablony/Účty/Admin v navigaci)");

    await modPage.close();

    // Viewer: read-only
    const viewerPage = await browser.newPage();
    await viewerPage.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.2 });
    await viewerPage.authenticate({ username: "karel", password: "ViewerSecret789#" });
    await viewerPage.goto(`${BASE}/queue`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 900));
    await viewerPage.screenshot({ path: "docs/screenshots/live/08-viewer-queue.png", fullPage: false });
    console.log("✓ 08-viewer-queue (vidíš: role=viewer, všechna tlačítka akcí skryta)");

    await viewerPage.close();
  } finally {
    await browser.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
