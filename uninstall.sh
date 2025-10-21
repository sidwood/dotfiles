#!/usr/bin/env bash

#
# Change CWD to the dotfiles repository root
#

cd "$(dirname "$0")" || { printf "\n \033[31mError: Failed to change to script directory\033[0m\n\n"; exit 1; }

#
# Platform detection
#

is_macos() { [[ "$OSTYPE" == "darwin"* ]]; }
is_omarchy() { [[ -d "$HOME/.local/share/omarchy" ]]; }

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

if is_macos; then
  options+=("Uninstall Homebrew packages and applications.")
  option_keys+=("homebrew")
  options+=("Reset macOS system defaults.")
  option_keys+=("macos")
elif is_omarchy; then
  options+=("Uninstall Arch packages (pacman + AUR).")
  option_keys+=("arch")
fi
options+=("Remove dotfile package symlinks with GNU Stow.")
option_keys+=("stow")
options+=("Uninstall vim plugins.")
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
  printf '\033[%dA\r' "$1"
}

print_menu() {
  local i
  for i in "${!options[@]}"; do
    printf '\033[2K'
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
  printf "\n\033[1mSelect uninstallations\033[0m (↑/↓/k/j navigate, Space toggle, Enter confirm):\n\n"
  hide_cursor
  print_menu
  while true; do
    IFS= read -rsn1 key
    if [[ "$key" == $'\e' ]]; then
      IFS= read -rsn1 key
      if [[ "$key" == "[" ]]; then
        IFS= read -rsn1 key
        case "$key" in
          A) ((cursor > 0)) && ((cursor--)) ;;
          B) ((cursor < menu_lines - 1)) && ((cursor++)) ;;
        esac
      fi
    elif [[ "$key" == 'k' ]]; then
      ((cursor > 0)) && ((cursor--))
    elif [[ "$key" == 'j' ]]; then
      ((cursor < menu_lines - 1)) && ((cursor++))
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
# Uninstallation functions
#

uninstall_homebrew() {
  if [ -f "$PWD/Brewfile" ]; then
    echo "Uninstalling Homebrew packages"
    brew bundle cleanup --file="$PWD/Brewfile" --force
  fi
}

uninstall_arch_packages() {
  echo "Uninstalling Arch packages..."

  # AUR packages
  local aur_pkgs=(gifski heroku-cli)
  for pkg in "${aur_pkgs[@]}"; do
    if pacman -Q "$pkg" &>/dev/null; then
      yay -Rns --noconfirm "$pkg" 2>/dev/null || true
    fi
  done

  # Official packages (only those we explicitly installed)
  local official_pkgs=(zsh tmux stow aws-cli-v2 azure-cli cmatrix difftastic ffmpeg git-filter-repo make tree yazi)
  for pkg in "${official_pkgs[@]}"; do
    if pacman -Q "$pkg" &>/dev/null; then
      sudo pacman -Rns --noconfirm "$pkg" 2>/dev/null || true
    fi
  done
}

reset_macos_defaults() {
  if [ -f "$PWD/macos/defaults.sh" ]; then
    echo "Resetting macOS system defaults"
    bash "$PWD/macos/defaults.sh" reset
    echo "Note: Log out and back in for changes to take effect"
  fi
}

uninstall_dotfiles() {
  echo "Removing dotfile package symlinks"
  for pkg in */; do
    [[ "$pkg" == "macos/" || "$pkg" == "alfred/" ]] && continue
    # Skip bash on Omarchy (it manages ~/.bashrc)
    is_omarchy && [[ "$pkg" == "bash/" ]] && continue
    stow -Dv "${pkg%/}"
  done
}

uninstall_vim_plugins() {
  echo "Uninstalling vim-plug"
  rm -rf "$HOME/.config/vim/autoload" 2>/dev/null
  rm -rf "$HOME/.config/vim/plugged" 2>/dev/null
}

#
# Main
#

show_menu

if is_selected "homebrew"; then
  uninstall_homebrew
fi

if is_selected "arch"; then
  uninstall_arch_packages
fi

if is_selected "macos"; then
  reset_macos_defaults
fi

if is_selected "stow"; then
  uninstall_dotfiles
fi

if is_selected "vim"; then
  uninstall_vim_plugins
fi

printf "\n\033[32mUninstallation complete!\033[0m\n"
