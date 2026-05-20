#!/usr/bin/env bash
# Spustí celý Monitoring efektivity práce lokálně na jednom portu.
# Použití:  ./monitoring/dev.sh        (výchozí port 8080)
#           PORT=3000 ./monitoring/dev.sh
set -e
cd "$(dirname "$0")"

PORT="${PORT:-8080}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin}"

echo "==> Backend: instalace závislostí"
( cd backend && [ -d node_modules ] || npm install )
echo "==> Backend: databáze + demo data"
( cd backend && [ -f .env ] || cp .env.example .env )
( cd backend && npx prisma migrate deploy >/dev/null 2>&1 || npx prisma db push >/dev/null )
( cd backend && npm run seed )

echo "==> Frontend: build"
( cd frontend && [ -d node_modules ] || npm install )
( cd frontend && npm run build )

echo ""
echo "============================================================"
echo " Otevři:  http://localhost:${PORT}"
echo " Přihlášení:  ${ADMIN_USER} / ${ADMIN_PASSWORD}"
echo "============================================================"
echo ""

cd backend
PORT="$PORT" ADMIN_USER="$ADMIN_USER" ADMIN_PASSWORD="$ADMIN_PASSWORD" npm run dev
