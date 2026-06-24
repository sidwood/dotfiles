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
- Custom executables: `bin/.local/bin/` (+ sourced helpers in `bin/.local/share/`)
- Global agent memory (every repo, every harness): `agents/.config/agents/AGENTS.md`. This file covers the dotfiles repo only.

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
- On macOS, `omarchy/` is skipped.
- On macOS, `cursor/` is skipped by Stow and linked manually to `~/Library/Application Support/Cursor/User`.
- `bin/` is stowed on both platforms and depends on `~/.local/bin` being on PATH (set in `profile/.profile`).
- `agents/` is stowed on both platforms and folds to `~/.config/agents/`.

## Agent Memory Model
- Machine-wide tooling belongs in the global file, not this one: this one only loads inside the repo, so it cannot advertise anything installed to `$HOME`.
- The global file is committed and loaded by every agent on every session. Keep it short, harness-neutral, and free of notes about itself. Anything that must stay out of git history goes in per-agent private memory instead.
- `link_agent_memory()` symlinks each harness at that single file — never copy it. Verify a new harness's path against the tool itself (shipped docs, `strings` on the binary, its issue tracker); vendor conventions differ more than they look.
- Cursor is the exception to plain markdown: `~/.cursor/rules/*.mdc`, auto-applied only with `alwaysApply: true` frontmatter, which the shared file deliberately omits. Kimi is absent by design — working-directory `AGENTS.md` only (MoonshotAI/kimi-cli#2152).

## Custom Executable Pattern
- Cross-platform scripts live in `bin/.local/bin/` (mode 755, no extension); `omarchy/.local/bin/` is macOS-skipped and Omarchy-only.
- Use `#!/usr/bin/env bash`, not `#!/bin/bash`: macOS `/bin/bash` is 3.2.
- Shared code goes in `bin/.local/share/<tool>/` (mode 644), sourced via `"$(dirname "$0")/../share/<tool>/lib.sh"` so it resolves both stowed and in-repo.
- Avoid GNU-only flags; macOS has BSD `realpath`, `sed`, `find` (no `realpath -m`).
- Lint with `shellcheck -x`; add `# shellcheck source-path=SCRIPTDIR source=...` before a `source` and `# shellcheck shell=bash` atop sourced fragments.

## Omarchy Package Script Pattern
Use the existing structure:

```bash
#!/bin/bash
set -e

omarchy-pkg-add repo-package-name
echo "... installed successfully"
```

Notes:
- No guard clause needed; `omarchy-pkg-add` and `omarchy-pkg-aur-add` are already idempotent (they check `omarchy-pkg-missing` and pass `--needed`).
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
- Changed `bin/` scripts: `shellcheck -x bin/.local/bin/<script>`
- Changed `shell/.config/shell/*` fragments: `bash -n` and `zsh -n` (both source them)
- New/changed Stow package: `stow -n -v -t "$HOME" <pkg>`
- Optionally on macOS: `brew bundle check --file=Brewfile`

## Operational Notes
- Global packages install with **pnpm**, not npm. pnpm refuses to install globally at all unless `PNPM_HOME` is set and on PATH, and defaults to a non-XDG `~/Library/pnpm` on macOS — hence the export in `profile/.profile`, repeated in `setup_npm_globals` for first runs that have not sourced it. pnpm honours `NPM_CONFIG_USERCONFIG`, so the stowed XDG npmrc covers the private `@sidwood` registry without a second config file.
- Local secrets template is `shell/.config/shell/local.env.tpl`; `install.sh` resolves it with 1Password, writes `~/.config/shell/local.env` (gitignored), and sources it into the install process.
- `install.sh` local env generation / npm globals may block in sandbox/non-interactive environments until 1Password CLI auth is completed.
- Order matters for first-run npm globals: stow (npmrc) → local env → mise (node/npm) → npm globals; the script aborts if any of those prerequisites are missing.
- Prefer idempotent shell changes and existing conventions over new abstractions.
