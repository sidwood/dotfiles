# dotfiles

Configuration files for `zsh`, `vim`, `git`, and more. macOS only. The login
shell is zsh; install and helper scripts still run under bash 3.2 because that
is what macOS ships.

## Installation

Installation requires `bash`, `curl`, and `git`.

```bash
git clone git@github.com:sidwood/dotfiles.git
cd dotfiles
./install.sh
```

The install script presents an interactive menu where you can select which
components to install. It also points this repository's `core.hooksPath` at
`.githooks` so the commit-msg house style is enforced.

```
Select installations (↑/↓/k/j navigate, Space toggle, Enter confirm):

> [x] Install Homebrew packages and applications.
  [x] Apply macOS system defaults.
  [x] Symlink dotfile packages with GNU Stow.
  [x] Set up mise with default runtimes.
  [x] Install global pnpm packages.
  [x] Install vim plugins.
```

Use arrow keys or `j`/`k` to navigate, space to toggle options, and enter to
confirm.

## Structure

The dotfiles are organized as [GNU Stow](https://www.gnu.org/software/stow/)
packages. Each top-level directory is a package that gets symlinked to `$HOME`.

```
dotfiles/
├── agents/         # Global agent memory shared by every AI harness
├── bin/            # Custom executables on PATH via ~/.local/bin
├── ghostty/        # Ghostty terminal config
├── git/            # Git config and global ignore
├── herdr/          # Herdr workspace manager (Solarized Dark, tmux-first keys)
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

### Herdr

The `herdr/` package folds to `~/.config/herdr/config.toml`. It uses Herdr's
built-in `solarized` theme with canonical Solarized Dark tokens so the chrome
matches Ghostty. The native sidebar split stays intact: Spaces above, Agents
below. In-app toasts appear bottom-right; Herdr colors them by kind (blue for
finished, red for needs-attention, yellow for config warnings). Rounded pane
borders are not configurable in Herdr 0.8.

Keys follow the tmux config: `Ctrl-A` prefix, `h/j/k/l` pane focus,
`Ctrl-H`/`Ctrl-L` tab cycling (keep Ctrl held: `A` then `H`/`L`), `,` to rename
the tab, `|`/`\` and `-`/`_` splits, and `r` to reload.
Herdr extras stay on unused chords: `g` for the workspace/agent picker, `b` or
`m` for the sidebar, `d` or `q` to detach, `Shift-R` for resize mode. `prefix+%` and `prefix+"` are extra
split aliases. `prefix+a` forwards a literal `Ctrl-A` into the focused pane;
double `Ctrl-A` is Herdr's built-in fallback. Tmux itself is unchanged.

Reload a running server after Stow with `herdr server reload-config`.

### Unified Shell Config

The `shell/` package provides configuration sourced from zsh:

- `~/.config/shell/aliases` - Common aliases
- `~/.config/shell/functions` - Utility functions
- `~/.config/shell/init` - Tool integrations (mise, zoxide, fzf)

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

## Git Branch Clones

An alternative to `git worktree`, following Avdi Grimm's
[You probably don't need git worktrees](https://avdi.codes/you-probably-dont-need-git-worktrees/).
Worktrees bake absolute paths into config files, which breaks containers and
makes them awkward to move. A plain local clone has none of those problems, and
git hardlinks the object files when cloning locally — so a second copy of a repo
is near-instant and costs almost no disk.

The `bin/` package wraps the bookkeeping in five commands:

```bash
gbca ~/code/myapp feature-x   # clone ~/code/myapp -> ~/code/myapp.feature-x
gbc                           # list branch clones, with status and ahead/behind
gbc --pr                      # same, plus each branch's PR state from gh
gbcd                          # fzf-pick a branch clone and cd into it
gbcs                          # re-sync ignored local files from the source
gbcr ~/code/myapp.feature-x   # remove one clone, with safety checks
gbcp --dry-run                # show which clones have landed and can go
gbcp                          # remove the clones whose PRs merged or closed
```

Each has a long form as a git subcommand — `git bc-add`, `git bc-list`,
`git bc-sync-extras`, `git bc-rm`, `git bc-prune`. Use `-h` for usage: git
intercepts `--help` on a subcommand and looks for a man page instead.

`gbca` clones from a local seed, repoints `origin` at the real remote so nothing
depends on the seed, and copies across the gitignored files a fresh clone needs
(`.env` and variants, `.envrc`, Rails credentials keys,
`docker-compose.override.yml`, `Procfile.local`, mise local config). Rebuildable
trees like `node_modules` are never copied.

The seed's own copy of a branch always wins, unpushed commits included. If the
seed has the branch but is parked elsewhere, `gbca` checks it out in the seed
before cloning and restores the previous branch afterwards; a seed with
uncommitted changes is refused rather than disturbed. This matters because a
local clone only materialises the source's *current* branch — the rest arrive as
remote-tracking refs, which the first `fetch --prune` deletes whenever the server
has never seen them. Branches that exist only on the server are tracked as
normal, and a name that exists nowhere starts a new branch off the seed's HEAD.

A clone is marked as a branch clone by a `bc.source` entry in its local git
config. Base clones lack it, so `gbcr` and `gbcp` will not touch them. `gbcr`
also refuses a clone with uncommitted work, one holding commits that exist
nowhere else, or the one the current shell is sitting in — `--force` overrides
the first three, nothing overrides the last.

"Nowhere else" counts the seed, not just the remote. A branch cloned before it
was pushed sits above every remote ref while risking nothing, since the seed
still holds every commit; refusing there would mean reaching for `--force` on
routine cleanup, which is how the one clone that mattered eventually gets
deleted. Commits absent from both the remote and the seed still block removal,
and a seed that has since been moved or deleted falls back to comparing against
the remote alone.

Three per-repo config keys, all set on the base clone:

- `bc.source` - written by `gbca`; marks a directory as a branch clone
- `bc.postadd` - command run in a new clone once the branch is checked out
- `bc.extras` - extra file patterns for `gbcs` to copy (repeatable)

```bash
git -C ~/code/myapp config bc.postadd 'mise install && npm ci'
git -C ~/code/myapp config --add bc.extras 'config/local.yml'
```

## Agent Memory

Two layers, both plain markdown so any agent harness can read them:

- `AGENTS.md` in this repo (symlinked as `CLAUDE.md`) — conventions for working
  on the dotfiles themselves. Only loads when an agent works in this repo.
- `agents/.config/agents/AGENTS.md` → `~/.config/agents/AGENTS.md` — global
  memory, loaded in every session in every repository. Machine-wide tooling like
  `git bc-*` is documented here, since a project-scoped file cannot advertise
  something installed to `$HOME`.

### One file, every harness

Every harness reads a different filename in a different directory. Rather than
keeping a copy per tool, `install.sh` symlinks each one at the single canonical
file:

```
~/.config/agents/AGENTS.md                   # canonical, the only file to edit
├── ~/.claude/CLAUDE.md                      # Claude Code
├── ~/.codex/AGENTS.md                       # Codex
├── ~/.grok/AGENTS.md                        # Grok
├── ~/.config/opencode/AGENTS.md             # OpenCode
├── ~/.cursor/rules/global-agent-memory.mdc  # Cursor
├── ~/.gemini/GEMINI.md                      # Gemini CLI
└── ~/.pi/agent/AGENTS.md                    # Pi
```

Add a harness by adding one `<command>|<path>` line to the `harnesses` table in
`link_agent_memory()`. Links are only created for harnesses that are actually
installed, so `$HOME` does not collect config directories for tools you do not
have. Re-running is a no-op, and any pre-existing real file is moved to `.bak`
before being replaced.

Every path was verified against the tool itself rather than assumed — Codex from
strings in its binary, Grok from its shipped `docs/user-guide`, OpenCode from its
config root, Pi from its `agentDir` default, Cursor and Kimi from their docs and
issue tracker. Two are worth knowing about:

- **Cursor** does not read a home-level `AGENTS.md`. Its global rules are `.mdc`
  files in `~/.cursor/rules/`, which is where the link points. Cursor loads a
  rule in every chat only when it carries `alwaysApply: true` frontmatter, and
  the canonical file deliberately has none — frontmatter would be dead weight in
  every other harness's context window. If Cursor does not pick the rule up
  automatically, enable it in Cursor's own rules settings.
- **Kimi is deliberately absent.** It only reads `AGENTS.md` from the working
  directory; global support is an open, unimplemented request
  ([kimi-cli#2152](https://github.com/MoonshotAI/kimi-cli/issues/2152)). Linking
  `~/.kimi/AGENTS.md` today would create a file nothing reads; `link_agent_memory()`
  records the line to add when it ships.

Keep the canonical file short and free of meta-commentary. Every agent loads it
into context on every session, so it should carry only what an agent needs to
act on — not notes about the file itself, which belong here instead. Anything
that should not enter git history does not belong in it at all.

## SSH server (sshd)

OpenSSH is installed by Homebrew. The SSH daemon is **not** enabled
automatically.

### Enable sshd

Prefer Apple’s built-in Remote Login (system `sshd`), not Homebrew’s `openssh`
daemon:

- **GUI:** System Settings → General → Sharing → Remote Login
- **CLI:** `sudo systemsetup -setremotelogin on`

Check status with `sudo systemsetup -getremotelogin` or
`sudo launchctl print system/com.openssh.sshd`. Turn it off with
`sudo systemsetup -setremotelogin off`.

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
