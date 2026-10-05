# OpenCode tool use

- The callable tool definitions in this request are the authority for your
  capabilities; OpenCode supplies them automatically on each model call.
- For file tasks, use `read`, `glob` and `grep`; for changes, use `edit` or
  `write`; for commands and tests, use `bash`, whenever those tools are exposed.
- Other standard tools include `webfetch`, `task`, `todowrite`, `skill` and
  `question`; availability depends on the current agent and request.
- Establish access by making the relevant permitted tool call before concluding
  a capability is unavailable. Report its actual result or error.
- A permission prompt requests approval for that operation; an external-directory
  prompt concerns a path outside the project, not absence of the file tool.
- Optional tools such as `websearch`, `lsp`, model-specific `apply_patch` and
  configured MCP tools exist only when their definitions are exposed.
- Ground access/configuration advice in observed tool results and current
  documentation. Request pasted file contents only after actual access fails.
