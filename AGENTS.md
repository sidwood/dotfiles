# AGENTS.md

## Ownership
- Agent-owned working context: keep concise, high-signal, and update freely when it improves future task execution.

## Purpose
- Personal dotfiles for macOS and Omarchy (Arch Linux).
- Managed as GNU Stow packages plus menu-driven `install.sh` / `uninstall.sh`.

## Default Assumptions
- Assume dual-platform impact unless the task explicitly scopes to one OS.
- For package/tool changes, update both platform flows or state why one side is intentionally skipped.
- Keep edits surgical; do not refactor unrelated files.

## Source Of Truth
- User-facing docs: `README.md`
- Install entrypoint: `install.sh`
- Uninstall entrypoint: `uninstall.sh`
- macOS packages/apps: `Brewfile`
- Omarchy packages: `install/omarchy/packages/install-all.sh` + `install-*.sh`
- macOS defaults: `macos/defaults.sh`

## Platform Model
- macOS install path: Homebrew via `brew bundle --file=Brewfile`.
- Omarchy install path: `install/omarchy/packages/install-all.sh` using:
  - `omarchy-pkg-add` (official repos)
  - `omarchy-pkg-aur-add` (AUR)
- Omarchy detection: `$HOME/.local/share/omarchy` exists.

## Stow Model
- Most top-level dirs are Stow packages into `$HOME`.
- `install.sh` skips `macos/`, `alfred/`, `install/`.
- On Omarchy, `bash/` is skipped.
- On macOS, `cursor/` is skipped by Stow and linked manually to `~/Library/Application Support/Cursor/User`.

## Omarchy Package Script Pattern
Use the existing structure:

```bash
#!/bin/bash
set -e

PACKAGE="cmd-name"

if command -v "$PACKAGE" &>/dev/null; then
    echo "... is already installed"
    exit 0
fi

omarchy-pkg-add repo-package-name
echo "... installed successfully"
```

Notes:
- Prefer one package concern per `install/omarchy/packages/install-*.sh`.
- Add new scripts to `install/omarchy/packages/install-all.sh` in the correct section.
- If package naming is unclear, verify against official package indexes before editing.

## Package Change Checklist
1. macOS: update `Brewfile` (`brew` for CLI libs/tools, `cask` for GUI/apps).
2. Omarchy: add/update `install/omarchy/packages/install-<tool>.sh`.
3. Omarchy: wire script into `install/omarchy/packages/install-all.sh`.
4. If uninstall parity is expected, update `uninstall.sh` package arrays.
5. Update `README.md` when behavior/options change.

## Validation (Minimal)
- `bash -n install.sh uninstall.sh`
- `bash -n install/omarchy/packages/install-all.sh`
- `bash -n <changed install/omarchy/packages/*.sh>`
- Optionally on macOS: `brew bundle check --file=Brewfile`

## Operational Notes
- `npm` globals step depends on 1Password CLI and uses: `op run -- npm install -g @sidwood/timecraft`.
- Local secrets template is `shell/.config/shell/local.env.tpl`; `install.sh` resolves it with 1Password and writes `~/.config/shell/local.env` (gitignored).
- `install.sh` local env generation may block in sandbox/non-interactive environments until 1Password CLI auth is completed.
- Prefer idempotent shell changes and existing conventions over new abstractions.
