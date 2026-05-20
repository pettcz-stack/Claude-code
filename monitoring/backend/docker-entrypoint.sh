#!/bin/sh
set -e
# Synchronizace schématu do PostgreSQL (MVP používá db push; pro produkci
# lze přejít na verzované migrace).
echo "WorkView: synchronizuji databázové schéma…"
npx prisma db push --schema=prisma/schema.postgres.prisma --skip-generate
echo "WorkView: startuji server."
exec node dist/index.js
