#!/usr/bin/env bash

echo "Symlinking dotfiles to home directory"
for name in *; do
  target="$HOME/.$name"
  if [ -e "$target" ]; then
    if [ ! -L "$target" ]; then
      echo "WARNING: $target exists but is not a symbolic link"
    fi
  else
    skip=(bash install.sh README.md uninstall.sh)
    if [[ ! ${skip[*]} =~ "$name" ]]; then
      echo "Creating $target"
      ln -s "$PWD/$name" "$target"
    fi
  fi
done
