#!/bin/bash
set -e

PACKAGE="zed"

if command -v "$PACKAGE" &>/dev/null; then
    echo "zed is already installed"
    exit 0
fi

omarchy-pkg-add zed
echo "zed installed successfully"
