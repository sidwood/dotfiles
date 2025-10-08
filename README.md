# dotfiles

Configuration files for `bash`, `zsh`, `vim`, `git`, and more. Compatible with
Linux and macOS environments.

## Installation

Installation requires `bash`, `curl`, `git`, and GNU `make`.

```bash
git clone https://github.com/sidwood/dotfiles.git
cd dotfiles
./install.sh
```

The install script presents an interactive menu where you can select which
components to install:

```
Select installations (↑/↓ navigate, Space toggle, Enter confirm):

> [x] Install Homebrew packages and applications.
  [x] Symlink dotfile packages with GNU Stow.
  [x] Build and install vcprompt.
  [x] Install vim plugins.
```

Use arrow keys to navigate, space to toggle options, and enter to confirm.

Note: The Homebrew option only appears on macOS.

## Uninstall

```bash
cd /path/to/dotfiles
./uninstall.sh
```
