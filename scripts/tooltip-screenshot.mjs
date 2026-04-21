import puppeteer from "puppeteer";
import { mkdirSync } from "node:fs";

mkdirSync("docs/screenshots/live", { recursive: true });
const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.2 });
  await page.authenticate({ username: "honza", password: "AdminSecret123!" });
  await page.goto("http://localhost:3001/queue", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1000));

  // Hover on the red "Skrýt" button of the first row — tooltip appears after ~1s in Chrome.
  const hoverTarget = await page.$(".btn-warn");
  if (hoverTarget) {
    await hoverTarget.hover();
    await new Promise((r) => setTimeout(r, 1500));
  }
  await page.screenshot({
    path: "docs/screenshots/live/tooltip-queue.png",
    fullPage: false,
  });
  console.log("✓ tooltip-queue");
} finally {
  await browser.close();
}
