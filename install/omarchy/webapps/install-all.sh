#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Installing Omarchy webapps..."

bash "$SCRIPT_DIR/install-claude.sh"

echo "All Omarchy webapps installed successfully"
