#!/usr/bin/env bash
# One-command bootstrap: install deps, migrate DB, seed demo data, start server.
# Safe to re-run — each step is idempotent.
set -euo pipefail

cd "$(dirname "$0")/.."

say() { printf "\033[1;34m▸ %s\033[0m\n" "$1"; }
warn() { printf "\033[1;33m⚠ %s\033[0m\n" "$1"; }

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. On macOS: brew install node@20"
  exit 1
fi
NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 20 ]; then
  warn "Detected Node $NODE_MAJOR — recommend 20 or newer."
fi

if [ ! -f .env ]; then
  say "Creating .env from .env.example…"
  cp .env.example .env
  KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  # Inject generated encryption key + sane defaults so the server boots.
  node -e "
    const fs = require('fs');
    let s = fs.readFileSync('.env','utf8');
    s = s.replace(/^TOKEN_ENCRYPTION_KEY=.*/m,'TOKEN_ENCRYPTION_KEY=$KEY');
    s = s.replace(/^DASHBOARD_PASSWORD=.*/m,'DASHBOARD_PASSWORD=demo');
    if (!/^PORT=/m.test(s)) s = 'PORT=3001\n' + s;
    fs.writeFileSync('.env', s);
  "
  say ".env created with a generated encryption key and password 'demo'."
fi

if [ ! -d node_modules ]; then
  say "Installing dependencies (this takes ~30 s)…"
  npm install --silent
fi

say "Running Prisma migration (idempotent)…"
# Prisma CLI reads .env from its CWD (backend/) — export from root .env so
# DATABASE_URL + TOKEN_ENCRYPTION_KEY are visible to the child process.
set -a
# shellcheck disable=SC1091
source .env
set +a

npm --workspace backend run prisma:generate --silent
# `prisma migrate deploy` applies committed migrations (idempotent);
# fall back to `migrate dev` for first-time setup.
(cd backend && npx prisma migrate deploy 2>/dev/null) || \
  (cd backend && npx prisma migrate dev --name init --skip-seed 2>&1 | tail -5)

say "Seeding default rules + templates…"
npm --workspace backend run seed --silent

say "Seeding demo data (3 accounts, 9 classified comments)…"
npx --prefix backend tsx scripts/seed-demo.ts

say "Building backend + frontend…"
npm --workspace backend run build --silent
npm --workspace frontend run build --silent

printf "\n\033[1;32m✓ Ready. Open http://localhost:3001 (admin / demo)\033[0m\n\n"
exec node backend/dist/index.js
