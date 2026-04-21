import puppeteer from "puppeteer";

const BASE = "http://localhost:3001";

async function captureRole(browser, user, pass, label) {
  // Fresh incognito context = fresh auth, no leakage from previous pages.
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.2 });
  await page.authenticate({ username: user, password: pass });
  await page.goto(`${BASE}/queue`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: `docs/screenshots/live/${label}.png`, fullPage: false });
  await ctx.close();
  console.log(`✓ ${label}  (${user})`);
}

const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
try {
  await captureRole(browser, "honza", "AdminSecret123!", "role-admin");
  await captureRole(browser, "petra", "ModSecret456@", "role-moderator");
  await captureRole(browser, "karel", "ViewerSecret789#", "role-viewer");
} finally {
  await browser.close();
}
