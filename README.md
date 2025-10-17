# dotfiles

Configuration files for `bash`, `zsh`, `vim`, `git`, and more. Compatible with
Linux and macOS environments.

## Installation

Installation requires `bash`, `curl`, and `git`.

```bash
git clone https://github.com/sidwood/dotfiles.git
cd dotfiles
./install.sh
```

The install script presents an interactive menu where you can select which
components to install:

```
Select installations (↑/↓/k/j navigate, Space toggle, Enter confirm):

> [x] Install Homebrew packages and applications.
  [x] Apply macOS system defaults.
  [x] Symlink dotfile packages with GNU Stow.
  [x] Install vim plugins.
```

Use arrow keys or `j`/`k` to navigate, space to toggle options, and enter to
confirm.

Note: The Homebrew and macOS defaults options only appear on macOS.

## Uninstall

```bash
cd /path/to/dotfiles
./uninstall.sh
```

The uninstall script presents a similar interactive menu:

```
Select uninstallations (↑/↓/k/j navigate, Space toggle, Enter confirm):

> [x] Uninstall Homebrew packages and applications.
  [x] Reset macOS system defaults.
  [x] Remove dotfile package symlinks with GNU Stow.
  [x] Uninstall vim plugins.
```
