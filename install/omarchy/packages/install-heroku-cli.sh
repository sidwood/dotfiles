#!/bin/bash
set -e

if pacman -Q heroku-cli-bin &>/dev/null; then
  yay -Rns --noconfirm heroku-cli-bin
fi

installer="$(mktemp)"
trap 'rm -f "$installer"' EXIT

curl -fsSL https://cli-assets.heroku.com/install.sh -o "$installer"
bash "$installer"

echo "heroku-cli installed successfully"
