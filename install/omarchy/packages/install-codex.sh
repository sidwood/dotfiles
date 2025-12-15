#!/bin/bash
set -e

PACKAGE="codex"

if command -v "$PACKAGE" &>/dev/null; then
    echo "$PACKAGE is already installed"
    exit 0
fi

omarchy-pkg-add openai-codex
echo "openai-codex installed successfully"
