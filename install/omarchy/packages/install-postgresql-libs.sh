#!/bin/bash
set -e

PACKAGE="postgresql-libs"

if command -v pg_config &>/dev/null; then
    echo "$PACKAGE is already installed"
    exit 0
fi

omarchy-pkg-add "$PACKAGE"
echo "$PACKAGE installed successfully"
