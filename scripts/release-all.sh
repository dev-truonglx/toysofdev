#!/usr/bin/env bash
#
# ONE-SHOT LOCAL RELEASE FOR TOYS OF DEV
# Builds macOS (Universal: Apple Silicon + Intel) + Windows (via Docker)
# Generates unified updater manifest (latest.json) and deploys to GitHub Releases.
#
# Usage:
#   scripts/release-all.sh v1.0.0
#
# Prerequisites:
#   • gh auth login (account with push access to dev-truonglx/toysofdev)
#   • Docker Desktop running
#   • Updater key at ~/.tauri/toysofdev-updater.key
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/.."

RELEASES_REPO="dev-truonglx/toysofdev"
TAG="${1:?usage: scripts/release-all.sh vX.Y.Z}"
VERSION="${TAG#v}"
KEYFILE="$HOME/.tauri/toysofdev-updater.key"

# ── Prerequisites ─────────────────────────────────────────────────────────────
command -v gh >/dev/null     || { echo "ERROR: gh not installed (brew install gh)"; exit 1; }
command -v node >/dev/null   || { echo "ERROR: node not found"; exit 1; }
command -v docker >/dev/null || { echo "ERROR: docker not installed"; exit 1; }
command -v rustup >/dev/null || { echo "ERROR: rustup not found"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "ERROR: not logged in — run: gh auth login"; exit 1; }
docker info >/dev/null 2>&1     || { echo "ERROR: Docker daemon not running — start Docker Desktop."; exit 1; }
[ -f "$KEYFILE" ]               || { echo "ERROR: updater signing key missing at $KEYFILE"; exit 1; }
echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$' || { echo "ERROR: tag must be semver, e.g. v0.1.1"; exit 1; }

export TAURI_SIGNING_PRIVATE_KEY="$(cat "$KEYFILE")"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}"

# ── 1) Sync version into all three manifests ──────────────────────────────────
echo "==> [1/6] Setting version to $VERSION"
VERSION="$VERSION" node -e '
  const fs = require("fs");
  const v = process.env.VERSION;
  
  // 1. tauri.conf.json
  const cf = "src-tauri/tauri.conf.json";
  const j = JSON.parse(fs.readFileSync(cf, "utf8"));
  j.version = v;
  fs.writeFileSync(cf, JSON.stringify(j, null, 2) + "\n");
  
  // 2. package.json
  const pf = "package.json";
  const p = JSON.parse(fs.readFileSync(pf, "utf8"));
  p.version = v;
  fs.writeFileSync(pf, JSON.stringify(p, null, 2) + "\n");
  
  // 3. Cargo.toml
  let c = fs.readFileSync("src-tauri/Cargo.toml", "utf8");
  c = c.replace(/^version = "[^"]*"/m, "version = \"" + v + "\"");
  fs.writeFileSync("src-tauri/Cargo.toml", c);
'

# ── 2) macOS universal (native build) ─────────────────────────────────────────
echo "==> [2/6] Building macOS universal bundle (Intel + Apple Silicon)"
rustup target add aarch64-apple-darwin x86_64-apple-darwin >/dev/null 2>&1 || true
npm ci
npm run tauri build -- --target universal-apple-darwin --ignore-version-mismatches

# ── 3) Windows installer (Docker cross-build) ─────────────────────────────────
echo "==> [3/6] Building Windows installer in Docker"
rm -rf dist-win && mkdir -p dist-win
bash scripts/build-win-docker.sh

# ── 4) Collect release artifacts into release_dist/ ───────────────────────────
echo "==> [4/6] Collecting artifacts"
rm -rf release_dist && mkdir -p release_dist

DMG_SRC="$(find src-tauri/target/universal-apple-darwin/release/bundle/dmg -name "*${VERSION}*.dmg" | head -n 1)"
[ -z "$DMG_SRC" ] && DMG_SRC="$(find src-tauri/target/universal-apple-darwin/release/bundle/dmg -name "*.dmg" | head -n 1)"
MAC_TGZ_SRC="$(find src-tauri/target/universal-apple-darwin/release/bundle/macos -name "*.app.tar.gz" | head -n 1)"
MAC_SIG_SRC="$(find src-tauri/target/universal-apple-darwin/release/bundle/macos -name "*.app.tar.gz.sig" | head -n 1)"

EXE_SRC="$(find dist-win -name "*${VERSION}*-setup.exe" | head -n 1)"
EXE_SIG_SRC="$(find dist-win -name "*${VERSION}*-setup.exe.sig" | head -n 1)"

[ -n "$DMG_SRC" ] && [ -f "$DMG_SRC" ] || { echo "ERROR: macOS DMG not found."; exit 1; }
[ -n "$MAC_TGZ_SRC" ] && [ -f "$MAC_TGZ_SRC" ] || { echo "ERROR: macOS updater tar.gz not found."; exit 1; }
[ -n "$MAC_SIG_SRC" ] && [ -f "$MAC_SIG_SRC" ] || { echo "ERROR: macOS updater tar.gz.sig not found."; exit 1; }
[ -n "$EXE_SRC" ] && [ -f "$EXE_SRC" ] || { echo "ERROR: Windows EXE installer for version ${VERSION} not found in dist-win/."; exit 1; }
[ -n "$EXE_SIG_SRC" ] && [ -f "$EXE_SIG_SRC" ] || { echo "ERROR: Windows installer .sig for version ${VERSION} not found in dist-win/."; exit 1; }

cp "$DMG_SRC" "release_dist/Toys.of.Dev_${VERSION}_universal.dmg"
cp "$MAC_TGZ_SRC" "release_dist/Toys.of.Dev.app.tar.gz"
cp "$EXE_SRC" "release_dist/Toys.of.Dev_${VERSION}_x64-setup.exe"

# ── 5) Generate latest.json manifest for Tauri In-App Auto-Updater ─────────────
echo "==> [5/6] Generating latest.json manifest"
BASE="https://github.com/${RELEASES_REPO}/releases/download/${TAG}"
VERSION="$VERSION" BASE="$BASE" MAC_SIG="$MAC_SIG_SRC" EXE_SIG="$EXE_SIG_SRC" node -e '
  const fs = require("fs");
  const macSig = fs.readFileSync(process.env.MAC_SIG, "utf8").trim();
  const winSig = fs.readFileSync(process.env.EXE_SIG, "utf8").trim();
  
  const mac = {
    signature: macSig,
    url: `${process.env.BASE}/Toys.of.Dev.app.tar.gz`
  };
  const win = {
    signature: winSig,
    url: `${process.env.BASE}/Toys.of.Dev_${process.env.VERSION}_x64-setup.exe`
  };

  const manifest = {
    version: process.env.VERSION,
    notes: `Release v${process.env.VERSION} of Toys of Dev.`,
    pub_date: new Date().toISOString(),
    platforms: {
      "darwin-aarch64": mac,
      "darwin-x86_64": mac,
      "windows-x86_64": win
    }
  };

  fs.writeFileSync("release_dist/latest.json", JSON.stringify(manifest, null, 2));
  console.log("manifest created for platforms:", Object.keys(manifest.platforms).join(", "));
'

echo "Artifacts ready in release_dist/:"
ls -lh release_dist/

# ── 6) Create the draft release and upload assets ─────────────────────────────
echo "==> [6/6] Creating draft release and uploading assets to $RELEASES_REPO"
if ! gh release view "$TAG" --repo "$RELEASES_REPO" >/dev/null 2>&1; then
  gh release create "$TAG" --repo "$RELEASES_REPO" --draft \
    --title "Toys of Dev $TAG" \
    --notes "Release $TAG for Toys of Dev."
fi

gh release upload "$TAG" --repo "$RELEASES_REPO" --clobber \
  "release_dist/Toys.of.Dev_${VERSION}_universal.dmg" \
  "release_dist/Toys.of.Dev.app.tar.gz" \
  "release_dist/Toys.of.Dev_${VERSION}_x64-setup.exe" \
  "release_dist/latest.json"

echo
echo "============================================================"
echo " DONE. Review and PUBLISH the draft release on GitHub:"
echo "   https://github.com/${RELEASES_REPO}/releases"
echo "============================================================"
