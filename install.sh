#!/usr/bin/env bash

#
# Constants
#

VCPROMPT_VERSION=712d7740f135

#
# Exit with given message
#

abort() {
  printf "\n \033[31mError: $@\033[0m\n\n" && exit 1
}

#
# Ensure dependencies are installed
#

make -v >/dev/null 2>&1 || abort 'GNU Make required'
wget --help >/dev/null 2>&1 || abort 'wget required'

#
# Symlink dotfiles to home directory
#

echo "Symlinking dotfiles to home directory"
for name in *; do
  target="$HOME/.$name"
  if [ -e "$target" ]; then
    if [ ! -L "$target" ]; then
      echo "WARNING: $target exists but is not a symbolic link"
    fi
  else
    skip=(README.md bash install.sh tmp uninstall.sh zsh)
    if [[ ! ${skip[*]} =~ "$name" ]]; then
      echo "Creating $target"
      ln -s "$PWD/$name" "$target"
    fi
  fi
done

#
# Install vcprompt
#

echo "Installing vcprompt"
if [[ ! -x "bin/vcprompt" ]]; then
  echo "Downloading vcprompt source"
  rm bin/vcprompt 2>/dev/null
  rm -rf tmp 2>/dev/null
  mkdir tmp 2>/dev/null
  cd tmp
  wget \
    -O vcprompt.tar.gz \
    http://hg.gerg.ca/vcprompt/archive/$VCPROMPT_VERSION.tar.gz
  tar -xzf vcprompt.tar.gz
  cd -
  echo "Building vcprompt from source"
  cd tmp/vcprompt-$VCPROMPT_VERSION
  make
  mv vcprompt ../../bin
  cd -
  echo "Cleaning up"
  rm -rf tmp
  echo "vcprompt installed"
else
  echo "vcprompt already installed"
fi
