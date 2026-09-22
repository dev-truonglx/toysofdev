#!/usr/bin/env bash
#
# Cross-build the Windows NSIS installer inside a Linux container — fully local,
# no GitHub Actions and no Windows machine. Use this because the macOS Homebrew
# `makensis` is broken on Apple Silicon; NSIS works correctly on Linux.
#
# Prerequisites: Docker Desktop running.
#
# Usage:
#   scripts/build-win-docker.sh            # builds current version
# Output (host):  dist-win/Toys of Dev_<ver>_x64-setup.exe (+ .sig if signed)
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE="toysofdev-wincross"
KEYFILE="$HOME/.tauri/toysofdev-updater.key"

command -v docker >/dev/null || { echo "ERROR: docker not installed"; exit 1; }
docker info >/dev/null 2>&1   || { echo "ERROR: Docker daemon not running — start Docker Desktop and retry."; exit 1; }

# Load private key if available
if [ -f "$KEYFILE" ]; then
  export TAURI_SIGNING_PRIVATE_KEY="$(cat "$KEYFILE")"
  export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}"
fi

# Build the toolchain image once (cached afterwards).
echo "==> Building cross image (first run downloads the toolchain; cached after)"
docker build -t "$IMAGE" -f scripts/win-cross.Dockerfile scripts/

mkdir -p dist-win

# Copy the working tree into the container (excluding host-arch artifacts), build,
# and copy the installer back out. The host node_modules/target are never touched.
echo "==> Cross-building Windows NSIS installer in container"
docker run --rm \
  -v "$PWD":/src:ro \
  -v "$PWD/dist-win":/out \
  -e TAURI_SIGNING_PRIVATE_KEY="${TAURI_SIGNING_PRIVATE_KEY:-}" \
  -e TAURI_SIGNING_PRIVATE_KEY_PASSWORD="${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}" \
  "$IMAGE" bash -lc '
    set -e
    rsync -a --exclude target --exclude node_modules --exclude .git --exclude dist --exclude dist-win /src/ /app/
    cd /app
    npm ci
    npm run tauri build -- --runner cargo-xwin --target x86_64-pc-windows-msvc --bundles nsis
    cp src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*-setup.exe /out/
    cp src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*-setup.exe.sig /out/ 2>/dev/null || true
  '

echo
echo "==> Done. Artifacts in dist-win/:"
ls -lh dist-win/
