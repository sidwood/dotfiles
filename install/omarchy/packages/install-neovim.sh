#!/bin/bash
set -e

PACKAGE="nvim"

if command -v "$PACKAGE" &>/dev/null; then
    echo "neovim is already installed"
    exit 0
fi

omarchy-pkg-add neovim
echo "neovim installed successfully"
