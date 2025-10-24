#!/bin/bash
set -e

PACKAGE="cmatrix"

if command -v "$PACKAGE" &>/dev/null; then
    echo "$PACKAGE is already installed"
    exit 0
fi

omarchy-pkg-add "$PACKAGE"
echo "$PACKAGE installed successfully"
