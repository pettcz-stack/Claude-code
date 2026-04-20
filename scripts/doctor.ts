// Preflight check: does my environment have everything it needs?
// Usage: npm run doctor
import fs from "node:fs";
import path from "node:path";

const results: Array<{ ok: boolean; name: string; detail?: string }> = [];

function check(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
}

// 1. Node version
const major = Number(process.versions.node.split(".")[0]);
check("Node.js ≥ 20", major >= 20, `running ${process.versions.node}`);

// 2. node_modules present
const rootNm = fs.existsSync("node_modules");
const backendNm = fs.existsSync("backend/node_modules") || fs.existsSync("node_modules/@prisma/client");
check("Dependencies installed", rootNm && backendNm, rootNm ? undefined : "run `npm install`");

// 3. .env present
const envPath = ".env";
const hasEnv = fs.existsSync(envPath);
check(".env file", hasEnv, hasEnv ? undefined : "run `npm run demo` to autogenerate");

let envText = "";
if (hasEnv) envText = fs.readFileSync(envPath, "utf8");

function envVar(k: string): string {
  const m = envText.match(new RegExp(`^${k}=(.*)$`, "m"));
  return m ? m[1].trim() : "";
}

// 4. Encryption key format
const key = envVar("TOKEN_ENCRYPTION_KEY");
check(
  "TOKEN_ENCRYPTION_KEY",
  /^[0-9a-fA-F]{64}$/.test(key),
  key ? "set (64 hex chars)" : "missing — generate with `node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"`"
);

// 5. Dashboard password
const pwd = envVar("DASHBOARD_PASSWORD");
check("DASHBOARD_PASSWORD", Boolean(pwd), pwd === "change-me" ? "still the default — change it!" : pwd ? "set" : "missing");

// 6. Anthropic API key
const anthropic = envVar("ANTHROPIC_API_KEY");
check(
  "ANTHROPIC_API_KEY",
  Boolean(anthropic),
  anthropic
    ? "set (classifier will work)"
    : "missing — UI works, but new comments won't be auto-classified. Get one at console.anthropic.com."
);

// 7. Meta app config
const metaApp = envVar("META_APP_ID");
const metaSecret = envVar("META_APP_SECRET");
check(
  "META_APP_ID + META_APP_SECRET",
  Boolean(metaApp && metaSecret),
  metaApp && metaSecret
    ? "set (OAuth will work)"
    : "missing — you can't link a real FB/IG page yet; demo data still works"
);

// 8. Database (Prisma resolves file:./x.db relative to schema.prisma, so we
// check both that path and the common alt location at backend/).
const dbUrl = envVar("DATABASE_URL");
let dbFound = false;
let dbHint = "non-file DB; skipping";
if (dbUrl.startsWith("file:")) {
  const rel = dbUrl.slice(5);
  const candidates = [
    path.resolve("backend/prisma", rel),
    path.resolve("backend", rel),
    path.resolve(rel),
  ];
  const hit = candidates.find((p) => fs.existsSync(p));
  dbFound = Boolean(hit);
  dbHint = hit ? hit : `not at any of: ${candidates.map((p) => p.replace(process.cwd() + "/", "")).join(", ")} — run \`npm run demo\``;
}
check("Prisma migration applied", dbFound, dbHint);

// 9. Prisma client generated
const clientPath = path.resolve("node_modules/.prisma/client/index.d.ts");
check("Prisma client generated", fs.existsSync(clientPath), fs.existsSync(clientPath) ? undefined : "run `npm --workspace backend run prisma:generate`");

// 10. Builds present?
check("Backend build", fs.existsSync("backend/dist/index.js"), fs.existsSync("backend/dist/index.js") ? undefined : "run `npm --workspace backend run build`");
check("Frontend build", fs.existsSync("frontend/dist/index.html"), fs.existsSync("frontend/dist/index.html") ? undefined : "run `npm --workspace frontend run build` (optional for dev)");

// Render report.
console.log("");
for (const r of results) {
  const icon = r.ok ? "\x1b[1;32m✓\x1b[0m" : "\x1b[1;31m✗\x1b[0m";
  const pad = r.name.padEnd(36);
  console.log(`${icon}  ${pad}${r.detail ? "— " + r.detail : ""}`);
}
const failed = results.filter((r) => !r.ok);
const criticalFailed = failed.filter((r) =>
  ["Node.js ≥ 20", "Dependencies installed", ".env file", "TOKEN_ENCRYPTION_KEY", "Prisma migration applied", "Prisma client generated"].includes(r.name)
);
console.log("");
if (criticalFailed.length === 0) {
  console.log("\x1b[1;32m✓ You're ready to boot — run `npm start` or `npm run demo`.\x1b[0m");
  if (failed.length > 0) {
    console.log(`\x1b[1;33m  (${failed.length} optional check${failed.length === 1 ? "" : "s"} flagged; AI classification / OAuth may be limited.)\x1b[0m`);
  }
} else {
  console.log(`\x1b[1;31m✗ ${criticalFailed.length} critical issue${criticalFailed.length === 1 ? "" : "s"}.\x1b[0m`);
  console.log("  Try: \x1b[1mnpm run demo\x1b[0m — it sets everything up automatically.");
  process.exit(1);
}
