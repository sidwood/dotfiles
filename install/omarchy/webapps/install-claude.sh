#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ICON_DIR="$HOME/.local/share/applications/icons"

mkdir -p "$ICON_DIR"
cp "$SCRIPT_DIR/icons/claude.png" "$ICON_DIR/Claude.png"

omarchy-webapp-install "Claude" "https://claude.ai" "Claude.png"
echo "Claude webapp installed successfully"
