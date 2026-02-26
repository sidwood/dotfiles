#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

failed=()

run() {
  if ! bash "$SCRIPT_DIR/$1"; then
    failed+=("$1")
  fi
}

echo "Installing Omarchy packages..."

# Shell fundamentals
run install-zsh.sh
run install-tmux.sh
run install-stow.sh

# Development tools
run install-biome.sh
run install-difftastic.sh
run install-git-filter-repo.sh
run install-make.sh
run install-postgresql-libs.sh
run install-shellcheck.sh
run install-tree.sh

# Cloud CLIs
run install-aws-cli.sh
run install-azure-cli.sh
run install-codex.sh
run install-gh.sh
run install-heroku-cli.sh

# Shell enhancements
run install-bat.sh
run install-eza.sh
run install-fd.sh
run install-fzf.sh
run install-ripgrep.sh
run install-zoxide.sh

# TUI applications
run install-claude-code.sh
run install-btop.sh
run install-htop.sh
run install-neovim.sh
run install-lazygit.sh
run install-lazydocker.sh

# GUI applications
run install-cursor.sh
run install-zed.sh

# Environment tools
run install-fastfetch.sh
run install-direnv.sh

# Media and utilities
run install-ffmpeg.sh
run install-cmatrix.sh
run install-jq.sh

# File manager and preview dependencies
run install-yazi.sh
run install-poppler.sh
run install-imagemagick.sh
run install-resvg.sh
run install-7zip.sh
run install-gifski.sh

if [[ ${#failed[@]} -gt 0 ]]; then
  printf "\n\033[31mThe following packages failed to install:\033[0m\n"
  for f in "${failed[@]}"; do
    printf "  - %s\n" "${f#install-}"
  done
  exit 1
fi

echo "All Omarchy packages installed successfully"
