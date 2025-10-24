#!/bin/bash
set -e

PACKAGE="aws"

if command -v "$PACKAGE" &>/dev/null; then
    echo "aws-cli is already installed"
    exit 0
fi

omarchy-pkg-add aws-cli-v2
echo "aws-cli installed successfully"
