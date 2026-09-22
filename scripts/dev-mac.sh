#!/usr/bin/env bash
#
# Helper script to launch Toys of Dev in development mode.
# Usage:
#   scripts/dev-mac.sh           # Runs `npm run tauri dev` (with HMR)
#   scripts/dev-mac.sh --bundle  # Builds and opens a local debug .app bundle
set -euo pipefail
cd "$(dirname "$0")/.."

if [ "${1:-}" = "--bundle" ]; then
  echo "==> Building local debug .app bundle..."
  npm run tauri build -- --debug --bundles app
  APP="src-tauri/target/debug/bundle/macos/Toys of Dev.app"
  if [ -d "$APP" ]; then
    echo "==> Launching $APP..."
    open "$APP"
  else
    echo "ERROR: Debug app bundle not found at $APP"
    exit 1
  fi
else
  echo "==> Starting Toys of Dev development server..."
  npm run tauri dev
fi
