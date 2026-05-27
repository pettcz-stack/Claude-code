#!/bin/bash
# FOCUS macOS agent — smoke test
# Ověří, že agent je nainstalovaný, běží, posílá data a má potřebné permissions.
#
# Použití:
#   ./Scripts/smoke-test-macos.sh
#
# Vrací exit code 0 pokud vše OK, 1 jinak.

set -u

FOCUS_DIR="/Library/Application Support/FOCUS"
PLIST="/Library/LaunchAgents/com.sinsu.focusagent.plist"
BIN="$FOCUS_DIR/focus-agent"
CONFIG="$FOCUS_DIR/config.plist"
LOG="$FOCUS_DIR/agent.log"

PASS=0
FAIL=0

ok()    { echo "  ✅ $1"; PASS=$((PASS+1)); }
fail()  { echo "  ❌ $1"; FAIL=$((FAIL+1)); }
warn()  { echo "  ⚠  $1"; }
section() { echo ""; echo "▸ $1"; }

section "1. Soubory na disku"
[ -f "$BIN" ]     && ok "binárka: $BIN"      || fail "chybí binárka: $BIN"
[ -f "$CONFIG" ]  && ok "config: $CONFIG"    || fail "chybí config: $CONFIG (vytvoř ho podle README)"
[ -f "$PLIST" ]   && ok "launchd plist: $PLIST" || fail "chybí launchd plist: $PLIST"

section "2. Binárka — architektury (universal arm64 + x86_64)"
if [ -f "$BIN" ]; then
    ARCHS=$(lipo -archs "$BIN" 2>/dev/null || file "$BIN")
    echo "$ARCHS" | grep -q "arm64" && ok "obsahuje arm64" || fail "arm64 chybí"
    echo "$ARCHS" | grep -q "x86_64" && ok "obsahuje x86_64" || warn "x86_64 chybí (Apple Silicon-only build)"
fi

section "3. LaunchAgent — běží?"
UID_REAL=$(id -u)
if launchctl print "gui/$UID_REAL/com.sinsu.focusagent" >/dev/null 2>&1; then
    ok "launchctl service načten"
    PID=$(launchctl print "gui/$UID_REAL/com.sinsu.focusagent" 2>/dev/null | grep -E '^\s*pid' | head -1 | awk '{print $3}')
    if [ -n "${PID:-}" ] && [ "$PID" != "0" ]; then
        ok "proces běží (PID $PID)"
    else
        fail "service načten, ale proces neběží (zkontroluj launchd-err.log)"
    fi
else
    fail "launchctl service NENÍ načten"
    warn "spusť: launchctl bootstrap \"gui/$UID_REAL\" $PLIST"
fi

PIDS=$(pgrep -f "focus-agent" || true)
if [ -n "$PIDS" ]; then
    ok "pgrep našel focus-agent (PID: $PIDS)"
else
    fail "pgrep nevidí žádný focus-agent proces"
fi

section "4. Konfigurace"
if [ -f "$CONFIG" ]; then
    BACKEND_URL=$(/usr/libexec/PlistBuddy -c "Print :BackendUrl" "$CONFIG" 2>/dev/null || echo "")
    TOKEN=$(/usr/libexec/PlistBuddy -c "Print :IngestToken" "$CONFIG" 2>/dev/null || echo "")
    if [ -n "$BACKEND_URL" ]; then
        ok "BackendUrl: $BACKEND_URL"
        echo "$BACKEND_URL" | grep -qE '^https://' && ok "HTTPS schéma" || fail "BackendUrl musí být HTTPS"
    else
        fail "BackendUrl nevyplněn"
    fi
    if [ -n "$TOKEN" ] && [ "$TOKEN" != "__SET_BY_MDM_OR_INSTALL__" ]; then
        ok "IngestToken nastaven (${#TOKEN} znaků)"
    else
        fail "IngestToken nevyplněn"
    fi
fi

section "5. Backend dosažitelný?"
if [ -n "${BACKEND_URL:-}" ]; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$BACKEND_URL/api/v1/health" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        ok "GET $BACKEND_URL/api/v1/health → 200"
    else
        fail "GET $BACKEND_URL/api/v1/health → $HTTP_CODE (cert? firewall? VPN?)"
    fi
fi

section "6. Permissions (TCC)"
warn "TCC stav se z CLI nedá spolehlivě číst — zkontroluj ručně:"
warn "  System Settings → Privacy & Security → Accessibility   → focus-agent ✓"
warn "  System Settings → Privacy & Security → Input Monitoring → focus-agent ✓"
warn "  (Full Disk Access jen pokud TrackPrint nebo TrackUsb)"

section "7. Log agenta — posledních 10 řádků"
if [ -f "$LOG" ]; then
    AGE=$(( $(date +%s) - $(stat -f %m "$LOG" 2>/dev/null || echo 0) ))
    if [ "$AGE" -lt 300 ]; then
        ok "log byl zapsán před $AGE s (agent aktivní)"
    else
        warn "log nezapsán $AGE s (agent možná stojí)"
    fi
    echo "---"
    tail -10 "$LOG" | sed 's/^/    /'
    echo "---"
else
    fail "log neexistuje: $LOG"
fi

section "8. Device token (vytvoří se po prvním enrollmentu)"
TOKEN_FILE="$FOCUS_DIR/device-token"
if [ -f "$TOKEN_FILE" ]; then
    ok "per-device token existuje (enrollment proběhl)"
else
    warn "device-token zatím není (počkej 1–2 min na první enrollment)"
fi

echo ""
echo "═════════════════════════════════════════"
echo "  Výsledek: $PASS OK, $FAIL chyb"
echo "═════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
    echo ""
    echo "Tip: pokud agent neběží, zkus:"
    echo "  tail -f \"$FOCUS_DIR/launchd-err.log\""
    echo "  sudo launchctl bootout \"gui/$UID_REAL/com.sinsu.focusagent\" 2>/dev/null"
    echo "  sudo launchctl bootstrap \"gui/$UID_REAL\" \"$PLIST\""
    exit 1
fi

echo ""
echo "Vše vypadá OK. V dashboardu by se mělo zařízení objevit do 2 minut."
exit 0
