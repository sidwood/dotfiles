#!/usr/bin/env bash

#
# Change CWD to the dotfiles repository root
#

cd "$(dirname "$0")" || { printf "\n \033[31mError: Failed to change to script directory\033[0m\n\n"; exit 1; }

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
  options+=("Install Homebrew packages and applications.")
  option_keys+=("homebrew")
  options+=("Apply macOS system defaults.")
  option_keys+=("macos")
elif is_omarchy; then
  options+=("Install Omarchy packages (pacman + AUR).")
  option_keys+=("omarchy")
fi
options+=("Symlink dotfile packages with GNU Stow.")
option_keys+=("stow")
options+=("Set up mise with default runtimes.")
option_keys+=("mise")
options+=("Install global npm packages.")
option_keys+=("npm_globals")
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
  printf "\n\033[1mSelect installations\033[0m (↑/↓/k/j navigate, Space toggle, Enter confirm):\n\n"
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
# Installation functions
#

install_homebrew() {
  echo "Checking for Homebrew"
  if ! command -v brew >/dev/null 2>&1; then
    echo "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    eval "$(/opt/homebrew/bin/brew shellenv)"
    brew install mas >/dev/null 2>&1 # mac app store cli tool
  fi

  if [ -f "$PWD/Brewfile" ]; then
    echo "Updating Homebrew"
    brew update
    echo "Installing Homebrew packages from Brewfile"
    brew bundle --file="$PWD/Brewfile"
  fi
}

install_omarchy_packages() {
  bash "$PWD/install/omarchy/packages/install-all.sh"
}

apply_macos_defaults() {
  if [ -f "$PWD/macos/defaults.sh" ]; then
    echo "Applying macOS system defaults"
    bash "$PWD/macos/defaults.sh" apply
    echo "Note: Log out and back in for modifier key changes to take effect"
  fi
}

backup_config() {
  local target_path="$1"
  local expected_source="$2"
  local config_name="$3"

  if [[ -e "$target_path" && ! -L "$target_path" ]]; then
    local real_path
    real_path="$(cd "$(dirname "$target_path")" && pwd -P)/$(basename "$target_path")"
    if [[ "$real_path" != "$expected_source" ]]; then
      echo "Backing up existing ${config_name} to ${target_path}.bak"
      mv "$target_path" "${target_path}.bak"
    fi
  fi
}

stow_dotfiles() {
  command -v stow >/dev/null 2>&1 || abort 'GNU Stow required'

  backup_config "$HOME/.config/ghostty/config" "$PWD/ghostty/.config/ghostty/config" "ghostty config"
  backup_config "$HOME/.config/git/config" "$PWD/git/.config/git/config" "git config"
  backup_config "$HOME/.config/zed/settings.json" "$PWD/zed/.config/zed/settings.json" "zed settings"
  backup_config "$HOME/.config/zed/keymap.json" "$PWD/zed/.config/zed/keymap.json" "zed keymap"

  # Cursor settings backup (path differs by platform)
  local cursor_user_path
  if is_macos; then
    cursor_user_path="$HOME/Library/Application Support/Cursor/User"
  else
    cursor_user_path="$HOME/.config/Cursor/User"
  fi

  backup_config "$cursor_user_path/settings.json" "$PWD/cursor/.config/Cursor/User/settings.json" "Cursor settings"
  backup_config "$cursor_user_path/keybindings.json" "$PWD/cursor/.config/Cursor/User/keybindings.json" "Cursor keybindings"

  # Backup Cursor snippets if they exist
  for snippet in javascript.json javascriptreact.json typescript.json; do
    if [[ -f "$cursor_user_path/snippets/$snippet" ]]; then
      backup_config "$cursor_user_path/snippets/$snippet" "$PWD/cursor/.config/Cursor/User/snippets/$snippet" "Cursor snippet $snippet"
    fi
  done

  echo "Symlinking dotfile packages"
  for pkg in */; do
    [[ "$pkg" == "macos/" || "$pkg" == "alfred/" || "$pkg" == "install/" ]] && continue
    # Skip bash on Omarchy (it manages ~/.bashrc)
    is_omarchy && [[ "$pkg" == "bash/" ]] && continue
    # Skip cursor on macOS (handled separately below due to non-XDG path)
    is_macos && [[ "$pkg" == "cursor/" ]] && continue
    stow -v -t "$HOME" "${pkg%/}"
  done

  # macOS: Cursor uses ~/Library/Application Support/ (not XDG-compliant)
  # We manually symlink instead of using stow
  if is_macos; then
    echo "Symlinking Cursor settings for macOS"
    mkdir -p "$cursor_user_path/snippets"
    ln -sf "$PWD/cursor/.config/Cursor/User/settings.json" "$cursor_user_path/settings.json"
    ln -sf "$PWD/cursor/.config/Cursor/User/keybindings.json" "$cursor_user_path/keybindings.json"
    for snippet in "$PWD/cursor/.config/Cursor/User/snippets/"*.json; do
      [[ -f "$snippet" ]] && ln -sf "$snippet" "$cursor_user_path/snippets/$(basename "$snippet")"
    done
  fi
}

install_vim_plugins() {
  if [[ ! -f ~/.config/vim/autoload/plug.vim ]]; then
    echo "Installing vim-plug"
    curl -fLo ~/.config/vim/autoload/plug.vim --create-dirs \
      https://raw.githubusercontent.com/junegunn/vim-plug/master/plug.vim
  fi

  echo "Running :PlugInstall"
  vim +PlugInstall +qall
}

setup_mise() {
  command -v mise >/dev/null 2>&1 || abort 'mise required (install Homebrew packages first)'

  echo "Setting up mise runtimes"

  # Trust mise to run hooks (global settings, no specific config file)
  mise settings set experimental true 2>/dev/null || true

  # Install latest LTS/stable versions globally
  echo "Installing Node.js LTS..."
  mise use --global node@lts

  echo "Installing Python..."
  mise use --global python@latest

  echo "Installing Ruby..."
  mise use --global ruby@latest

  echo "Mise setup complete. Installed versions:"
  mise list
}

setup_npm_globals() {
  command -v npm >/dev/null 2>&1 || abort 'npm required (install mise runtimes first)'
  command -v op >/dev/null 2>&1 || abort '1Password CLI required (install Homebrew packages first)'

  echo "Installing global npm packages..."
  op run -- npm install -g @sidwood/timecraft
}

setup_local_shell_env() {
  local template_path="$PWD/shell/.config/shell/local.env.tpl"
  local target_path="$HOME/.config/shell/local.env"
  local tmp_path
  local -a template_vars
  local var_line

  if [[ ! -f "$template_path" ]]; then
    echo "Skipping local shell env setup (template not found)"
    return 0
  fi

  if ! command -v op >/dev/null 2>&1; then
    echo "Skipping local shell env setup (1Password CLI not installed)"
    return 0
  fi

  echo "Generating local shell env from 1Password template"
  mkdir -p "$(dirname "$target_path")"
  tmp_path="$(mktemp)"
  while IFS= read -r var_line; do
    template_vars+=("$var_line")
  done < <(awk '/^export [A-Za-z_][A-Za-z0-9_]*=/{sub(/^export /, ""); sub(/=.*/, ""); print}' "$template_path")

  if [[ ${#template_vars[@]} -eq 0 ]]; then
    rm -f "$tmp_path"
    echo "Skipping local shell env setup (no export variables found in template)"
    return 0
  fi

  if op run --env-file="$template_path" -- bash -c '
for name in "$@"; do
  value="${!name}"
  printf "export %s=%q\n" "$name" "$value"
done
' _ "${template_vars[@]}" > "$tmp_path"; then
    mv "$tmp_path" "$target_path"
    chmod 600 "$target_path"
    echo "Wrote $target_path"
  else
    rm -f "$tmp_path"
    echo "Skipping local shell env setup (could not resolve 1Password secrets)"
  fi
}

print_1password_reminder() {
  printf "\n\033[33m1Password manual setup required:\033[0m\n"
  printf "  1. Open 1Password → Settings → Developer\n"
  printf "  2. Enable 'Integrate with 1Password CLI'\n"
  printf "  3. Enable 'Use the SSH Agent'\n"
}

#
# Main
#

show_menu

if is_selected "homebrew"; then
  install_homebrew
  print_1password_reminder
fi

if is_selected "omarchy"; then
  install_omarchy_packages
fi

if is_selected "macos"; then
  apply_macos_defaults
fi

if is_selected "stow"; then
  stow_dotfiles
fi

setup_local_shell_env

if is_selected "mise"; then
  setup_mise
fi

if is_selected "npm_globals"; then
  setup_npm_globals
fi

if is_selected "vim"; then
  install_vim_plugins
fi

printf "\n\033[32mInstallation complete!\033[0m\n"
