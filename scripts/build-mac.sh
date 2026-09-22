#!/usr/bin/env bash
#
# Build macOS application bundle & DMG for Toys of Dev.
#
# Usage:
#   scripts/build-mac.sh                  # builds for host architecture
#   scripts/build-mac.sh --universal      # builds universal binary (Apple Silicon + Intel)
#   scripts/build-mac.sh [extra tauri build args]
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Building Toys of Dev for macOS..."

if [ "${1:-}" = "--universal" ]; then
  shift
  echo "==> Building Universal binary (aarch64 + x86_64)..."
  rustup target add aarch64-apple-darwin x86_64-apple-darwin >/dev/null 2>&1 || true
  npm run tauri build -- --target universal-apple-darwin "$@"
else
  npm run tauri build -- "$@"
fi

echo "==> Build finished successfully."
