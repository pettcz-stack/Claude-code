#!/bin/sh
set -e
# Synchronizace schématu do PostgreSQL (MVP používá db push; pro produkci
# lze přejít na verzované migrace).
echo "Device Monitor: synchronizuji databázové schéma…"
npx prisma db push --schema=prisma/schema.postgres.prisma --skip-generate
echo "Device Monitor: startuji server."
exec node dist/index.js
