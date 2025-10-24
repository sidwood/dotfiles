#!/bin/bash
set -e

PACKAGE="pdftoppm"

if command -v "$PACKAGE" &>/dev/null; then
    echo "poppler is already installed"
    exit 0
fi

omarchy-pkg-add poppler
echo "poppler installed successfully"
