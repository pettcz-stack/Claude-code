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
rm -rf "$BUILD_DIR" && mkdir -p "$PAYLOAD_DIR/Library/Application Support/FOCUS"
mkdir -p "$PAYLOAD_DIR/Library/LaunchAgents"

cp .build/apple/Products/Release/focus-agent "$PAYLOAD_DIR/Library/Application Support/FOCUS/focus-agent"
chmod 755 "$PAYLOAD_DIR/Library/Application Support/FOCUS/focus-agent"

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
