#!/bin/bash
# FOCUS macOS agent – one-shot installer.
# Stáhne nejnovější .pkg z GitHub Releases, vyčistí staré stopy, nainstaluje,
# otevře System Settings na správných panelech a počká, až povolíš oba
# permissiony. Pak restartne a ověří, že úhozy se počítají.
#
# Použití (přímo z internetu):
#   curl -fsSL https://raw.githubusercontent.com/pettcz-stack/claude-code/claude/employee-monitoring-app-LPmRD/monitoring/agent-macos/Scripts/install-mac.sh | bash
#
# Nebo lokálně:
#   ./Scripts/install-mac.sh

set -e

RELEASE_URL="https://github.com/pettcz-stack/claude-code/releases/download/agent-latest/focus-agent-macos.pkg"
PKG_PATH="/tmp/focus-agent-macos.pkg"
FOCUS_DIR="/Library/Application Support/FOCUS"
PLIST="/Library/LaunchAgents/com.sinsu.focusagent.plist"
BIN="$FOCUS_DIR/focus-agent"
LOG="$FOCUS_DIR/agent.log"
UID_REAL=$(id -u)

# Hezké barvy
B=$'\033[1m'; G=$'\033[32m'; Y=$'\033[33m'; R=$'\033[31m'; C=$'\033[36m'; N=$'\033[0m'
ok()    { echo "${G}✓${N} $1"; }
warn()  { echo "${Y}⚠${N} $1"; }
fail()  { echo "${R}✗${N} $1"; }
step()  { echo ""; echo "${B}${C}▸ $1${N}"; }
ask()   { echo ""; echo "${B}${Y}? $1${N}"; }

echo "${B}FOCUS macOS agent – instalátor${N}"
echo "═══════════════════════════════════════════════"

if [ "$(uname -s)" != "Darwin" ]; then
    fail "Tento skript je jen pro macOS."
    exit 1
fi

# ──────────────────────────────────────────────────────────────────────────
step "1/7  Zjišťuji stav stávající instalace"
# ──────────────────────────────────────────────────────────────────────────
if [ -f "$BIN" ]; then
    OLD_BUILD=$(strings "$BIN" 2>/dev/null | grep -oE "build [0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z]+" | head -1 || echo "neznámý")
    warn "Stávající instalace: $OLD_BUILD"
else
    ok "Žádná stávající instalace nenalezena."
fi

# ──────────────────────────────────────────────────────────────────────────
step "2/7  Zastavuji běžící agent"
# ──────────────────────────────────────────────────────────────────────────
launchctl bootout "gui/$UID_REAL/com.sinsu.focusagent" 2>/dev/null || true
sudo killall -9 focus-agent 2>/dev/null || true
sleep 1
if pgrep -f focus-agent >/dev/null 2>&1; then
    fail "Nepodařilo se ukončit běžící focus-agent. Restartni Mac a zkus znovu."
    exit 1
fi
ok "Agent zastaven."

# ──────────────────────────────────────────────────────────────────────────
step "3/7  Stahuji nejnovější .pkg z GitHub Releases"
# ──────────────────────────────────────────────────────────────────────────
rm -f "$PKG_PATH"
if ! curl -fsSL -o "$PKG_PATH" "$RELEASE_URL"; then
    fail "Stahování selhalo. Zkontroluj internet a $RELEASE_URL."
    exit 1
fi
PKG_SIZE=$(stat -f %z "$PKG_PATH")
ok "Staženo: $PKG_PATH ($(( PKG_SIZE / 1024 )) KB)"

# ──────────────────────────────────────────────────────────────────────────
step "4/7  Ověřuji obsah .pkg před instalací"
# ──────────────────────────────────────────────────────────────────────────
TMP_EXTRACT=$(mktemp -d)
trap "rm -rf $TMP_EXTRACT" EXIT
pkgutil --expand-full "$PKG_PATH" "$TMP_EXTRACT/pkg" 2>/dev/null
NEW_BIN=$(find "$TMP_EXTRACT/pkg" -name "focus-agent" -type f | head -1)
if [ -z "$NEW_BIN" ]; then
    fail "V .pkg jsem nenašel binárku focus-agent. Možná je build v releasu pokažený."
    exit 1
fi
NEW_BUILD=$(strings "$NEW_BIN" 2>/dev/null | grep -oE "build [0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z]+" | head -1 || echo "starý-build")
ok "Nová binárka: $NEW_BUILD"
ARCHS=$(lipo -archs "$NEW_BIN" 2>/dev/null || file "$NEW_BIN")
echo "  Architektury: $ARCHS"

# ──────────────────────────────────────────────────────────────────────────
step "5/7  Instaluji"
# ──────────────────────────────────────────────────────────────────────────
xattr -d com.apple.quarantine "$PKG_PATH" 2>/dev/null || true
if ! sudo installer -pkg "$PKG_PATH" -target / >/tmp/focus-installer.log 2>&1; then
    fail "Instalátor selhal:"
    cat /tmp/focus-installer.log
    exit 1
fi
ok "Nainstalováno."

INSTALLED_BUILD=$(strings "$BIN" 2>/dev/null | grep -oE "build [0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z]+" | head -1 || echo "")
if [ "$INSTALLED_BUILD" != "$NEW_BUILD" ]; then
    warn "Instalovaná binárka má $INSTALLED_BUILD, čekal $NEW_BUILD. Možná disk-cache, restartuj Mac."
fi

# ──────────────────────────────────────────────────────────────────────────
step "6/7  Spouštím agenta – vyvolá dialog pro Input Monitoring"
# ──────────────────────────────────────────────────────────────────────────
# Bootstrap (a ne kickstart -k) – ze suspend stavu se může vyžadovat fresh start.
launchctl bootstrap "gui/$UID_REAL" "$PLIST" 2>/dev/null || \
    launchctl kickstart -k "gui/$UID_REAL/com.sinsu.focusagent"
sleep 4

if ! pgrep -f focus-agent >/dev/null 2>&1; then
    fail "Agent se nespustil. Mrkni do /Library/Application Support/FOCUS/launchd-err.log."
    tail -10 "$FOCUS_DIR/launchd-err.log" 2>/dev/null || true
    exit 1
fi
ok "Agent běží (PID: $(pgrep -f focus-agent | head -1))."

# ──────────────────────────────────────────────────────────────────────────
step "7/7  Otevírám System Settings pro povolení permissions"
# ──────────────────────────────────────────────────────────────────────────
cat <<EOT

V dalších dvou krocích musíš ${B}ručně${N} povolit dvě věci v System Settings.
Bez nich agent neuvidí klávesy, kliky ani titulky oken.

${B}1) INPUT MONITORING${N} – pro počítání úhozů a kliků
${B}2) ACCESSIBILITY${N}    – pro čtení titulků aktivního okna (top weby)

Pro každou:
  – pokud focus-agent ${B}je${N} v seznamu, klikni na něj a zapni TOGGLE napravo
  – pokud focus-agent ${B}není${N} v seznamu, klikni "+", stiskni Cmd+Shift+G,
    napiš:  /Library/Application Support/FOCUS/
    vyber focus-agent, klikni Open, toggle bude ON

EOT
ask "Stiskni Enter, otevřu Input Monitoring panel."
read -r _ < /dev/tty || true
open "x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent"

ask "Až povolíš Input Monitoring, stiskni Enter – otevřu Accessibility panel."
read -r _ < /dev/tty || true
open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"

ask "Až povolíš Accessibility, stiskni Enter – restartnu agenta a ověřím."
read -r _ < /dev/tty || true

# ──────────────────────────────────────────────────────────────────────────
echo ""
echo "${B}═══ Restart agenta + ověření ═══${N}"
# ──────────────────────────────────────────────────────────────────────────
launchctl kickstart -k "gui/$UID_REAL/com.sinsu.focusagent" 2>/dev/null || true
sleep 5

echo ""
echo "Posledních 12 řádků logu:"
echo "────────────────────────────────────────────────"
tail -12 "$LOG"
echo "────────────────────────────────────────────────"
echo ""

INPUT_OK=$(grep -c "Input Monitoring je povolen" "$LOG" 2>/dev/null || echo 0)
INPUT_DENIED=$(grep -c "Input Monitoring je ODMÍTNUT" "$LOG" 2>/dev/null || echo 0)
ACCESS_DENIED=$(grep -c "Accessibility není povoleno" "$LOG" 2>/dev/null || echo 0)

# Bereme jen poslední startup
LAST_STARTUP_LINE=$(grep -n "FOCUS agent macOS .* startup" "$LOG" | tail -1 | cut -d: -f1)
if [ -n "$LAST_STARTUP_LINE" ]; then
    LAST_BLOCK=$(tail -n +"$LAST_STARTUP_LINE" "$LOG")
    LAST_INPUT_OK=$(echo "$LAST_BLOCK" | grep -c "Input Monitoring je povolen" || true)
    LAST_INPUT_DENIED=$(echo "$LAST_BLOCK" | grep -c "Input Monitoring je ODMÍTNUT" || true)
    LAST_ACCESS_DENIED=$(echo "$LAST_BLOCK" | grep -c "Accessibility není povoleno" || true)
else
    LAST_INPUT_OK=0; LAST_INPUT_DENIED=1; LAST_ACCESS_DENIED=1
fi

echo "${B}Výsledek:${N}"
if [ "$LAST_INPUT_OK" -gt 0 ]; then
    ok "Input Monitoring: ${G}POVOLEN${N} – úhozy a kliky se budou počítat"
elif [ "$LAST_INPUT_DENIED" -gt 0 ]; then
    fail "Input Monitoring: ${R}ODMÍTNUT${N} – v System Settings je toggle vypnutý nebo TCC databáze má stará data"
    echo "  → Smaž focus-agent ze seznamu Input Monitoring (vybrat + tlačítko '-')"
    echo "  → Pak zavři System Settings (Cmd+Q) a spusť tenhle script znovu."
else
    warn "Input Monitoring: neznámý stav (žádná diagnostika v logu)"
fi

if [ "$LAST_ACCESS_DENIED" -eq 0 ]; then
    ok "Accessibility: ${G}POVOLEN${N} – titulky oken (top weby) budou fungovat"
else
    fail "Accessibility: ${R}není povoleno${N} – v Settings → Privacy → Accessibility přidej focus-agent"
fi

echo ""
echo "${B}Hotovo.${N} Backend dashboard: ${C}http://localhost:8080${N}"
echo "Live tail logu:  ${C}tail -f \"$LOG\"${N}"
echo ""
exit 0
