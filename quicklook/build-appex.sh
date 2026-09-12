#!/usr/bin/env bash
#
# Builds MDHeroQuickLook.appex, the macOS Quick Look preview extension.
#
# It must run BEFORE `tauri build`, because Tauri copies the finished .appex into
# the app bundle and then seals it inside the app's signature. Tauri does not
# sign what it copies — `copy_custom_files_to_bundle` runs after the bundler has
# already collected its list of signing targets — so the extension is signed
# here, and an unsigned one would fail `codesign --verify --deep` and
# notarization.
#
#   APPLE_SIGNING_IDENTITY   signing identity; defaults to "-" (ad-hoc, local use)
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/quicklook/build"
APPEX="$OUT/MDHeroQuickLook.appex"
IDENTITY="${APPLE_SIGNING_IDENTITY:--}"

VERSION="$(node -p "require('$ROOT/package.json').version")"

echo "==> Building the renderer bundle"
node "$ROOT/scripts/build-quicklook.mjs"

echo "==> Compiling the extension (universal)"
rm -rf "$OUT"
mkdir -p "$APPEX/Contents/MacOS" "$APPEX/Contents/Resources"

# An app extension has no main(); its entry point is NSExtensionMain, which
# Xcode supplies via the same linker flag.
for arch in arm64 x86_64; do
  swiftc -target "${arch}-apple-macos11" \
    -emit-executable \
    -Xlinker -e -Xlinker _NSExtensionMain \
    -O \
    -o "$OUT/MDHeroQuickLook-$arch" \
    "$ROOT/quicklook/Preview.swift"
done
lipo -create -output "$APPEX/Contents/MacOS/MDHeroQuickLook" \
  "$OUT/MDHeroQuickLook-arm64" "$OUT/MDHeroQuickLook-x86_64"
rm -f "$OUT/MDHeroQuickLook-arm64" "$OUT/MDHeroQuickLook-x86_64"

echo "==> Assembling the bundle"
sed "s/__VERSION__/$VERSION/g" "$ROOT/quicklook/Info.plist" > "$APPEX/Contents/Info.plist"
cp "$ROOT/build-quicklook/preview.html" "$APPEX/Contents/Resources/preview.html"
plutil -lint "$APPEX/Contents/Info.plist" > /dev/null

echo "==> Signing with identity: $IDENTITY"
codesign --force --sign "$IDENTITY" \
  --options runtime \
  --entitlements "$ROOT/quicklook/MDHeroQuickLook.entitlements" \
  "$APPEX"
codesign --verify --deep --strict "$APPEX"

echo "==> Built $APPEX ($(du -sh "$APPEX" | cut -f1))"
