# dotfiles

Configuration files for `bash`, `zsh`, `vim`, `git`, and more. Compatible with
macOS and Arch Linux ([Omarchy](https://github.com/basecamp/omarchy)).

## Installation

Installation requires `bash`, `curl`, and `git`.

```bash
git clone git@github.com:sidwood/dotfiles.git
cd dotfiles
./install.sh
```

The install script presents an interactive menu where you can select which
components to install. The available options vary by platform:

### macOS

```
Select installations (↑/↓/k/j navigate, Space toggle, Enter confirm):

> [x] Install Homebrew packages and applications.
  [x] Apply macOS system defaults.
  [x] Symlink dotfile packages with GNU Stow.
  [x] Set up mise with default runtimes.
  [x] Install global npm packages.
  [x] Install vim plugins.
```

### Arch Linux (Omarchy)

```
Select installations (↑/↓/k/j navigate, Space toggle, Enter confirm):

> [x] Install Arch packages (pacman + AUR).
  [x] Symlink dotfile packages with GNU Stow.
  [x] Set up mise with default runtimes.
  [x] Install global npm packages.
  [x] Install vim plugins.
```

Use arrow keys or `j`/`k` to navigate, space to toggle options, and enter to
confirm.

## Structure

The dotfiles are organized as [GNU Stow](https://www.gnu.org/software/stow/)
packages. Each top-level directory is a package that gets symlinked to `$HOME`.

```
dotfiles/
├── bash/           # Bash config (macOS only, skipped on Omarchy)
├── ghostty/        # Ghostty terminal config
├── git/            # Git config and global ignore
├── htop/           # htop process viewer config
├── iterm2/         # iTerm2 terminal config (macOS)
├── misc/           # Miscellaneous dotfiles (.editorconfig, .agignore, etc.)
├── mutt/           # Mutt email client config
├── npm/            # NPM configuration
├── nvim/           # Neovim config (Lua with lazy.nvim)
├── profile/        # Shared environment variables (.profile)
├── ruby/           # Ruby/Bundler/IRB config
├── shell/          # Unified shell config (aliases, functions, init)
├── ssh/            # SSH config (1Password agent)
├── tmux/           # Tmux config
├── vim/            # Vim config and plugins (vim-plug)
├── yazi/           # Yazi file manager config
└── zsh/            # Zsh config with zinit and powerlevel10k
```

### Unified Shell Config

The `shell/` package provides cross-platform configuration that works in both
bash and zsh:

- `~/.config/shell/aliases` - Common aliases
- `~/.config/shell/functions` - Utility functions
- `~/.config/shell/init` - Tool integrations (mise, zoxide, fzf)

## Uninstall

```bash
cd /path/to/dotfiles
./uninstall.sh
```

The uninstall script presents a similar interactive menu:

### macOS

```
Select uninstallations (↑/↓/k/j navigate, Space toggle, Enter confirm):

> [x] Uninstall Homebrew packages and applications.
  [x] Reset macOS system defaults.
  [x] Remove dotfile package symlinks with GNU Stow.
  [x] Uninstall vim plugins.
```

### Arch Linux (Omarchy)

```
Select uninstallations (↑/↓/k/j navigate, Space toggle, Enter confirm):

> [x] Uninstall Arch packages (pacman + AUR).
  [x] Remove dotfile package symlinks with GNU Stow.
  [x] Uninstall vim plugins.
```

## Neovim on Omarchy

Omarchy ships with a default [LazyVim](https://www.lazyvim.org/) configuration
in `~/.config/nvim`. This repo includes its own neovim config (custom lazy.nvim
setup in the `nvim/` stow package), which conflicts with those files.

During installation, `install.sh` automatically backs up the Omarchy neovim
config before stowing:

```
~/.config/nvim → ~/.config/nvim.omarchy-backup
```

To restore the original Omarchy neovim config:

```bash
cd /path/to/dotfiles
stow -D -t "$HOME" nvim              # remove dotfile symlinks
rm -rf ~/.config/nvim                 # clean up any leftover files
mv ~/.config/nvim.omarchy-backup ~/.config/nvim
```

## 1Password Secrets

Some projects require secrets stored in 1Password (e.g., private GitHub Package
registries). The `profile/.profile` exports environment variables using
[1Password secret references](https://developer.1password.com/docs/cli/secret-references/).

To inject secrets when running npm commands, use `op run`:

```bash
op run -- npm install
```

This replaces secret references (e.g., `op://Personal/GitHub Registry Token/token`)
with their actual values for the duration of that command.

## Local Shell API Keys (Generated)

This repo includes a template at `shell/.config/shell/local.env.tpl` for
machine-local API keys using 1Password secret references.

During `./install.sh`, the script resolves that template with `op run` and
generates:

- `~/.config/shell/local.env`

The generated file is sourced by `shell/.config/shell/init`, overwritten on
each install run, permissioned to `600`, and ignored by git.
