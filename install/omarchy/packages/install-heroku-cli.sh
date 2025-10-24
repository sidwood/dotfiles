#!/bin/bash
set -e

PACKAGE="heroku"

if command -v "$PACKAGE" &>/dev/null; then
    echo "heroku-cli is already installed"
    exit 0
fi

omarchy-pkg-aur-add heroku-cli
echo "heroku-cli installed successfully"
