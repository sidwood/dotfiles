#!/bin/bash
set -e

PACKAGE="7z"

if command -v "$PACKAGE" &>/dev/null; then
    echo "7zip is already installed"
    exit 0
fi

omarchy-pkg-add p7zip
echo "7zip installed successfully"
