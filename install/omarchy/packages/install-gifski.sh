#!/bin/bash
set -e

PACKAGE="gifski"

if command -v "$PACKAGE" &>/dev/null; then
    echo "$PACKAGE is already installed"
    exit 0
fi

omarchy-pkg-aur-add "$PACKAGE"
echo "$PACKAGE installed successfully"
