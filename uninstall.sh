#!/usr/bin/env bash

#
# Change CWD to the dotfiles repository root
#

cd "$(dirname "$0")" || { printf "\n \033[31mError: Failed to change to script directory\033[0m\n\n"; exit 1; }

#
# Platform detection
#

is_macos() { [[ "$OSTYPE" == "darwin"* ]]; }

abort() {
  printf "\n \033[31mError: %s\033[0m\n\n" "$*" && exit 1
}

is_macos || abort 'These dotfiles are for macOS only'

#
# Menu state
#

cursor=0
options=()
selected=()
option_keys=()

#
# Build menu options
#

options+=("Uninstall Homebrew packages and applications.")
option_keys+=("homebrew")
options+=("Reset macOS system defaults.")
option_keys+=("macos")
options+=("Remove dotfile package symlinks with GNU Stow.")
option_keys+=("stow")
options+=("Uninstall DeepSeek Harness (keep settings and sessions).")
option_keys+=("deepseek_harness")
options+=("Uninstall Atomic (keep settings and sessions).")
option_keys+=("atomic")
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

reset_macos_defaults() {
  if [ -f "$PWD/macos/defaults.sh" ]; then
    echo "Resetting macOS system defaults"
    bash "$PWD/macos/defaults.sh" reset
    echo "Note: Log out and back in for changes to take effect"
  fi
}

uninstall_dotfiles() {
  local local_profile="${XDG_CONFIG_HOME:-$HOME/.config}/opencode/opencode.json"
  if [[ -L "$local_profile" && "$(readlink "$local_profile")" == "lmstudio.json" ]]; then
    rm "$local_profile"
  fi
  echo "Removing dotfile package symlinks"
  for pkg in */; do
    [[ "$pkg" == "macos/" || "$pkg" == "alfred/" || "$pkg" == "cursor/" ]] && continue
    stow -Dv -t "$HOME" "${pkg%/}"
  done
}

uninstall_herdr_integrations() {
  local plugin_path="$HOME/.config/opencode/plugins/herdr-agent-state.js"

  if command -v herdr >/dev/null 2>&1; then
    echo "Removing Herdr OpenCode integration"
    herdr integration uninstall opencode
  elif [[ -f "$plugin_path" ]]; then
    echo "Removing generated Herdr OpenCode integration"
    rm -f "$plugin_path"
  fi
}

uninstall_deepseek_harness() {
  local runtime="${XDG_DATA_HOME:-$HOME/.local/share}/deepseek-harness"
  local launcher="$HOME/.local/bin/dsh"
  local memory="${DSH_HOME:-$HOME/.dsh}/AGENTS.md"

  if [[ -e "$runtime" || -L "$runtime" ]]; then
    [[ ! -L "$runtime" && -f "$runtime/package.json" ]] &&
      grep -Fqx '  "name": "dotfiles-deepseek-harness-runtime",' "$runtime/package.json" || abort "Preserving unrecognised runtime at $runtime"
    rm -rf "$runtime" || abort 'Could not remove DeepSeek Harness runtime'
  fi
  if [[ -L "$launcher" && "$(readlink "$launcher")" == "$runtime/node_modules/.bin/dsh" ]]; then
    rm "$launcher" || abort 'Could not remove dsh link'
  fi
  if [[ -L "$memory" && "$(readlink "$memory")" == "$HOME/.config/agents/AGENTS.md" ]]; then
    rm "$memory" || abort 'Could not remove DeepSeek Harness memory link'
  fi
  echo "DeepSeek Harness removed; settings, credentials and sessions remain in ${DSH_HOME:-$HOME/.dsh}"
}

uninstall_atomic() {
  local runtime="${XDG_DATA_HOME:-$HOME/.local/share}/atomic"
  local launcher="$HOME/.local/bin/atomic"
  local agent_dir="${ATOMIC_CODING_AGENT_DIR:-${PI_CODING_AGENT_DIR:-$HOME/.atomic/agent}}"
  local memory="$agent_dir/AGENTS.md"

  if [[ -e "$runtime" || -L "$runtime" ]]; then
    [[ ! -L "$runtime" && -f "$runtime/package.json" ]] &&
      grep -Fqx '  "name": "dotfiles-atomic-runtime",' "$runtime/package.json" || abort "Preserving unrecognised runtime at $runtime"
    rm -rf "$runtime" || abort 'Could not remove Atomic runtime'
  fi
  if [[ -L "$launcher" && "$(readlink "$launcher")" == "$runtime/node_modules/.bin/atomic" ]]; then
    rm "$launcher" || abort 'Could not remove atomic link'
  fi
  if [[ -L "$memory" && "$(readlink "$memory")" == "$HOME/.config/agents/AGENTS.md" ]]; then
    rm "$memory" || abort 'Could not remove Atomic memory link'
  fi
  echo "Atomic removed; settings, credentials and sessions remain in $agent_dir"
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

if is_selected "atomic"; then
  uninstall_atomic
fi

if is_selected "deepseek_harness"; then
  uninstall_deepseek_harness
fi

if is_selected "stow"; then
  # Remove generated integrations while Herdr is still available; Homebrew
  # cleanup may uninstall the command in the next step.
  uninstall_herdr_integrations
fi

if is_selected "homebrew"; then
  uninstall_homebrew
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
