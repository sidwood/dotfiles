#!/usr/bin/env bash

#
# Constants
#

VCPROMPT_VERSION=6d758d5f8d44

#
# Exit with given message
#

abort() {
  printf "\n \033[31mError: $@\033[0m\n\n" && exit 1
}

#
# Ensure dependencies are installed
#

command -v curl >/dev/null 2>&1 || abort 'curl required'
command -v git >/dev/null 2>&1 || abort 'git required'
command -v make >/dev/null 2>&1 || abort 'GNU Make required'

#
# Install Homebrew packages (macOS only)
#

if [[ "$OSTYPE" == "darwin"* ]]; then
  echo "Checking for Homebrew"
  if ! command -v brew >/dev/null 2>&1; then
    echo "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    eval "$(/opt/homebrew/bin/brew shellenv)"
  fi

  if [ -f "$PWD/Brewfile" ]; then
    echo "Installing Homebrew packages from Brewfile"
    brew bundle --file="$PWD/Brewfile"
  fi
fi

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
  curl \
    -o vcprompt.tar.gz \
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

#
# Install vim plugins
#

if [[ ! -d ~/.vim/autoload/plug.vim ]]; then
  echo "Installing vim-plug"
  curl -fLo ~/.vim/autoload/plug.vim --create-dirs \
    https://raw.githubusercontent.com/junegunn/vim-plug/master/plug.vim
fi

echo "Running :PlugInstall"
vim +PlugInstall +qall
