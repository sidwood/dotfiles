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
  [ ] Enable LM Studio models in OpenCode on this Mac.
  [x] Set up mise with default runtimes.
  [x] Install DeepSeek Harness with portable defaults.
  [x] Install Atomic with portable defaults.
  [x] Install pinned Node CLIs.
  [x] Install vim plugins.
```

Use arrow keys or `j`/`k` to navigate, space to toggle options, and enter to
confirm.

## Structure

The dotfiles are organized as [GNU Stow](https://www.gnu.org/software/stow/)
packages. Each top-level directory is a package that gets symlinked to `$HOME`,
except `macos/`, `alfred/`, `cursor/`, and `node-clis/`.

```
dotfiles/
├── agents/         # Global agent memory shared by every AI harness
├── atomic/         # Atomic starter settings (the CLI project is node-clis/atomic)
├── bin/            # Custom executables on PATH via ~/.local/bin
├── dsh/            # DeepSeek Harness starter settings (the CLI project is node-clis/deepseek-harness)
├── node-clis/      # Pinned Node CLI projects; not a Stow package
├── ghostty/        # Ghostty terminal config
├── git/            # Git config and global ignore
├── herdr/          # Herdr workspace manager (Solarized Dark, tmux-first keys)
├── himalaya/       # Himalaya CLI email config (iCloud via 1Password)
├── htop/           # htop process viewer config
├── humanlayer/     # HumanLayer workspace defaults
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

### HumanLayer

The `humanlayer/` package folds to `~/.config/humanlayer/workspace.json`. That
file is the upstream default workspace config from HumanLayer 0.175, kept as
the portable starter. HumanLayer itself reads `.humanlayer/workspace.json` in
the selected repository, so copy this file there when a project needs
worktrees. Auth, host id, window state, and logs stay in
`~/.humanlayer/riptide/` on each Mac and are not stowed.

Install the app with Homebrew (`cask "humanlayer"` from the trusted
`humanlayer/humanlayer` tap). The cask also links `riptided`. Sign-in happens
in the app on first launch.

### Node CLIs

Homebrew installs vendor apps. Node CLIs are pinned projects under
`node-clis/`. Install copies a project to
`${XDG_DATA_HOME:-~/.local/share}/<dir>` and links that runtime's bin into
`~/.local/bin`. Nothing is installed inside the git checkout, and
`node_modules` is not committed.

Atomic and Harness load plugins from the `node_modules` directory beside
themselves. pnpm 11's global install does not lay packages out that way, so
these projects set `nodeLinker: hoisted`. Build-script approval is
`allowBuilds` in each project's `pnpm-workspace.yaml`; pnpm 11 does not read
that list from `package.json` or `.npmrc`. Gemini CLI and firecrawl-cli stay
here rather than in Homebrew: Gemini's formula is deprecated upstream, and
firecrawl-cli has no formula. `@sidwood/timecraft` still needs the stowed npmrc.
`op run` resolves the GitHub token only when it is not already loaded
from `~/.config/shell/local.env`.

```bash
node-cli-update atomic 0.9.25
```

That sets the exact version in `node-clis/<tool>`, rewrites the lockfile
there, and reinstalls the runtime. It does not commit, and it does not call
Atomic's or Harness's own upgrade command. Refresh `defaults.md` or
`defaults.web.cordis.yml` from the installed release before committing a
version change.

### DeepSeek Harness

Select **Set up mise with default runtimes**, **Install DeepSeek Harness with
portable defaults**, and **Symlink dotfile packages with GNU Stow** in
`./install.sh` on each Mac. Existing compatible Node installations can skip
mise. Harness requires Node.js 22.19+ on the 22.x line, or Node.js 24+;
Homebrew already supplies mise, so no additional Brewfile entry is needed.

The pinned project is `node-clis/deepseek-harness` at CLI `0.1.5-rc.1`. The
runtime is `${XDG_DATA_HOME:-~/.local/share}/deepseek-harness`, linked as
`~/.local/bin/dsh`. There is no launcher wrapper, Python environment, model
download, or background service.

```bash
cd ~/code/your-project
dsh web
```

The browser UI listens on `127.0.0.1:3080` by default. Use `dsh web --no-open`
to suppress opening the browser; stop the server with Ctrl-C. Add a workspace
and configure a provider in **Settings → Models**. DeepSeek uses a DeepSeek
API key; other built-in providers need their own API credentials. The current
Harness UI does not support Codex OAuth/subscription sign-in.

For LM Studio on a capable Mac, add a custom provider with protocol
`openai-completions`, base URL `http://127.0.0.1:1234/v1`, and the server's API
key (`local` for this Mac's unauthenticated server), then fetch its models.
Leave it unconfigured on a cloud-only laptop. Provider choices and credentials
are local to each Mac; installing Harness does not enable a local-model default.

Configuration has three parts:

- `dsh/.config/dsh/settings.yaml` is the portable starter, currently `{}` to
  retain upstream defaults. Installation copies it to `~/.dsh/settings.yaml`
  only when absent, leaving existing settings untouched on later runs.
- `dsh/.config/dsh/defaults.web.cordis.yml` records the installed release's
  composed Web profile, captured with `dsh web --dump-default-config`. It is
  a reference snapshot, not an active override; plugin schema defaults are
  documented in the upstream configuration catalog.
- `~/.dsh/` remains a real, machine-local directory for editable settings,
  credentials, profiles, sessions, and workspace state. Harness replaces its
  settings document atomically, so it must not be symlinked into the repo.

`DSH_HOME` overrides `~/.dsh` for installation, running, and removal; use the
same value for all three. Global instructions link to the canonical agent
memory at `$DSH_HOME/AGENTS.md`. Harness discovers `~/.agents/skills` itself.

To share a later preference, copy only its relevant, non-secret settings into
the tracked starter after reviewing the diff. Existing machines need those
changes merged into their local settings; reinstallation deliberately does not
reset them. Never copy `.credentials.yaml`, `.env`, conversations, or the
entire Harness home into dotfiles.

`./uninstall.sh` has a separate Harness option that removes only its managed
runtime, executable link, and shared-memory link. It preserves `~/.dsh` settings,
credentials, and sessions. The Stow removal option removes the starter links.
Stop running Harness processes before uninstalling or upgrading.

References: [official quick start](https://github.com/deepseek-ai/deepseek-harness#run),
[model configuration](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/providers.md),
[CLI reference](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/reference/README.md),
and [plugin configuration catalog](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/config-catalog.md).

### Atomic

Select **Install Atomic with portable defaults** in `./install.sh`, along with
mise for Node.js and Stow for the reference files. The pinned project is
`node-clis/atomic` at CLI `0.9.25`. Node.js 22.19 or newer is required; the
existing Homebrew/mise setup supplies it, so Atomic needs no new Brewfile entry.

The runtime lives at `${XDG_DATA_HOME:-~/.local/share}/atomic`, with its
executable linked as `~/.local/bin/atomic` on the existing PATH. Installation
starts no background service and downloads no local models.

```bash
cd ~/code/your-project
atomic
```

Use `/login` for a supported provider login, `/model` to select a model, and
`/settings` for preferences. Provider credentials and project trust decisions
are configured on each Mac. Local OpenAI-compatible endpoints such as LM Studio
can be declared in `~/.atomic/agent/models.json`; no local provider is enabled
by the dotfiles starter, so the cloud-only laptop uses the same installation.

- `atomic/.config/atomic/settings.json` is the portable starter, currently `{}`
  to retain upstream defaults; it is copied to `~/.atomic/agent/settings.json`
  only when absent. Reinstallation preserves existing settings and symlinks.
- `atomic/.config/atomic/defaults.md` captures the default-setting tables from
  the installed release's documentation for reference, not as active overrides.
- `~/.atomic/agent/` remains machine-local: logins (`auth.json`), model choices,
  trust decisions, sessions, installed extensions, and workflow state stay there
  or in Atomic's project state. Its settings file is not linked into the repo,
  because interactive changes save model choices and other local values.

Global instructions link from `~/.atomic/agent/AGENTS.md` to the shared agent
memory. Atomic discovers `~/.agents/skills` itself. Its built-in workflows and
extensions stay bundled with the locked release rather than copied into dotfiles.

`ATOMIC_CODING_AGENT_DIR` overrides the agent directory; Atomic also accepts
`PI_CODING_AGENT_DIR` as a legacy fallback. For installer/uninstaller overrides,
use an absolute path and the same environment when launching Atomic. Without an
override, Atomic can read compatible legacy `~/.pi/agent/` settings as a fallback.

Promote later preferences by copying only reviewed, non-secret settings into
the starter and merging them into existing machines explicitly. Refresh
`defaults.md` from the installed package's `docs/settings.md` when the pinned
release changes. Updating the core through Atomic itself would bypass the
repository's lockfile.

The Atomic option in `./uninstall.sh` removes its managed runtime, executable
link, and shared-memory link while preserving settings, logins, sessions, and
project state. Stow removal removes the starter/reference links. Stop Atomic
before upgrading or uninstalling. Atomic's own `uninstall` subcommand removes
extensions; use the dotfiles script to remove the runtime.

References: [official setup](https://bastani.ai/),
[settings](https://docs.bastani.ai/settings), and
[custom models](https://docs.bastani.ai/models).

#### goal-select workflow

`atomic/.atomic/agent/workflows/goal-select.ts` is the builtin Goal Runner with
a model choice per role, registered through
`atomic/.atomic/agent/extensions/workflow/config.json`. By default it works in
a new `git bc-add` branch clone beside the invoking checkout and rereads a
JSONC model policy before every turn.

The policy is a preset from the shared library at
`~/.config/atomic/goal-select-models/`, stowed from this repo and shared by
every project, checkout and branch clone: `sol-astra.json` (the default),
`kimi-astra.json`, `kimi-opus.json`, `kimi-sol.json`,
`grok-opus.json`, `grok-astra.json`, `grok-sol.json`,
`glm-grock.json`, `glm-astra.json`, `glm-sol.json`, `opus-sol.json`,
`sol-opus-astra.json`, `opus-fable.json`, `sol-fable.json` and `opus-astra.json`.
Each preset pins the six role models and `max_turns: 10`.
The launch form's `model_policy_path`
defaults to the installed `sol-astra.json` path; pick another preset by
editing only the filename in that field, and add one by dropping another JSON
or JSONC file into the directory — no list to update. An explicit absolute or
relative path, including a legacy project-local
`.atomic/goal-select-models.json` or `.jsonc`, is still read exactly as
given.

`grok-opus.json` replaces the former `grok-kimi.json`: Grok 4.7 implements
and orchestrates at high effort, with Opus 5.5 reviewing at high effort and
xhigh for risk. `sol-opus-astra.json` is for complicated work: Sol 6.1
orchestrates at high, Opus 5.5 implements at xhigh, and Astra reviews at xhigh
for completion and risk, with high for evidence and the shared reviewer fallback.

The launch form's model inputs and `max_turns` are prefilled from the shared
default preset. Atomic has no per-launch default hook: input defaults are the
values the workflow module computes when Atomic discovers workflows, at
session start or `/workflow reload`. After editing the preset, run
`/workflow reload` to refresh the form; turns still reread the file.
`model_policy_path` does not affect the form, and missing, malformed or
wrongly typed values keep the built-in defaults.

A writer whose provider fails (no credit, a usage limit, an outage) moves down
the policy's `writer_fallbacks` chain for its model line. Atomic alone would
move a delegated agent onto the orchestrator's model, so each orchestrator
stage carries a fallback gate its agents inherit: none falls back onto the
orchestrator's model, onto a model line that reviews or re-verifies the turn,
or onto the launching session's model while the policy names no
`reverify_model`. After the stage the workflow reads each agent's transcript:
the model it asked for, the models that ran, and those that wrote files of the
checkout (an accepted edit or write to a file Git does not ignore; writing
done only through the shell is not seen). When a writer's model failed it
continues the turn in a further stage (`orchestrator-<turn>-continued-<n>`) on
the next model the tier allows; with no fallback left the run ends failed and
resumable, and a resume continues that turn from the launch writer. The goal
ledger (`delegations`, `writer_moves`) and the receipt record all of it.

The run closes `needs_human` before any reviewer starts when a model line on
the turn's panel wrote files, in that turn or an earlier one and whatever
model the agent was asked for, and when what a writer did cannot be read.
Resuming a run closed for a reviewer's own line reads the turn's policy again
and closes again unless the panel no longer holds that line; resuming one
closed for an unread writer reads the evidence again and then sends the turn
to review. A project policy without `writer_fallbacks` inherits the shared
file's; a malformed one stops the run.

Atomic starts workflow stages without switching on its `codemode` MCP
discovery tool, so a stage cannot reach MCP tools that ordinary sessions
reach. `atomic/.atomic/agent/extensions/goal-select-mcp-discovery.ts` turns
`codemode` on in goal-select's own stages, including delegated agents without
a tool allowlist, when a configured server uses `codemode` exposure. Explicit
exclusions, allowlists, `-builtin:codemode` and `"autoEnableCodemode": false`
still win, and other workflows are unaffected.

Set `tracker` to `jira` or `linear` to take the work from one issue instead of
`objective`. `tracker_issue` takes a key, URL or search words, and
`tracker_mcp_server` overrides the MCP server (`atlassian` or `linear`).
Tracker intake needs:

- the tracker's MCP server in Atomic's native `~/.atomic/agent/mcp.json` or a
  trusted project's `.atomic/mcp.json`, or contributed by a package or
  extension, and signed in with `/mcp login <server>`;
- `atomic/.atomic/agent/extensions/goal-select-tracker-guard.ts`, which Stow
  links into `~/.atomic/agent/extensions`. Intake stages are named after the
  tracker and server, such as `goal-select-tracker-intake-jira-atlassian`, and
  may call only the guard, `tool_search` and that server's three native read
  tools, such as `mcp__atlassian__getJiraIssue`. The guard blocks every other
  call, and every call before its probe, before the call runs. It does
  nothing in any other session. A stage with no MCP access must show the
  guard active before an intake stage can reach MCP.

The issue is fetched read-only and saved to
`<checkout>/.atomic/goal-select/work/<tracker>-<key>-<id>.md`, beside a
`.gitignore` that keeps it out of Git. The snapshot keeps the server's complete
response, even when Atomic shortened it for the model. The Goal objective and
acceptance criteria point at that snapshot, so implementing and reviewing
agents need no tracker access; typed `acceptance_criteria` replace the issue's
own. A server with `"enabled": false`, an unreachable server, a missing issue,
an inactive guard or a stopped choice ends the run before any Goal stage, never
falling back to `objective`. Pass a key or URL for headless runs: search words
and an empty `tracker_issue` wait for an answer. `resolve_only` checks only the
native MCP config files and the guard file.

After changing these files, run `/reload` and `/workflow reload`, or restart
Atomic. Runs already in progress keep the code they started with.

### Unified Shell Config

The `shell/` package provides configuration sourced from zsh:

- `~/.config/shell/aliases` - Common aliases
- `~/.config/shell/functions` - Utility functions
- `~/.config/shell/init` - Tool integrations (mise, zoxide, fzf)

### OpenCode: local and Framework models

`c` and `cm` are plain aliases for `opencode`. The enabled LM Studio profile
also lists Framework models in `/models`; no wrapper is needed after Lemonade's
LAN client-key removal is applied. `cf` is the retained legacy launcher.
The enabled configuration selects the local or cloud model. Start a new shell after
updating to pick up the changed aliases.

The CLI is `opencode-ai@1.18.20`, installed by **Install pinned Node CLIs**,
not Homebrew. Its runtime directory is `opencode-cli`, not `opencode`, so it
does not occupy OpenCode's own data directory. On a Mac that already has the
Homebrew formula, `brew uninstall opencode` so `~/.local/bin/opencode` is the
only one.

The shared `opencode.jsonc` intentionally selects no provider or default model.
It loads `tool-awareness.md` to ground capability claims in actual tool calls
and distinguish approval prompts from missing tools; permissions are unchanged.
Shell init enables OpenCode's optional Exa web search, experimental LSP and plan
tools, and CLI question tool without a launcher or blanket experimental mode.
The local-worker role permits task delegation and questions. Ordinary Build file,
shell, editing and web-fetch tools remain enabled; external-directory and sensitive
file approval guards remain. Search queries go to Exa's hosted service; local
model inference still goes to the selected LAN/localhost server. LSP operations
require a language server for the current file type. Model-specific patch versus
edit/write selection remains OpenCode's responsibility. Restart OpenCode from a
new shell after updating so the feature flags and instructions take effect.
On a Mac that runs local models, select **Enable LM Studio models in OpenCode
on this Mac** in `install.sh`, alongside the Stow option. This creates a
machine-local `~/.config/opencode/opencode.json -> lmstudio.json` symlink;
future dotfiles updates then update that profile automatically. The installer
preserves existing custom configuration instead of overwriting it.

On a cloud-only Mac, leave that option off: OpenCode keeps using that machine’s
connected providers and saved model choices. Its credentials and model history
are not shared by Stow. To skip installing the LM Studio app as well, run
`HOMEBREW_BUNDLE_CASK_SKIP=lm-studio ./install.sh`. To disable a previously
enabled local profile, remove only the `opencode.json` symlink that points to
`lmstudio.json`; preserve any custom regular configuration file.

```sh
lms server start --port 1234
c
c run "Explain this project"
c --model lmstudio/qwen/qwen3.8-27b
c models lmstudio
c models framework
c --model framework/Qwen3.8-27B-GGUF-UD-Q5_K_XL-128K
c --model framework/Qwen3.5-122B-A10B-GGUF
```

The Homebrew installation option includes the `lm-studio` cask; no standalone
MLX Python environment is installed.

LM Studio manages its own MLX and llama.cpp runtimes and model loading. The
local endpoint is `127.0.0.1:1234`; start it in LM Studio or with `lms` before
selecting a local model. Qwen3.8 Flash Next is the configured local default (see
below); Gemma and the 27B stay listed. Model IDs and context
limits and the allowed-model list live in
`opencode/.config/opencode/lmstudio.json`; match those limits to
the context actually loaded in LM Studio. Listing a model does not mean it is
loaded. Local API authentication is currently disabled.

Control Gemma’s thinking toggle in LM Studio. OpenCode’s generated
`low`/`medium`/`high` effort presets are disabled for this model because it
does not support those levels.

The combined local profile disables automatic title generation, retaining the
Framework's single-request safeguard without depending on a separate Mac helper.
Sessions can be named manually; `--title` names a CLI session explicitly. The optional
`--agent local-worker` role also inherits the selected model. Launchers never
request cloud reviews or run remediation; orchestration belongs to the harness
or a future Atomic workflow. The standalone `frontier-review` utility remains
available for deliberate use.

#### MCP connectors: Linear and Granola

The shared `opencode.jsonc` registers two remote MCP servers: Linear at
`https://mcp.linear.app/mcp` and Granola at `https://mcp.granola.ai/mcp`. Both
authenticate with OAuth and dynamic client registration, so the repository
holds no key or secret. Sign in once per Mac; the browser flow returns to a
local callback on port 19876:

```sh
opencode mcp auth linear
opencode mcp auth granola
opencode mcp list
```

Tokens live in `~/.local/share/opencode/mcp-auth.json`, which Stow does not
manage; `opencode mcp logout <name>` removes them. Until a server is
authenticated, `opencode mcp list` reports it as needing authentication and
its tools stay out of sessions. Tools arrive as `linear_*` and `granola_*`.
Linear also serves a read-only variant at `https://mcp.linear.app/mcp/readonly`;
switch the URL to keep sessions from writing to Linear. Granola's free plan
exposes only the last 30 days of personal notes; folder, search and transcript
tools need a Business plan.

Every MCP tool definition is sent with every request. Linear exposes dozens of
tools and Granola six, which is a real cost for local models (see the next
section on prompt size). To keep them out of ordinary sessions, disable them
globally and enable them only in the agents that need them, per the OpenCode
MCP documentation:

```jsonc
"tools": { "linear_*": false, "granola_*": false }
```

#### Web search for local models

Three pieces make the local Qwen search the web and cite what it finds: the
`local` agent in `agents/local.md`, which `lmstudio.json` makes the default
agent on this Mac, and the custom `web_search` and `web_fetch` tools in
`tools/`.
Everything below was measured on 2026-10-11 with OpenCode 1.18.20 and the
Framework's `Qwen3.8-27B-GGUF-UD-Q5_K_XL`, by routing the TUI through a
logging proxy so the exact requests could be replayed with one change at a time.

OpenCode's built-in `websearch` (Exa, enabled by `OPENCODE_ENABLE_EXA=1` in
shell init) is in every local session's tool list, yet under OpenCode's default
coding-agent prompt the model answered news questions with "I don't have web
search capabilities" in every variant tried: skills list removed, a directive
appended to `tool-awareness.md`, thinking on. The same request with a short
tool-aware system prompt in place of the default made it search, which is what
an agent `prompt` does. Sampled five times on the real request, the default
prompt scored 0, the committed `local` prompt 4, and with thinking on 5.

The agent denies the built-in `websearch` and allows `web_search` instead,
because the model picks a search tool by name: a custom tool called
`newssearch` was never chosen (0 of 5; it fetched Google result pages with
`webfetch` instead), the identical tool named `web_search` was chosen 5 of 5.
The tool exists because the model stamps its training year onto queries
("BND scandal 2025") whatever the instructions say, and Exa then returns that
year's stories. `web_search` strips bare years, queries Bing News and Google
News RSS (no key, no quota, every item dated), keeps the newest items inside a
date window computed at call time, trims each to a one-line excerpt, and falls
back to Exa's hosted MCP endpoint for topics without news coverage. Exa's free
tier allows about 150 calls a day; an `EXA_API_KEY` in the environment lifts
that for both the fallback and the built-in tool. The file imports the plugin
helper from `~/.config/opencode/node_modules` by absolute path because
OpenCode loads it from its real path inside this checkout, where no
`node_modules` exists.

`web_fetch` in `tools/web_fetch.ts` replaces the built-in `webfetch` in the
same agent for the same reason. The built-in returns the whole page as
markdown: the Guardian article the model fetched on 2026-10-11 came back as
16,617 characters, cut at the cap, with the article body never reaching the
model because the page chrome came first. `web_fetch` runs the pinned
`defuddle` CLI from `node-clis`, which extracted the same article as 7,886
characters with title, author and date; long articles page through `offset`,
and paywalls, blocks and script-only pages are reported as such so the model
falls back to the search excerpt instead of wasting a turn.

`lmstudio.json` also caps every tool result at 16 KB and 400 lines
(`tool_output`; the full text goes to OpenCode's tool-output directory and the
model gets a preview) and enables pruning of old tool outputs. Without the cap
one Exa result was 38k to 51k characters and a fetched homepage 51k, so a 64K
session overflowed after two searches and one fetch.

With all of that in place, a fresh session asked for "the most recent BND
scandal" found that week's arrest of the agency's former president, cited
sources inline and finished at 40% of a 64K context in 3 minutes 9 seconds on
the Framework's Q5 build. Tab switches to the stock Build agent, which keeps
the built-in `websearch`. Thinking is off for the Framework profiles for speed;
it is the knob if reliability matters more.

The same task on this Mac against LM Studio's 6-bit MLX build of the same
model, `lmstudio/qwen/qwen3.8-27b`, with thinking on, did better: 1 minute 42
seconds and 22.1k tokens at a 131,072-token context, 2 minutes 2 seconds and
24.2k tokens at 262,144, with one or two searches and two or three fetches each
time, the same story cited from five sources, and the engine process steady at
23 GB. Thinking cost only a few seconds per step and the model chose `maxChars`
on its fetches, which the Framework build never did. The 4-bit build was not
measured. LM Studio loads a model at its per-model default context, 8,192
unless changed in the model's Load settings, and the `local` agent's requests
are about 20k tokens before the user's message, so set that default to 262,144
to match the limit declared in `lmstudio.json`; `lms load qwen/qwen3.8-27b -c
262144 --gpu max` does the same for a single load.

Sampling comes from LM Studio too, since OpenCode sends no temperature or
top-p to local providers. Loading from the LM Studio UI applies the model's
shipped generation defaults, which for Qwen3.8 in thinking mode are the
model card's recommendation: temperature 1.0, top_p 0.95, top_k 20, min_p 0,
presence_penalty 0 (0.7, 0.8, 20, 0 and 1.5 with thinking off; never greedy,
which loops). `lms load` instead applies LM Studio's generic default of
temperature 0.8. The two runs above were CLI loads at 0.8; a third run at the
UI defaults took 2 minutes 20 seconds and 24.1k tokens with one search and two
fetches, the same depth and the same story, plus one mangled URL in its
citations that the cooler runs did not produce. Both settings work; the UI
default is the one the model's authors recommend.

#### Qwen3.8 Flash Next

`lmstudio/qwen3.8-flash-next` is unsloth's `Qwen3.8-Flash-Next-UD-Q3_K_XL`
GGUF (90.9 GB on disk, 84.7 GiB loaded on the llama.cpp backend, vision and
tool use) and the profile's default model since 2026-10-14. It thinks by
default and streams `reasoning_content`, which OpenCode shows as thought
steps; the effort presets are disabled as for Gemma. The declared context is
131,072, not the model's 262,144: on this 128 GB Mac `lms load
--estimate-only` puts the load at 92.4 GiB for 131,072 and 97.6 GiB for
262,144, and with the model at LM Studio's 8,192 default the Mac had 14%
memory free and had already paged out. The "high" guardrail estimate says the
model fails to load at any context, including the 8,192 it loads at from the
UI; `lms load qwen3.8-flash-next -c 131072 --gpu max` succeeded in 9 seconds
regardless. The per-model default for UI loads is
`~/.lmstudio/.internal/user-concrete-model-default-config/qwen3.8-flash-next.json`,
written by analogy with the 27B's file beside it and set to 131,072 so the two
limits match; it has not yet been confirmed by a UI load.

Asked for the most recent UK Budget news from a fresh `local` session, it ran
two `web_search` calls, no fetch, and answered in 41 seconds at 17.8k tokens
with six dated article URLs from that day and the day before. Asked next to
read the Guardian article it had cited, it called `web_fetch` once, which
returned the 541-word article with title, authors and date, and summarised it
in 19 seconds, finishing the two-turn session at 19.4k tokens.

#### Finding local models in the TUI

The provider is named **LM Studio (local)**. OpenCode 1.18.30 moves recent and
favorite models out of their provider section to avoid duplicate entries. Once
all three local models are recent, that section has no remaining entries and is
hidden. This is TUI behavior, not a missing provider definition, and it has no
configuration switch. In `/models`, type `LM Studio` to see all three models with
their provider label. Clearing recent history would restore the section only
until those models were selected again.

#### Framework configuration

The active `lmstudio.json` includes **LM Studio (Framework)** using provider ID
`framework-lmstudio` at `http://100.122.72.1:1234/v1` over Tailscale. Its model is
`framework-lmstudio/qwen3.8-flash-next@q3_k_xl`, displayed as
**Qwen3.8 Flash Next Q3**. The Mac-local default and models are preserved.
Start plain `c`, open `/models`, and search for `Framework`; a recently used
model appears in Recent instead of a separate provider group. Positional
arguments are project directories, not profile selectors.

The Framework API is bound to its Tailscale address and requires no API key;
the client value `local` is a dummy matching the Mac provider. No public endpoint,
SSH tunnel, `op run`, credential environment or launcher is required. The retired
Lemonade `framework` provider and its three models were removed from this active
configuration; stored conversations and model history are preserved.

The retired `cf` launcher and its Lemonade configuration have been removed.
Use `c` for both machines and select the desired LM Studio provider in `/models`.
All `opencode` arguments pass through `c` and `cm` unchanged.

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
  [x] Uninstall DeepSeek Harness (keep settings and sessions).
  [x] Uninstall Atomic (keep settings and sessions).
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
├── ~/.dsh/AGENTS.md                         # DeepSeek Harness
├── ~/.atomic/agent/AGENTS.md                # Atomic
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
