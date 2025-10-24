#!/bin/bash
set -e

PACKAGE="difft"

if command -v "$PACKAGE" &>/dev/null; then
    echo "difftastic is already installed"
    exit 0
fi

omarchy-pkg-add difftastic
echo "difftastic installed successfully"
