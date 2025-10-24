#!/bin/bash
set -e

PACKAGE="rg"

if command -v "$PACKAGE" &>/dev/null; then
    echo "ripgrep is already installed"
    exit 0
fi

omarchy-pkg-add ripgrep
echo "ripgrep installed successfully"
