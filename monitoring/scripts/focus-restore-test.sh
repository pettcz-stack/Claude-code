#!/bin/bash
# FOCUS – nedestruktivní test obnovy zálohy.
#
# Vytvoří dočasnou DB focus_restore_test, naimportuje poslední dump, spočítá
# pár řádků a DB zase smaže. Doporučeno spouštět 1× za 3 měsíce přes cron.
#
# Použití:
#   COMPOSE_FILE=/opt/focus/docker-compose.production.yml bash focus-restore-test.sh
# nebo:
#   PGHOST=localhost PGUSER=focus bash focus-restore-test.sh

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/focus}"
LATEST=$(ls -1t "$BACKUP_DIR"/focus-*.sql.gz 2>/dev/null | head -1)
if [ -z "$LATEST" ]; then
  echo "[restore-test] FATAL: žádná záloha v $BACKUP_DIR" >&2
  exit 1
fi
echo "[restore-test] testuju $LATEST"

TEST_DB="focus_restore_test_$(date +%s)"

if [ -n "${COMPOSE_FILE:-}" ]; then
  PSQL="docker compose -f $COMPOSE_FILE exec -T postgres psql -U focus"
  CREATE="docker compose -f $COMPOSE_FILE exec -T postgres createdb -U focus $TEST_DB"
  DROP="docker compose -f $COMPOSE_FILE exec -T postgres dropdb -U focus $TEST_DB"
else
  PSQL="psql -U ${PGUSER:-focus} -h ${PGHOST:-localhost}"
  CREATE="createdb -U ${PGUSER:-focus} -h ${PGHOST:-localhost} $TEST_DB"
  DROP="dropdb -U ${PGUSER:-focus} -h ${PGHOST:-localhost} $TEST_DB"
fi

echo "[restore-test] vytvářím $TEST_DB"
$CREATE

trap '$DROP || true' EXIT

echo "[restore-test] importuju dump"
zcat "$LATEST" | $PSQL "$TEST_DB"

echo "[restore-test] kontrolní dotazy"
USERS=$($PSQL "$TEST_DB" -At -c 'SELECT COUNT(*) FROM "MonitoredUser";')
DEVICES=$($PSQL "$TEST_DB" -At -c 'SELECT COUNT(*) FROM "Device";')
INTERVALS=$($PSQL "$TEST_DB" -At -c 'SELECT COUNT(*) FROM "ActivityInterval";')
echo "[restore-test] users=$USERS devices=$DEVICES intervals=$INTERVALS"

if [ "$USERS" -eq 0 ] && [ "$DEVICES" -eq 0 ]; then
  echo "[restore-test] WARN: nulové počty – záloha může být prázdná" >&2
  exit 2
fi

echo "[restore-test] OK – záloha je obnovitelná"
