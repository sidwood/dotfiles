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
  [x] Set up MLX for Apple silicon.
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

### MLX coding worker

On Apple silicon, the installer creates an isolated Python 3.13 environment at
`~/.local/share/venvs/mlx` and installs the pinned MLX and MLX LM versions from
`bin/.local/share/mlx/requirements.txt`. Re-run the setup after changing those
pins:

```bash
mlx-setup
```

The named coding models are pinned in `bin/.local/share/mlx/profiles.tsv`, with
the default selected by `default-profile.txt`. Download one profile or both and
start its local OpenAI-compatible endpoint with:

```bash
mlx-model-download qwen36
mlx-model-download all
mlx-server-start qwen36
```

`cm` retains `Qwen3-Coder-Next-4bit` as the default interactive OpenCode
worker. `cmq` launches `Qwen3.6-35B-A3B-OptiQ-4bit`; the equivalent explicit
form is `cm qwen36`. Each command starts its own server when necessary, and the
two servers can coexist on the 128 GB M5 Max. Use `opencode-mlx --profiles` to
list their names and ports. Run `frontier-review "<requirements>"` for an
explicit review.

For an autonomous fleet job, use `cm run "<task>"` from a clean Git worktree.
The launcher runs the local worker, asks Codex GPT-5.6 Sol and Claude Opus to
review its working diff independently in read-only modes, then sends their
findings back to the worker for one remediation pass. Use `mlx-server-stop` to
release the model's unified memory.

Run `cmab "<implementation task>"` from a clean repository to compare both
models. It creates two disposable branch clones, gives each worker the same
task, and saves their logs, timings, Git status and complete patches under
`~/.local/state/mlx/ab/<timestamp>/` without changing the source checkout or
spending frontier-model credits. Stop one named server with
`mlx-server-stop qwen36`, or stop both with `mlx-server-stop all`.

Use `mlx_lm` for direct model access and `mlx-python` for Python code that
imports MLX. Downloaded Hugging Face models remain in the normal user cache and
are not removed when the rebuildable Python environment is uninstalled.

### Always-on GLM Hermes worker

oMLX is installed from its Homebrew tap as the always-on model server. Run the
idempotent setup once after installing the Brewfile:

```bash
omlx-glm-setup
```

The command downloads `mlx-community/GLM-4.7-Flash-4bit`, binds oMLX only to
`127.0.0.1:13308`, generates a per-machine API key, and pins GLM so it is
preloaded whenever the login service starts. It also snapshots the previous
Hermes configuration before making `glm-4.7-flash-4bit` the primary model with
a 65,536-token context window. The API key is written only to local oMLX and
Hermes configuration; it is never stored in this repository.

The setup keeps oMLX's paged SSD and hot prefix caches enabled and uses a
deterministic non-thinking tool-agent profile at temperature 0 and top-p 1.0.
Thinking is forced off because the 4-bit MLX checkpoint can enter repetition
loops after tool results when thinking is enabled. Speculative decoding remains
disabled until it is validated against Hermes's large tool prompt.

Use `omlx stop`, `omlx start`, and `omlx restart` to control the managed
service. The model remains in the shared Hugging Face cache if oMLX is
uninstalled.

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

The `c` alias launches `opencode-framework`. This wrapper uses `op run` to
resolve the machine-local `~/.config/opencode/framework.env` reference before
starting OpenCode, so the Framework Desktop API key is never stored in the
repository. Interactive sessions disable `op run` output masking so terminal
applications retain direct TTY access; automated runs keep masking enabled.

Choose the Framework model when starting a fresh session:

```sh
c --help              # wrapper usage and the three supported profiles
c models              # list the three supported profiles
c                     # defaults to 27b-64k
c 27b-64k             # Qwen3.8-27B Q5, 65,536-token context
c 27b-128k            # Qwen3.8-27B Q5, 131,072 tokens; experimental
c 122b                # Qwen3.5-122B Q4, 262,144-token context
c 27b-64k run "Explain this project"
```

Help and model listings run locally without OpenCode, 1Password or a server
request. `27b` remains a compatibility shortcut for `27b-64k`; the listing
shows only the three canonical profile names. `-h` and `--framework-help`
also display wrapper help. Use `opencode --help` for OpenCode's own help.

The 128K profile completed a 121,990-token cold request in 14m 11s, but retrieved
only three of six test values correctly, so it remains experimental. A cached
follow-up took 1.8s. This is not an accuracy comparison against 64K, whose earlier
capacity test was simpler. The saved 64K and 122B profiles are unchanged; 128K
shares the existing 27B weight files without another download.

Both downloads and saved server profiles are retained. Lemonade loads the
requested model on demand, evicting the other if necessary; keep requests
sequential and close an old client before switching. The explicit `--model`
or `-m` option is still supported without a profile selector. Other OpenCode
arguments pass through; prefix a project path with `./` if it matches a selector
or `models`. `c models` accepts no further arguments; use `opencode models` for
OpenCode's full catalogue.

The wrapper loads `~/.config/opencode/framework.json` alongside the existing
global configuration. This adds 27B without replacing the 122B definition,
disables automatic titles for wrapper-launched sessions, and allows up to an
hour for cold long-context requests (the historical 122B near-ceiling test
took 37 minutes). Titles otherwise target an offline Mac-local MLX server;
sending them to Framework would introduce untested concurrent inference.
Tool permissions are unchanged. An explicit `OPENCODE_CONFIG` is honoured
instead of the wrapper profile; that custom file must declare any extra models
it needs. Repository configuration can also override profile settings.
The 128K client requests one-second streaming keepalives to survive long prompt
processing. Lemonade's global timeout is unchanged; non-streaming requests may
still fail after ten minutes even when the worker is healthy.
Run `opencode-framework --help` for launcher-specific usage.

## Local Shell API Keys (Generated)

This repo includes a template at `shell/.config/shell/local.env.tpl` for
machine-local API keys using 1Password secret references.

During `./install.sh`, the script resolves that template with `op run` and
generates:

- `~/.config/shell/local.env`

The generated file is sourced by `shell/.config/shell/init`, overwritten on
each install run, permissioned to `600`, and ignored by git.
