# Atomic 0.9.20 default settings

Captured from the settings reference shipped in `@bastani/atomic@0.9.20`.
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
| `routerModel` | string | `""` | Inference model for workflow-stage and subagent `model: "auto"` selection only. An exact `provider/model` selects a registered chat or classifier model. `auto` and empty use the current chat model. Does not change chat or `structured_output` tool inference. |
| `defaultThinkingLevel` | string | - | Startup thinking level, saved automatically on interactive model/thinking changes: `"off"`, `"minimal"`, `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"`; clamped to the active model's supported levels |
| `modelThinkingLevels` | object | - | Per-model startup thinking levels keyed by `"provider/modelId"`; updated automatically on interactive model/thinking changes, or configured from `/settings` → Default thinking level per model |
| `hideThinkingBlock` | boolean | `false` | Hide thinking blocks in output |
| `thinkingBudgets` | object | - | Custom token budgets per thinking level. Anthropic, Google, and Bedrock use these natively. OpenAI-compatible models use them when `compat.thinkingTokenBudgetField` (or `supportsThinkingTokenBudget`) is set. |
| `showCacheMissNotices` | boolean | `false` | Show transcript notices for significant prompt-cache misses, billed compaction or branch-summary usage, and provider recovery diagnostics such as dropped Anthropic thinking blocks, including when a persisted transcript is resumed |
| `fallbackModels` | string[] | - | Ordered fallback models, written as `"provider/model"` with optional model-supported reasoning suffixes such as `:high`, `:xhigh`, or `:max`. Used by main-chat turns and, since compaction fallback rungs, borrowed for compaction planner requests |

### UI & Display

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `theme` | string | `"dark"` | Theme name (`"dark"`, `"light"`, a Catppuccin built-in, or custom) |
| `fullscreenScrollbar` | string | `"auto"` | Fullscreen transcript scrollbar: `"auto"` shows it temporarily while scrolling, `"always"` reserves the rightmost transcript column and keeps it visible, and `"hidden"` hides it. The thumb can be dragged when shown. |
| `fullscreenExitOutput` | string | `"transcript"` | Fullscreen exit output: `"transcript"` prints the final transcript and session resume hint, while `"resume-hint"` restores the terminal's previous screen and prints only the resume hint. Settable from `/settings` |
| `fullscreenCopyOnSelect` | boolean | `true` | Copy fullscreen text selections automatically on mouse release. When `false`, selection only highlights text. Ctrl+X does not copy; `/copy` copies the last assistant message. Settable from `/settings` |
| `quietStartup` | boolean | `false` | Hide startup header |
| `defaultProjectTrust` | string | `"ask"` | Fallback project trust behavior: `"ask"`, `"always"`, or `"never"`. Global setting only |
| `collapseChangelog` | boolean | `false` | Show condensed changelog after updates |
| `enableInstallTelemetry` | boolean | `true` | Send a version-adoption ping on the first interactive launch with fresh settings, and on the first interactive launch after an update whose version has changelog entries. This does not control update checks |
| `firstRunOnboardingStartedVersion` | string | - | Managed onboarding state; leave unchanged |
| `onboardedVersion` | string | - | Managed onboarding completion state; leave unchanged |
| `enableAnalytics` | boolean | `false` | Opt in to analytics during first-run setup |
| `trackingId` | string | - | Locally generated analytics identifier when analytics is enabled |
| `doubleEscapeAction` | string | `"tree"` | Action for double-escape: `"tree"`, `"fork"`, or `"none"` |
| `treeFilterMode` | string | `"default"` | Default filter for `/tree`: `"default"`, `"no-tools"`, `"user-only"`, `"labeled-only"`, `"all"` |
| `editorPaddingX` | number | `0` | Horizontal padding for input editor (0-3) |
| `outputPad` | number | `1` | Horizontal padding for chat message output (user messages, assistant messages, thinking blocks). `0` or `1` |
| `externalEditor` | string | - | Command for the Ctrl+G external editor; takes precedence over `$VISUAL`/`$EDITOR`. Defaults to Notepad on Windows and `nano` elsewhere |
| `autocompleteMaxVisible` | number | `5` | Max visible items in the default editor and custom editors installed through `ctx.ui.setEditorComponent()` (3-20) |
| `showHardwareCursor` | boolean | `false` | Show the terminal cursor while TUI positions it for IME support |

### Network proxy

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `httpProxy` | string | - | HTTP proxy URL applied as `HTTP_PROXY` and `HTTPS_PROXY`. Global setting only. |

### Warnings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `warnings.anthropicExtraUsage` | boolean | `true` | Show a warning when Anthropic subscription auth may use paid extra usage |

### Compaction

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `compaction.enabled` | boolean | `true` | Enable automatic verbatim line compaction |
| `compaction.reserveTokens` | number | `16384` | Tokens reserved for the next model response; automatic threshold compaction begins before this reserve is consumed |
| `compaction.compression_ratio` | number | `0.5` | Fraction of compactable transcript **lines to keep** (`0 < value < 1`) |
| `compaction.preserve_recent` | number | `2` | Exact number of newest context-visible messages kept outside the compactable region; `0` keeps none |
| `compaction.query` | string | last user message | Optional relevance focus for selecting older lines to retain |
| `compaction.modelOverrides` | object | `{}` | Exact `"provider/modelId"` keys with optional `reserveTokens` and `preserve_recent` overrides |

### Branch Summary

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `branchSummary.reserveTokens` | number | `16384` | Tokens reserved when selecting branch history; output is capped at 4096 tokens |
| `branchSummary.skipPrompt` | boolean | `false` | Skip "Summarize branch?" prompt on `/tree` navigation (defaults to no summary) |

### Session Summary

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `sessionSummary.enabled` | boolean | `true` | Generate a one-line summary of each session for the `/resume` picker once the agent goes idle |

### Retry

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `retry.enabled` | boolean | `true` | Enable automatic agent-level retry on transient errors |
| `retry.maxRetries` | number | `3` | Maximum agent-level retry attempts |
| `retry.baseDelayMs` | number | `2000` | Base delay for agent-level exponential backoff (2s, 4s, 8s) |
| `retry.maxAgentDelayMs` | number | `60000` | Maximum agent-level backoff delay (60s); `0` retries immediately |
| `retry.provider.timeoutMs` | number | SDK default | Provider/SDK request timeout in milliseconds |
| `retry.provider.maxRetries` | number | `0` | Provider/SDK retry attempts. Leave unset/`0` to let Atomic's agent-level retry handle transient failures |
| `retry.provider.maxRetryDelayMs` | number | `60000` | Max server-requested delay before failing (60s) |

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
| `streamDeadlineMs` | number or string | `300000` | Maximum idle gap between two provider stream events, enforced below the HTTP layer; accepts milliseconds, duration strings such as `30s`, `5m`, or `1h`, or `"disabled"`/`0` to disable. A stream that stalls without an error — for example a response body that fails to decompress — is cut at this deadline and retried or failed over instead of hanging the request. |

### Terminal & Images

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `terminal.showImages` | boolean | `true` | Show images in terminal (if supported) |
| `terminal.imageWidthCells` | number | `60` | Preferred inline image width in terminal cells |
| `terminal.clearOnShrink` | boolean | `false` | Clear empty rows when content shrinks (can cause flicker) |
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
| `bashInterceptor.enabled` | boolean | `false` | When true, block shell commands that have dedicated tools and offer remaining `bash` tool calls to `user_bash` extension handlers before local execution. Also available in `/settings` as **Bash Interceptor**. |
| `search.contextBefore` | number | `1` | Number of context lines before each `search` match. |
| `search.contextAfter` | number | `3` | Number of context lines after each `search` match. |
| `npmCommand` | string[] | - | Command argv used for npm package lookup/install operations (e.g., `["mise", "exec", "node@20", "--", "npm"]`) |

### Tools

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `defaultTools` | string[] | - | Built-in tools enabled at startup. When omitted, Atomic uses its standard defaults |

### Sessions

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `sessionDir` | string | - | Directory where session files are stored. Accepts absolute or relative paths, plus `~`. |

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
| `workflows` | string[] | `[]` | Local workflow file paths or directories |
| `enableSkillCommands` | boolean | `true` | Register skills as `/skill:name` commands |
