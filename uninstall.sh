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

echo "Uninstalling dotfile symlinks"
for name in *; do
  target="$HOME/.$name"
  if [ -e "$target" ]; then
    if [ ! -L "$target" ]; then
      echo "WARNING: $target exists but is not a symbolic link"
    else
      echo "Removing $target"
      rm "$target"
    fi
  fi
done

echo "Uninstalling vcprompt"
rm bin/vcprompt 2>/dev/null
rm -rf tmp 2>/dev/null

echo "Uninstalling vim-plug"
rm -rf vim/autoload 2>/dev/null
rm -rf vim/plugged 2>/dev/null
