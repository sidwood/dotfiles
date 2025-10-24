#!/bin/bash
set -e

PACKAGE="az"

if command -v "$PACKAGE" &>/dev/null; then
    echo "azure-cli is already installed"
    exit 0
fi

omarchy-pkg-add azure-cli
echo "azure-cli installed successfully"
