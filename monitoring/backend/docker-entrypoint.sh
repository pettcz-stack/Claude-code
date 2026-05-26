#!/bin/sh
set -e
# Synchronizace schématu do PostgreSQL (MVP používá db push; pro produkci
# lze přejít na verzované migrace).
echo "FOCUS: synchronizuji databázové schéma…"
npx prisma db push --schema=prisma/schema.postgres.prisma --skip-generate
echo "FOCUS: startuji server."
exec node dist/index.js
