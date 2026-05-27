#!/bin/bash
# FOCUS – záloha PostgreSQL DB.
#
# Použití (Docker Compose nasazení):
#   /etc/cron.daily/focus-backup
#   nebo přímo: COMPOSE_FILE=/opt/focus/docker-compose.production.yml bash focus-backup.sh
#
# Použití (bare-metal Postgres):
#   PGHOST=localhost PGUSER=focus PGDATABASE=focus bash focus-backup.sh
#
# Konfigurace:
#   BACKUP_DIR        kam ukládat (default /var/backups/focus)
#   RETENTION_DAYS    kolik dní držet lokálně (default 30)
#   OFFSITE_RCLONE    pokud nastaveno, kopíruje do "$OFFSITE_RCLONE" (např. b2:focus-backups/)
#   COMPOSE_FILE      cesta k docker-compose.yml; pokud chybí, používá lokální pg_dump

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/focus}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
mkdir -p "$BACKUP_DIR"

DATE=$(date -u +%Y-%m-%dT%H%M%SZ)
OUT="$BACKUP_DIR/focus-$DATE.sql.gz"

echo "[focus-backup] dumping → $OUT"

if [ -n "${COMPOSE_FILE:-}" ]; then
  docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U focus focus | gzip > "$OUT"
else
  pg_dump -U "${PGUSER:-focus}" -h "${PGHOST:-localhost}" "${PGDATABASE:-focus}" | gzip > "$OUT"
fi

# Sanity check – nesmí být prázdný (gzip header je vždy 20+ B)
if [ "$(stat -c%s "$OUT")" -lt 1000 ]; then
  echo "[focus-backup] ERR: záloha vypadá podezřele malá ($(stat -c%s "$OUT") B)" >&2
  exit 1
fi

echo "[focus-backup] OK: $(stat -c%s "$OUT") B"

# Retenční mazání
find "$BACKUP_DIR" -name 'focus-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete

# Off-site (volitelné)
if [ -n "${OFFSITE_RCLONE:-}" ]; then
  echo "[focus-backup] rclone copy → $OFFSITE_RCLONE"
  rclone copy "$OUT" "$OFFSITE_RCLONE"
fi

echo "[focus-backup] hotovo"
