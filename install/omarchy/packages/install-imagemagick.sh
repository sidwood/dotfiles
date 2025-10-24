#!/bin/bash
set -e

PACKAGE="magick"

if command -v "$PACKAGE" &>/dev/null; then
    echo "imagemagick is already installed"
    exit 0
fi

omarchy-pkg-add imagemagick
echo "imagemagick installed successfully"
