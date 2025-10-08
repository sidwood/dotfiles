#!/usr/bin/env bash

#
# Uninstall Homebrew packages (optional, prompts user)
#

if [[ "$OSTYPE" == "darwin"* ]] && [ -f "$PWD/Brewfile" ]; then
  read -p "Uninstall Homebrew packages from Brewfile? [y/N] " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Uninstalling Homebrew packages"
    brew bundle cleanup --file="$PWD/Brewfile" --force
  fi
fi

echo "Unstowing dotfiles packages"
for pkg in */; do
  stow -Dv "${pkg%/}"
done

echo "Uninstalling vcprompt"
rm "$HOME/.bin/vcprompt" 2>/dev/null
rm -rf tmp 2>/dev/null

echo "Uninstalling vim-plug"
rm -rf "$HOME/.vim/autoload" 2>/dev/null
rm -rf "$HOME/.vim/plugged" 2>/dev/null
