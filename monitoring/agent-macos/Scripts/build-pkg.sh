#!/bin/bash
# FOCUS macOS agent – build .pkg installeru.
# Spouštět NA MAC OS (nikoli na Linuxu) s nainstalovaným Xcode / command-line tools.
#
# Použití:
#   cd monitoring/agent-macos
#   ./Scripts/build-pkg.sh
#
# Výstup: focus-agent-macos.pkg v aktuálním adresáři.
#
# Pro podepsaný .pkg (vyžadováno macOS Gatekeeper pro běžnou distribuci):
#   PRODUCT_SIGN_ID="Developer ID Installer: Sinsu Platform s.r.o. (XXXXXXXXXX)" ./Scripts/build-pkg.sh
#   xcrun notarytool submit focus-agent-macos.pkg --keychain-profile "AC_PASSWORD" --wait
#   xcrun stapler staple focus-agent-macos.pkg

set -e
cd "$(dirname "$0")/.."

VERSION="0.9.1"
BUILD_DIR="$(pwd)/build"
PAYLOAD_DIR="$BUILD_DIR/payload"

echo "🍎 FOCUS macOS agent – build v$VERSION"

# 1) Swift build pro Apple Silicon i Intel (universal binary)
echo "→ swift build (universal arm64 + x86_64)"
swift build -c release --arch arm64 --arch x86_64

# 2) Stage payload
rm -rf "$BUILD_DIR"
APP_DIR="$PAYLOAD_DIR/Library/Application Support/FOCUS/FocusAgent.app"
mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$PAYLOAD_DIR/Library/LaunchAgents"

# .app bundle struktura – stabilní CFBundleIdentifier pro TCC, viz CI workflow.
cp .build/apple/Products/Release/focus-agent "$APP_DIR/Contents/MacOS/focus-agent"
cp Resources/Info.plist "$APP_DIR/Contents/Info.plist"
chmod 755 "$APP_DIR/Contents/MacOS/focus-agent"

# Ad-hoc codesign celého bundlu – identifikátor pak = CFBundleIdentifier.
codesign --sign - --force --deep --identifier com.sinsu.focusagent "$APP_DIR" || true

# Složka musí být user-writable (1777) – agent běží jako user a launchd sem
# musí umět zapsat stdout/stderr i agent.log. Postinstall to ještě potvrdí.
chmod 1777 "$PAYLOAD_DIR/Library/Application Support/FOCUS"

cp Resources/com.sinsu.focusagent.plist "$PAYLOAD_DIR/Library/LaunchAgents/com.sinsu.focusagent.plist"
chmod 644 "$PAYLOAD_DIR/Library/LaunchAgents/com.sinsu.focusagent.plist"

# 3) Postinstall scripts
mkdir -p "$BUILD_DIR/scripts"
cp Scripts/postinstall "$BUILD_DIR/scripts/postinstall"
chmod 755 "$BUILD_DIR/scripts/postinstall"

# 4) pkgbuild
PKG_NAME="focus-agent-macos.pkg"
SIGN_ARGS=""
if [ -n "$PRODUCT_SIGN_ID" ]; then
    SIGN_ARGS="--sign $PRODUCT_SIGN_ID"
fi

pkgbuild \
    --root "$PAYLOAD_DIR" \
    --identifier "com.sinsu.focusagent" \
    --version "$VERSION" \
    --scripts "$BUILD_DIR/scripts" \
    --install-location "/" \
    $SIGN_ARGS \
    "$PKG_NAME"

echo "✅ Hotovo: $PKG_NAME"
ls -la "$PKG_NAME"
