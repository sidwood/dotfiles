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
# Menu state
#

cursor=0
options=()
selected=()
option_keys=()

#
# Build menu options based on OS
#

if [[ "$OSTYPE" == "darwin"* ]]; then
  options+=("Install Homebrew packages and applications.")
  option_keys+=("homebrew")
fi
options+=("Symlink dotfile packages with GNU Stow.")
option_keys+=("stow")
options+=("Build and install vcprompt.")
option_keys+=("vcprompt")
options+=("Install vim plugins.")
option_keys+=("vim")
for i in "${!options[@]}"; do
  selected[$i]=true
done

#
# Menu helper functions
#

hide_cursor() {
  tput civis 2>/dev/null || printf '\033[?25l'
}

show_cursor() {
  tput cnorm 2>/dev/null || printf '\033[?25h'
}

move_up() {
  printf '\033[%dA' "$1"
}

clear_line() {
  printf '\033[2K'
}

print_menu() {
  local i
  for i in "${!options[@]}"; do
    clear_line
    if [[ $i -eq $cursor ]]; then
      printf "\033[36m> \033[0m"
    else
      printf "  "
    fi

    if [[ "${selected[$i]}" == "true" ]]; then
      printf "\033[32m[x]\033[0m "
    else
      printf "[ ] "
    fi

    printf "%s\n" "${options[$i]}"
  done
}

show_menu() {
  local key
  local menu_lines=${#options[@]}
  printf "\n\033[1mSelect installations\033[0m (↑/↓ navigate, Space toggle, Enter confirm):\n\n"
  hide_cursor
  print_menu
  while true; do
    IFS= read -rsn1 key
    if [[ "$key" == $'\x1b' ]]; then
      read -rsn2 -t 0.1 key
      case "$key" in
        '[A') # up arrow
          ((cursor > 0)) && ((cursor--))
          ;;
        '[B') # down arrow
          ((cursor < menu_lines - 1)) && ((cursor++))
          ;;
      esac
    elif [[ "$key" == ' ' ]]; then
      if [[ "${selected[$cursor]}" == "true" ]]; then
        selected[$cursor]=false
      else
        selected[$cursor]=true
      fi
    elif [[ "$key" == '' ]]; then
      break
    fi
    move_up "$menu_lines"
    print_menu
  done
  show_cursor
  printf "\n"
}

is_selected() {
  local key="$1"
  local i
  for i in "${!option_keys[@]}"; do
    if [[ "${option_keys[$i]}" == "$key" ]]; then
      [[ "${selected[$i]}" == "true" ]] && return 0 || return 1
    fi
  done
  return 1
}

#
# Installation functions
#

install_homebrew() {
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
}

stow_dotfiles() {
  command -v stow >/dev/null 2>&1 || abort 'GNU Stow required'
  echo "Stowing dotfiles packages"
  for pkg in */; do
    stow -v "${pkg%/}"
  done
}

install_vcprompt() {
  echo "Installing vcprompt"
  if [[ ! -x "$HOME/.bin/vcprompt" ]]; then
    echo "Downloading vcprompt source"
    rm "$HOME/.bin/vcprompt" 2>/dev/null
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
    mv vcprompt "$HOME/.bin/"
    cd -
    echo "Cleaning up"
    rm -rf tmp
    echo "vcprompt installed"
  else
    echo "vcprompt already installed"
  fi
}

install_vim_plugins() {
  if [[ ! -d ~/.vim/autoload/plug.vim ]]; then
    echo "Installing vim-plug"
    curl -fLo ~/.vim/autoload/plug.vim --create-dirs \
      https://raw.githubusercontent.com/junegunn/vim-plug/master/plug.vim
  fi

  echo "Running :PlugInstall"
  vim +PlugInstall +qall
}

#
# Main
#

show_menu

if is_selected "homebrew"; then
  install_homebrew
fi

if is_selected "stow"; then
  stow_dotfiles
fi

if is_selected "vcprompt"; then
  install_vcprompt
fi

if is_selected "vim"; then
  install_vim_plugins
fi

printf "\n\033[32mInstallation complete!\033[0m\n"
