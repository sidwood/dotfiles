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

> [x] Install Homebrew packages and applications (including LM Studio).
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
├── opencode/       # Local and remote coding-agent providers and roles
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
`prefix+s` opens workspace navigation; `j`/`k` (and arrows) move the list,
`Ctrl-J`/`Ctrl-K` move panes while that surface is open.
Herdr extras stay on unused chords: `g` for the workspace/agent picker, `b` or
`m` for the sidebar, `d` or `q` to detach, `Shift-R` for resize mode. `prefix+%` and `prefix+"` are extra
split aliases. `prefix+a` forwards a literal `Ctrl-A` into the focused pane;
double `Ctrl-A` is Herdr's built-in fallback. Tmux itself is unchanged.

Reload a running server after Stow with `herdr server reload-config`.

Selecting the Stow installation also runs Herdr's own OpenCode integration
installer when both commands are available. It generates
`~/.config/opencode/plugins/herdr-agent-state.js`, which lets OpenCode report
its lifecycle state and resumable session identity to Herdr. The generated
file is deliberately not stored here so it stays matched to the installed
Herdr version. Check it with `herdr integration status`; re-running
`./install.sh` with Stow selected refreshes it.

### Unified Shell Config

The `shell/` package provides configuration sourced from zsh:

- `~/.config/shell/aliases` - Common aliases
- `~/.config/shell/functions` - Utility functions
- `~/.config/shell/init` - Tool integrations (mise, zoxide, fzf)

### OpenCode: local and Framework models

`c` launches OpenCode against LM Studio on this Mac. `cf` selects the Framework
Desktop server. `cm` is a compatibility alias for `c`. Start a new shell after
updating to pick up the changed aliases.

```sh
lms server start --port 1234
c
c run "Explain this project"
c --model lmstudio/qwen/qwen3.8-27b
c models lmstudio
cf models
cf                         # 27b-64k default
cf 27b-128k                # experimental long-context profile
cf 122b
cf 27b-64k run "Explain this project"
```

The Homebrew installation option includes the `lm-studio` cask; no standalone
MLX Python environment is installed.

LM Studio manages its own MLX and llama.cpp runtimes and model loading. The
local launcher checks the API on `127.0.0.1:1234`; it does not start a separate
Python server. Gemma is the configured local default. Model IDs and context
limits and the allowed-model list live in
`opencode/.config/opencode/opencode.jsonc`; match those limits to
the context actually loaded in LM Studio. Listing a model does not mean it is
loaded. Local API authentication is currently disabled.

The global config has no `small_model` override: for these custom providers,
OpenCode's title helper falls back to the selected model. The optional
`--agent local-worker` role also inherits the selected model. Launchers never
request cloud reviews or run remediation; orchestration belongs to the harness
or a future Atomic workflow. The standalone `frontier-review` utility remains
available for deliberate use.

#### Framework configuration

All Framework model definitions and Lemonade request settings live in
`opencode/.config/opencode/framework.json`. The adjacent
`framework-profiles.tsv` maps command shortcuts to model IDs; its first row is
the default. `27b` remains an alias for `27b-64k`.

Create a machine-local credential reference once:

```sh
cp ~/.config/opencode/framework.env.example ~/.config/opencode/framework.env
chmod 600 ~/.config/opencode/framework.env
```

Edit that file to set `FRAMEWORK_BASE_URL` and replace the example
`FRAMEWORK_API_KEY` locator with your 1Password reference. Keep resolved secrets
out of the repository. The launcher defaults to `FRAMEWORK_AUTH=1password`,
using `op run` to resolve this file for the child process. Interactive launches
preserve direct TTY access with `--no-masking`; automated launches keep masking.

For a server without authentication, set `FRAMEWORK_AUTH=none` and
`FRAMEWORK_BASE_URL` in the launch environment; no 1Password call is made. For an
already-resolved credential, use `FRAMEWORK_AUTH=env` with both
`FRAMEWORK_BASE_URL` and `FRAMEWORK_API_KEY` exported. These two modes do not read
`framework.env`.

The `framework` provider name and `cf` command can survive a future move to
LM Studio on the desktop. Update the endpoint, credential mode, model IDs,
loaded context limits, and server-specific request settings together. The
macOS dotfiles installer does not manage the desktop's operating system.

Framework titles remain disabled to avoid untested concurrent inference.
Cold long-context requests allow up to an hour; the 128K profile requests
streaming keepalives. Its previous 121,990-token cold test took 14m 11s and
retrieved three of six test values, so it remains experimental. A cached
follow-up took 1.8s. This was not an accuracy comparison against the simpler
64K test. Lemonade's non-streaming global timeout remains unchanged.

`cf --help` and `cf models` need neither 1Password nor a running server.
Use either a profile selector or `--model`/`-m`, not both. Prefix a project path
with `./` when it matches a profile or `models`.

An explicit `OPENCODE_CONFIG` replaces the launcher's choice of overlay, not
OpenCode's global configuration. Project settings can override that overlay.
The custom file must define any remote models it needs. For custom config or
inline config, `c` delegates endpoint checks to that configuration. Use
`opencode` directly for other providers or remote OpenCode server attachment.

#### Migration from the direct MLX launchers

`c` previously meant Framework; use `cf` for that destination now. `cmq` and
`cmab` are retired. Local model selection no longer implies automatic cloud
reviews. The former Python environment at `~/.local/share/venvs/mlx` is not a
runtime dependency of LM Studio. The direct-server scripts and installer menu
entries have been removed. The old environment, its two Qwen model downloads,
and its server state have also been deleted on this Mac. LM Studio retains its
two downloaded chat models and its bundled embedding helper. Other tools can
use the shared Hugging Face cache, so cleanup targets named model repositories
rather than removing the whole cache.
The former oMLX/Hermes server and its GLM download have also been retired;
the Brewfile no longer installs that server. Hermes maintains its own provider
configuration separately from these OpenCode launchers.

### Flutter iOS toolchain

The Brewfile installs Flutter and CocoaPods, and Xcode from the Mac App
Store. Building or simulating an iOS app also needs a one-time ritual that
the Brewfile cannot express, because it takes root and a licence agreement.
Run the idempotent setup once Xcode is installed:

```bash
flutter-ios-setup
```

The command points the active developer directory at full Xcode, accepts the
Xcode licence, downloads the iOS platform and simulator runtime, installs
Xcode's deferred first-launch components, precaches Flutter's iOS engine
artifacts, and finishes with `flutter doctor`. Each step detects work already
done and skips it, so re-running after an Xcode upgrade only fetches what is
missing. The three steps that take root announce themselves before prompting.

Note that `mas install` needs root in mas 7, so Xcode itself is
`sudo mas install 497799835` rather than part of `brew bundle`.

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
