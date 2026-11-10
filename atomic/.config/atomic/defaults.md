# Atomic 0.9.76 default settings

Captured from the settings reference shipped in `@bastani/atomic@0.9.76`.
These tables are a reference snapshot, not an active settings file.
Unset model, authentication, and machine-specific values remain unset.

Upstream: https://github.com/bastani-inc/atomic/blob/main/packages/coding-agent/docs/settings.md

### Herdr

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `herdr.enabled` | boolean | `true` | Enable the built-in reporter in an eligible Herdr pane. Set to `false`, then reload or restart to opt out. Requires `mode: "tui"`, a UI, and the Herdr environment variables. Child sessions and other modes never claim. |

### Model & Thinking

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `defaultProvider` | string | - | Startup provider, saved automatically when you switch models interactively |
| `defaultModel` | string | - | Startup model ID, saved automatically when you switch models interactively |
| `decisionModel` | string | `""` | The model every decision uses: `model: "auto"` selection for workflow stages and subagents, `structured_output` calls that name no model, readiness after a steer, and `decide()`. An exact `provider/model` selects a registered chat or classifier model. `auto` and empty use the current chat model. Does not change the chat model. See [decisionModel](#decisionmodel). |
| `modelRouting` | object | `{}` | Provider and model filters for the models `model: "auto"` may select: `allowedProviders` and `excludedProviders` (provider ID arrays), `allowedModels` and `excludedModels` (model ID or glob pattern arrays). Does not change `decisionModel`. See [modelRouting](#modelrouting). |
| `defaultThinkingLevel` | string | - | Startup thinking level, saved automatically on interactive model/thinking changes: `"off"`, `"minimal"`, `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"`; clamped to the active model's supported levels |
| `modelThinkingLevels` | object | - | Per-model startup thinking levels keyed by `"provider/modelId"`; updated automatically on interactive model/thinking changes, or configured from `/settings` → Default thinking level per model |
| `hideThinkingBlock` | boolean | `false` | Hide thinking blocks in output |
| `thinkingBudgets` | object | - | Custom token budgets per thinking level. Anthropic, Google, and Bedrock use these natively. OpenAI-compatible models use them when `compat.thinkingTokenBudgetField` (or `supportsThinkingTokenBudget`) is set. |
| `showCacheMissNotices` | boolean | `false` | Show transcript notices for significant prompt-cache misses, billed compaction or branch-summary usage, and provider recovery diagnostics such as dropped Anthropic thinking blocks, including when a persisted transcript is resumed |
| `cacheWarming` | `"off" \| "streaming" \| "idle"` | `"idle"` | Keep eligible provider prompt caches warm during active runs and, with `"idle"`, for up to 30 minutes between runs. `"streaming"` warms only during active runs; `"off"` never warms. Each refresh costs money. Global setting only; project settings are ignored. |
| `fallbackModels` | string[] | - | Ordered fallback models, written as `"provider/model"` with optional model-supported reasoning suffixes such as `:high`, `:xhigh`, or `:max`. Used by main-chat turns and, since compaction fallback rungs, borrowed for compaction planner requests |

### UI & Display

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `theme` | string | `"dark"` | Theme name (`"dark"`, `"light"`, `"system"`, a Catppuccin built-in, or custom). `"system"` derives its palette from the terminal; see [Themes](/themes) |
| `fullscreenScrollbar` | string | `"auto"` | Fullscreen transcript scrollbar: `"auto"` shows it temporarily while scrolling, `"always"` reserves the rightmost transcript column and keeps it visible, and `"hidden"` hides it. The thumb can be dragged when shown. Attached workflow chats and `/tasks` transcripts show the same scrollbar, without dragging. |
| `fullscreenExitOutput` | string | `"transcript"` | Fullscreen exit output: `"transcript"` prints the final transcript and session resume hint, while `"resume-hint"` restores the terminal's previous screen and prints only the resume hint. Settable from `/settings` |
| `fullscreenCopyOnSelect` | boolean | `true` | Copy fullscreen text selections automatically on mouse release. When `false`, selection only highlights text. Ctrl+X does not copy; `/copy` copies the last assistant message. Settable from `/settings` |
| `fullscreenWheelScrollLines` | `"auto"` or number | `"auto"` | Lines per mouse-wheel tick in fullscreen views, including attached workflow chats and `/tasks` transcripts. `"auto"` uses terminal-aware scrolling; numeric values are clamped to 1–100. Settable from `/settings` |
| `quietStartup` | boolean or `"header"` | `false` | `true` hides the startup header. `"header"` keeps the startup header but hides the model scope line |
| `defaultProjectTrust` | string | `"ask"` | Fallback project trust behavior: `"ask"`, `"always"`, or `"never"`. Global setting only |
| `collapseChangelog` | boolean | `false` | Show a one-line update notice after updates instead of the What's New highlights; `/changelog` shows the full changelog |
| `enableInstallTelemetry` | boolean | `true` | Send a version-adoption ping on the first interactive launch with fresh settings, and on the first interactive launch after an update whose version has changelog entries. This does not control update checks |
| `firstRunOnboardingStartedVersion` | string | - | Managed onboarding state; leave unchanged |
| `onboardedVersion` | string | - | Managed onboarding completion state; leave unchanged |
| `teamJoin` | object | - | Managed record of the `storage` value `atomic team join` wrote. `atomic team leave` removes `storage` only while it still matches; leave unchanged |
| `enableAnalytics` | boolean | `false` | Opt in to analytics during first-run setup |
| `trackingId` | string | - | Locally generated analytics identifier when analytics is enabled |
| `deviceId` | string | - | Managed global installation identity, created only when a provider sign-in needs it. Project values are ignored |
| `doubleEscapeAction` | string | `"tree"` | Action for double-escape: `"tree"`, `"fork"`, or `"none"` |
| `treeFilterMode` | string | `"default"` | Default filter for `/tree`: `"default"`, `"no-tools"`, `"user-only"`, `"labeled-only"`, `"all"` |
| `editorPaddingX` | number | `0` | Horizontal padding for input editor (0-3) |
| `outputPad` | number | `1` | Horizontal transcript padding for messages, tool output, `!` command output, and summary blocks. `0` or `1` |
| `externalEditor` | string | - | Command for the Ctrl+G external editor; takes precedence over `$VISUAL`/`$EDITOR`. Defaults to Notepad on Windows and `nano` elsewhere |
| `autocompleteMaxVisible` | number | `5` | Max visible items in the default editor and custom editors installed through `ctx.ui.setEditorComponent()` (3-20) |
| `showHardwareCursor` | boolean | `false` | Use the terminal cursor instead of Atomic's drawn cursor. Atomic still positions it for IME support |

### Debug mode

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `debug` | boolean | `false` | Turn on every debug output and write it to the debug log that `/debug` shows. Shown as **Debug mode** in `/settings`. Global setting only |

### Network proxy

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `httpProxy` | string | - | HTTP proxy URL applied as `HTTP_PROXY` and `HTTPS_PROXY`. Global setting only. |

### Warnings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `warnings.anthropicExtraUsage` | boolean | `true` | Show a warning when Anthropic subscription auth may use paid extra usage |

### Intercom

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `intercom.showUnknownTargetWarnings` | boolean | `false` | Add a note to a queued workflow Intercom send whose target is outside the run's known and predicted stages. Delivery is the same either way |

### Compaction

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `compaction.enabled` | boolean | `true` | Enable automatic verbatim line compaction |
| `compaction.reserveTokens` | number | `16384` | Free context tokens below which automatic compaction starts; does not limit summary output |
| `compaction.compression_ratio` | number | `0.5` | Fraction of compactable transcript **lines to keep** (`0 < value < 1`) |
| `compaction.preserve_recent` | number | `2` | Exact number of newest context-visible messages kept outside the compactable region; `0` keeps none |
| `compaction.query` | string | last user message | Optional relevance focus for selecting older lines to retain |
| `compaction.planningTimeoutMs` | number or string | `300000` | Wall-clock limit on model planning in automatic compaction, covering every planner request, retry, overflow trim and borrowed fallback model and the credential lookups in between. When it runs out, post-tool and overflow compaction start a fresh context window so the turn continues, and threshold compaction fails without changing context. Accepts milliseconds, duration strings such as `5m`, or `"disabled"`/`0` to disable. See [Compaction](/compaction#planning-time-limit) |
| `compaction.modelOverrides` | object | `{}` | Exact `"provider/modelId"` keys with optional `reserveTokens` and `preserve_recent` overrides |
| `compaction.background` | boolean | `true` | Compact older context in the background while the agent keeps working; blocking compaction only on overflow or at the `reserveTokens` threshold when no background result is ready. `/settings`: **Background compaction**. See [Background compaction](/compaction#background-compaction) |
| `compaction.backgroundThresholdPercent` | number | `75` | Percentage of the context window at which background compaction starts; above 0 and below 100. `/settings`: **Background compaction threshold** (50, 60, 70, 75, 80 or 90). While either background setting holds an invalid value, Atomic reports a settings warning on load or `/reload` and runs with background compaction off and the 75% default, and `/settings` shows those values until you pick valid ones |
| `compaction.historyRecall` | boolean | `true` | Add a short `Recalled context` section to each compacted context: lines from this session's earlier history, the project's other sessions and workflow runs that match the current task, each with a `history://` source to `read`. It never adds more than 10% of the kept context or 1,500 tokens, gives up after 3 seconds, and leaves the compacted context unchanged on any failure. `false` turns it off. See [Recalled context](/compaction#recalled-context) |

### Branch Summary

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `branchSummary.reserveTokens` | number | `16384` | Tokens reserved when selecting branch history; the provider sizes summary output |
| `branchSummary.skipPrompt` | boolean | `false` | Skip "Summarize branch?" prompt on `/tree` navigation (defaults to no summary) |

### Session Summary

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `sessionSummary.enabled` | boolean | `true` | Generate a one-line summary of each session for the `/resume` picker once the agent goes idle |

### Resume

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `resume.setupCommand` | string | unset | Deprecated; remove it in favour of a blueprint. Kept for one release as an alias for one maintenance step of the global blueprint: the command runs in the root of each worktree restored on resume, or by a worker host for a pooled child, in a trusted project. A resume that builds a worktree prints a deprecation warning while it is set. Move the command into the `maintenance` section of `.atomic/blueprint.yaml`. Read from global settings only; a project's settings cannot set it. See [Set the environment up with a blueprint](/guides/resume-on-any-machine#set-the-environment-up-with-a-blueprint) |

### Snapshots

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `snapshots.enabled` | boolean | `true` | Record worktree snapshots so sessions and workflow runs resume with their repository state |
| `snapshots.includeUntracked` | boolean | `true` | Capture untracked files that no ignore rule or deny pattern excludes |
| `snapshots.maxFileBytes` | number | `5242880` | Largest file a snapshot captures, in bytes |
| `snapshots.maxSnapshotBytes` | number | `52428800` | Largest total of captured content, and largest unpushed-commit bundle, in bytes |
| `snapshots.fullEvery` | number | `10` | Restart the patch chain from `HEAD` after this many snapshots |
| `snapshots.autoCollect` | boolean | `true` | Delete snapshot content nothing retains when a session closes or a workflow run finishes |
| `snapshots.collectIntervalSeconds` | number | `3600` | Shortest time between two automatic collections of one database, in seconds |
| `snapshots.graceSeconds` | number | `3600` | Snapshot content stored or reused less than this many seconds ago is never collected; `0` turns this protection off |

### Retry

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `retry.enabled` | boolean | `true` | Enable automatic agent-level retry on transient errors |
| `retry.maxRetries` | number | `3` | Maximum agent-level retry attempts |
| `retry.baseDelayMs` | number | `2000` | Base delay for agent-level exponential backoff (2s, 4s, 8s) |
| `retry.maxAgentDelayMs` | number | `60000` | Maximum agent-level backoff delay (60s); `0` retries immediately |
| `retry.fallbackOnContentFilter` | boolean | `true` | Move to the next `fallbackModels` entry when a provider's content filter refuses a request (for example OpenAI's HTTP 422 `cyber_policy`), instead of retrying the same model. `false` retries the refusal on the same model and never falls back for it |
| `retry.provider.timeoutMs` | number | SDK default | Provider/SDK request timeout in milliseconds |
| `retry.provider.maxRetries` | number | `0` | Provider/SDK retry attempts. Leave unset/`0` to let Atomic's agent-level retry handle transient failures |
| `retry.provider.maxRetryDelayMs` | number | `60000` | Max server-requested delay before failing (60s); also caps how long an agent-level retry waits for a server retry hint |

### HTTP

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `httpIdleTimeoutMs` | number or string | `600000` | HTTP idle timeout as milliseconds, a duration such as `"30s"`, `"5m"`, or `"1h"`, or `"disabled"`. `0` also disables it. |

### Message Delivery

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `steeringMode` | string | `"one-at-a-time"` | How steering messages are sent: `"all"` or `"one-at-a-time"` |
| `followUpMode` | string | `"one-at-a-time"` | How follow-up messages are sent: `"all"` or `"one-at-a-time"` |
| `transport` | string | `"auto"` | Preferred transport for providers that support multiple transports: `"sse"`, `"websocket"`, `"websocket-cached"`, or `"auto"` |
| `httpIdleTimeoutMs` | number or string | `600000` | HTTP idle timeout in milliseconds, a duration string, or `"disabled"`; also used by providers with explicit stream idle timeouts. |
| `websocketConnectTimeoutMs` | number or string | `15000` | WebSocket connect/open handshake timeout; accepts milliseconds, a duration string, or `"disabled"`/`0` to disable. |
| `streamDeadlineMs` | number or string | `300000` | Maximum idle gap between two provider stream events, enforced below the HTTP layer; accepts milliseconds, duration strings such as `30s`, `5m`, or `1h`, or `"disabled"`/`0` to disable. A stream that stalls without an error — for example a response body that fails to decompress — is cut at this deadline and retried or failed over instead of hanging the request. Anthropic `ping` events count as activity, so a model that thinks silently while the server keeps the connection alive is not cut. |

### Terminal & Images

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `terminal.showImages` | boolean | `true` | Show images in terminal (if supported) |
| `terminal.imageWidthCells` | number | `60` | Preferred inline image width in terminal cells |
| `terminal.clearOnShrink` | boolean | `false` | Clear empty rows when content shrinks (can cause flicker). When unset, `ATOMIC_CLEAR_ON_SHRINK=1` enables it |
| `terminal.showTerminalProgress` | boolean | `false` | Show OSC 9;4 progress indicators in the terminal tab bar |
| `images.autoResize` | boolean | `true` | Resize oversized images to a 2000x2000 maximum. Applies to `@file` attachments, `read`, and images returned by tools |
| `images.blockImages` | boolean | `false` | Block all images from being sent to LLM |
| `terminal.hyperlinks` | boolean or `"auto"` | `"auto"` | JSON-only hyperlink capability override. `true`/`false` overrides detection; `"auto"`, omitted, and invalid values preserve detection. Not shown in `/settings` |
| `terminal.images` | `"kitty"`, `"iterm2"`, `"auto"`, or `false` | `"auto"` | JSON-only inline-image protocol override. `false` disables terminal images; `"auto"`, omitted, and invalid values preserve detection. Not shown in `/settings` |
| `terminal.trueColor` | boolean or `"auto"` | `"auto"` | JSON-only truecolor capability override. `true`/`false` overrides detection; `"auto"`, omitted, and invalid values preserve detection. Not shown in `/settings` |

### Shell

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `shellPath` | string | - | Custom Bash path (e.g., for Cygwin on Windows); does not select the PowerShell used by native Windows `!`/`!!` or the interactive subshell |
| `shellCommandPrefix` | string | - | Prefix for shell commands, including `!`/`!!`; use PowerShell syntax for native Windows interactive commands and Bash syntax elsewhere (e.g., `"shopt -s expand_aliases"`) |
| `search.contextBefore` | number | `1` | Number of context lines before each `search` match. |
| `search.contextAfter` | number | `3` | Number of context lines after each `search` match. |
| `npmCommand` | string[] | - | Command argv used for npm package lookup/install operations (e.g., `["mise", "exec", "node@20", "--", "npm"]`) |
| `selfUpdateCommand` | string[] | - | Command argv `atomic update` runs to update Atomic itself, with `{packageName}`, `{version}`, and `{installSpec}` placeholders. `ATOMIC_SELF_UPDATE_COMMAND` takes precedence. **Read only from the global settings file.** See [Custom update command](/reference/cli#custom-update-command) |

### Tools

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `defaultTools` | string[] | - | Initial built-in tools. Plain names replace the defaults; `+name` and `-name` add or remove tools |
| `codemode.mode` | `"on"` or `"only"` | `"on"` | While codemode is active, `"on"` keeps direct tool declarations visible with script-call information; `"only"` hides ordinary direct callable declarations so the model uses scripts. Model-only tools remain directly available |
| `codemode.inlineBudget` | number | `3000` | Estimated token budget for inline script-tool declarations. Omitted tools remain discoverable with `searchTools()`. `0` lists namespaces without inline declarations |

### Tasks

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `tasks.heartbeatMs` | number | `900000` | How often, in milliseconds, a running background shell or subagent sends its chat a [task heartbeat](/background-tasks#task-heartbeats). `0` turns heartbeats off; other values must be at least `60000`. An invalid value uses the default. A tool call's `heartbeatMs` overrides it for that task. |

### Sessions

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `sessions.storage` | object | Local SQLite | Session-only storage selection: `{ "path": "..." }`, `{ "dir": "..." }`, `{ "memory": true }`, or `{ "adapter": "...", "options": {}, "secrets": {}, "prefix": "..." }`. |
| `storage` | object | Local SQLite | Shared selection for sessions and workflow runs. Accepts the same forms except `dir`. |

### Models

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enabledModels` | string[] | - | Model patterns for CTRL+P cycling (same format as `--models` CLI flag). In interactive TTY startup, these patterns are resolved again after deferred extension/resource loading so extension-provided providers can match without blocking first paint. |

### Markdown

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `markdown.codeBlockIndent` | string | `"  "` | Indentation for code blocks |
| `markdown.mermaid` | string | `"streaming"` | Mermaid rendering mode: `"off"`, `"final"`, or `"streaming"` |
| `markdown.latex` | boolean | `true` | Render LaTeX expressions as terminal-friendly Unicode math |

### Resources

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `packages` | array | `[]` | npm/git packages to load resources from |
| `extensions` | string[] | `[]` | Local extension file paths or directories |
| `skills` | string[] | `[]` | Local skill file paths or directories |
| `prompts` | string[] | `[]` | Local prompt template paths or directories |
| `themes` | string[] | `[]` | Local theme file paths or directories |
| `workflows` | string[] or object | `[]` | Local workflow paths, or `{ "paths": [...] }`; see [Workflow storage](#workflow-storage) |
| `workflows.autoAdvanceAfterSteer` | boolean | `true` | After you steer a stage that asked you a question, the decision model advances the stage or keeps it open instead of asking "Are you ready to move on to the next stage?". It asks when it is unsure or fails. `false` always asks. Shown in `/settings` as **Auto-advance after steer**. Requires the object form of `workflows`. See [Readiness after a steer](/workflows/operations#readiness-after-a-steer) |
| `enableSkillCommands` | boolean | `true` | Register skills as `/skill:name` commands |
