#!/usr/bin/env bash

#
# Change CWD to the dotfiles repository root
#

cd "$(dirname "$0")" || { printf "\n \033[31mError: Failed to change to script directory\033[0m\n\n"; exit 1; }

#
# Exit with given message
#

abort() {
  printf "\n \033[31mError: %s\033[0m\n\n" "$*" && exit 1
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

options+=("Install Homebrew packages and applications.")
option_keys+=("homebrew")
options+=("Apply macOS system defaults.")
option_keys+=("macos")
options+=("Symlink dotfile packages with GNU Stow.")
option_keys+=("stow")
options+=("Set up mise with default runtimes.")
option_keys+=("mise")
if [[ "$(uname -m)" == "arm64" ]]; then
  options+=("Set up MLX for Apple silicon.")
  option_keys+=("mlx")
fi
options+=("Install global pnpm packages.")
option_keys+=("pnpm_globals")
options+=("Install vim plugins.")
option_keys+=("vim")
for i in "${!options[@]}"; do
  selected[i]=true
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
        selected[cursor]=false
      else
        selected[cursor]=true
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
  backup_config "$HOME/.config/tmux/tmux.conf" "$PWD/tmux/.config/tmux/tmux.conf" "tmux config"
  backup_config "$HOME/.config/herdr/config.toml" "$PWD/herdr/.config/herdr/config.toml" "herdr config"
  backup_config "$HOME/.config/opencode/opencode.jsonc" "$PWD/opencode/.config/opencode/opencode.jsonc" "OpenCode config"
  backup_config "$HOME/.config/zed/settings.json" "$PWD/zed/.config/zed/settings.json" "zed settings"
  backup_config "$HOME/.config/zed/keymap.json" "$PWD/zed/.config/zed/keymap.json" "zed keymap"

  # Cursor uses ~/Library/Application Support/ (not XDG-compliant), so it is
  # skipped by Stow and linked by hand below.
  local cursor_user_path="$HOME/Library/Application Support/Cursor/User"

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
    [[ "$pkg" == "macos/" || "$pkg" == "alfred/" || "$pkg" == "cursor/" ]] && continue
    stow -v -t "$HOME" "${pkg%/}"
  done

  echo "Symlinking Cursor settings"
  mkdir -p "$cursor_user_path/snippets"
  ln -sf "$PWD/cursor/.config/Cursor/User/settings.json" "$cursor_user_path/settings.json"
  ln -sf "$PWD/cursor/.config/Cursor/User/keybindings.json" "$cursor_user_path/keybindings.json"
  for snippet in "$PWD/cursor/.config/Cursor/User/snippets/"*.json; do
    [[ -f "$snippet" ]] && ln -sf "$snippet" "$cursor_user_path/snippets/$(basename "$snippet")"
  done

  # Depends on the agents package having just been stowed
  link_agent_memory

  # Herdr owns this generated plugin, so install the version bundled with the
  # Herdr binary on each machine rather than stowing a potentially stale copy.
  install_herdr_integrations
}

link_agent_memory() {
  local canonical="$HOME/.config/agents/AGENTS.md"

  if [[ ! -e "$canonical" ]]; then
    echo "Skipping agent memory links (agents package not stowed)"
    return 0
  fi

  # <command>|<global instructions path>. Every harness reads a different
  # filename in a different place, so rather than keep a copy per tool we keep
  # one file and point them all at it. Add a harness by adding a line.
  #
  # Paths verified against the tools themselves: codex (binary references
  # ~/.codex/AGENTS.md), grok (its shipped docs/user-guide), opencode (config
  # root ~/.config/opencode), pi (global context lives in agentDir, default
  # ~/.pi/agent). claude and gemini follow each vendor's documented path.
  # Cursor's home-level rules are .mdc files in ~/.cursor/rules/. The shared
  # file carries no alwaysApply frontmatter, so enable the rule in Cursor.
  #
  # Deliberately absent: kimi. It only reads AGENTS.md from the working
  # directory — global support is an open, unimplemented request
  # (MoonshotAI/kimi-cli#2152). Add "kimi|$HOME/.kimi/AGENTS.md" when it lands.
  local harnesses=(
    "claude|$HOME/.claude/CLAUDE.md"
    "codex|$HOME/.codex/AGENTS.md"
    "grok|$HOME/.grok/AGENTS.md"
    "opencode|$HOME/.config/opencode/AGENTS.md"
    "cursor|$HOME/.cursor/rules/global-agent-memory.mdc"
    "gemini|$HOME/.gemini/GEMINI.md"
    "pi|$HOME/.pi/agent/AGENTS.md"
  )

  echo "Linking global agent memory"
  local entry cmd target
  for entry in "${harnesses[@]}"; do
    cmd="${entry%%|*}"
    target="${entry#*|}"

    # Only touch harnesses that are actually here, so $HOME does not collect
    # config directories for tools that were never installed.
    if ! command -v "$cmd" >/dev/null 2>&1 && [[ ! -d "$(dirname "$target")" ]]; then
      continue
    fi

    if [[ -L "$target" ]]; then
      [[ "$(readlink "$target")" == "$canonical" ]] && continue
    elif [[ -e "$target" ]]; then
      echo "  Backing up existing ${target##*/} to ${target}.bak"
      mv "$target" "${target}.bak"
    fi

    mkdir -p "$(dirname "$target")"
    ln -sfn "$canonical" "$target"
    echo "  ${cmd} -> ~/${target#"$HOME"/}"
  done
}

install_herdr_integrations() {
  if ! command -v herdr >/dev/null 2>&1; then
    echo "Skipping Herdr integrations (Herdr not installed)"
    return 0
  fi

  if ! command -v opencode >/dev/null 2>&1; then
    echo "Skipping Herdr OpenCode integration (OpenCode not installed)"
    return 0
  fi

  echo "Installing Herdr OpenCode integration"
  herdr integration install opencode
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

  echo "Installing pnpm..."
  mise use --global pnpm@latest

  echo "Installing Flutter..."
  mise use --global flutter@latest

  # Activate so subsequent steps in this process can find node/npm
  eval "$(mise activate bash)"

  echo "Mise setup complete. Installed versions:"
  mise list
}

setup_mlx() {
  local setup_script="$PWD/bin/.local/bin/mlx-setup"

  [[ -x "$setup_script" ]] || abort "MLX setup script missing or not executable: $setup_script"
  "$setup_script"
}

setup_pnpm_globals() {
  command -v op >/dev/null 2>&1 || abort '1Password CLI required (install Homebrew packages first)'

  # Ensure mise-managed tools are on PATH even if mise step was skipped this run
  if command -v mise >/dev/null 2>&1; then
    eval "$(mise activate bash)" 2>/dev/null || true
  fi
  command -v pnpm >/dev/null 2>&1 || abort 'pnpm required (install mise runtimes first)'

  # pnpm refuses to install globally unless its bin directory ($PNPM_HOME/bin,
  # not $PNPM_HOME) exists and is on PATH. .profile exports this too, but a
  # first run may not have sourced it yet.
  export PNPM_HOME="${XDG_DATA_HOME:-$HOME/.local/share}/pnpm"
  mkdir -p "$PNPM_HOME/bin"
  case ":$PATH:" in
    *":$PNPM_HOME/bin:"*) ;;
    *) export PATH="$PNPM_HOME/bin:$PATH" ;;
  esac

  # GitHub Packages auth comes from stowed npmrc + GITHUB_REGISTRY_TOKEN.
  # pnpm reads it via NPM_CONFIG_USERCONFIG, same as npm.
  if [[ ! -f "$HOME/.config/npm/npmrc" ]]; then
    abort 'npm config missing (~/.config/npm/npmrc). Select "Symlink dotfile packages with GNU Stow" first.'
  fi

  local template_path="$PWD/shell/.config/shell/local.env.tpl"
  if [[ ! -f "$template_path" ]]; then
    abort "Missing 1Password env template: $template_path"
  fi

  # @google/gemini-cli and firecrawl-cli are installed with pnpm rather than
  # Homebrew: gemini's brew formula is deprecated upstream, lags several minor
  # versions, and is disabled from 2026-12-18; firecrawl-cli has no brew formula.
  local global_packages=(
    @sidwood/timecraft
    @google/gemini-cli
    defuddle
    firecrawl-cli
  )

  echo "Installing global packages with pnpm..."
  # --env-file resolves op:// refs for this subprocess only (works on first run
  # even when local.env has not been sourced into the parent shell)
  if ! op run --env-file="$template_path" -- pnpm add -g "${global_packages[@]}"; then
    abort 'Failed to install global packages (check 1Password CLI auth and GitHub Registry Token)'
  fi

  # Binaries the packages above expose
  local cmd
  for cmd in tc gemini defuddle firecrawl; do
    if command -v "$cmd" >/dev/null 2>&1; then
      echo "Installed $cmd -> $(command -v "$cmd")"
    else
      printf "\033[33mWarning: %s installed but not on PATH in this session\033[0m\n" "$cmd"
    fi
  done

  # gemini may have just appeared, so its global memory link can now be made
  link_agent_memory
}

setup_repo_hooks() {
  echo "Enabling repository git hooks"
  git config core.hooksPath .githooks
}

setup_local_shell_env() {
  local template_path="$PWD/shell/.config/shell/local.env.tpl"
  local target_path="$HOME/.config/shell/local.env"
  local tmp_path

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

  if op inject -i "$template_path" > "$tmp_path"; then
    mv "$tmp_path" "$target_path"
    chmod 600 "$target_path"
    # Load into this install process for any later steps that need the vars
    set -a
    # shellcheck disable=SC1090
    source "$target_path"
    set +a
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
fi

if is_selected "macos"; then
  apply_macos_defaults
fi

if is_selected "stow"; then
  stow_dotfiles
fi

setup_local_shell_env
setup_repo_hooks

if is_selected "mise"; then
  setup_mise
fi

if is_selected "mlx"; then
  setup_mlx
fi

if is_selected "pnpm_globals"; then
  setup_pnpm_globals
fi

if is_selected "vim"; then
  install_vim_plugins
fi

if is_selected "homebrew"; then
  print_1password_reminder
fi

printf "\n\033[32mInstallation complete!\033[0m\n"
