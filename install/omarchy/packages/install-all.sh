#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Installing Omarchy packages..."

# Shell fundamentals
bash "$SCRIPT_DIR/install-zsh.sh"
bash "$SCRIPT_DIR/install-tmux.sh"
bash "$SCRIPT_DIR/install-stow.sh"

# Development tools
bash "$SCRIPT_DIR/install-biome.sh"
bash "$SCRIPT_DIR/install-difftastic.sh"
bash "$SCRIPT_DIR/install-git-filter-repo.sh"
bash "$SCRIPT_DIR/install-make.sh"
bash "$SCRIPT_DIR/install-postgresql-libs.sh"
bash "$SCRIPT_DIR/install-shellcheck.sh"
bash "$SCRIPT_DIR/install-tree.sh"

# Cloud CLIs
bash "$SCRIPT_DIR/install-aws-cli.sh"
bash "$SCRIPT_DIR/install-azure-cli.sh"
bash "$SCRIPT_DIR/install-codex.sh"
bash "$SCRIPT_DIR/install-gh.sh"
bash "$SCRIPT_DIR/install-heroku-cli.sh"

# Shell enhancements
bash "$SCRIPT_DIR/install-bat.sh"
bash "$SCRIPT_DIR/install-eza.sh"
bash "$SCRIPT_DIR/install-fd.sh"
bash "$SCRIPT_DIR/install-fzf.sh"
bash "$SCRIPT_DIR/install-ripgrep.sh"
bash "$SCRIPT_DIR/install-zoxide.sh"

# TUI applications
bash "$SCRIPT_DIR/install-btop.sh"
bash "$SCRIPT_DIR/install-htop.sh"
bash "$SCRIPT_DIR/install-neovim.sh"
bash "$SCRIPT_DIR/install-lazygit.sh"
bash "$SCRIPT_DIR/install-lazydocker.sh"

# GUI applications
bash "$SCRIPT_DIR/install-cursor.sh"
bash "$SCRIPT_DIR/install-zed.sh"

# Environment tools
bash "$SCRIPT_DIR/install-fastfetch.sh"
bash "$SCRIPT_DIR/install-direnv.sh"

# Media and utilities
bash "$SCRIPT_DIR/install-ffmpeg.sh"
bash "$SCRIPT_DIR/install-cmatrix.sh"
bash "$SCRIPT_DIR/install-jq.sh"

# File manager and preview dependencies
bash "$SCRIPT_DIR/install-yazi.sh"
bash "$SCRIPT_DIR/install-poppler.sh"
bash "$SCRIPT_DIR/install-imagemagick.sh"
bash "$SCRIPT_DIR/install-resvg.sh"
bash "$SCRIPT_DIR/install-7zip.sh"
bash "$SCRIPT_DIR/install-gifski.sh"

echo "All Omarchy packages installed successfully"
