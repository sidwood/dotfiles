#!/usr/bin/env bash

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
