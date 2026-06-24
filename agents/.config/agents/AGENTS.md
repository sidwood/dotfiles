# Global agent memory

## Git branch clones (`git bc-*`)

Git subcommands on `$PATH` via `~/.local/bin`. A `git worktree` alternative: each
branch gets a full local clone, hardlinked from the seed clone -> instant, ~0 disk.

- `git bc-add <source> <branch>` — clone `<source>` -> `<source>.<branch>`,
  repoint `origin` at the real remote, check out branch
- `git bc-list` — clones with status, branch, ahead/behind; `--pr` adds PR state
- `git bc-rm <dir>` — remove one clone
- `git bc-prune` — remove clones whose PRs merged/closed
- `git bc-sync-extras` — re-copy gitignored local files from the seed

`-h` for usage; `--help` hits git's man page lookup. Aliases `gbc gbca gbcp gbcr
gbcs`; `gbcd` fzf-picks a clone and cds in.

Clone marker: `bc.source` in local git config. `bc-rm`/`bc-prune` refuse base
clones, dirty trees, and clones holding commits found nowhere else — prefer them
to `rm -rf`.

Per-repo config on the base clone: `bc.postadd` (cmd run in each new clone, eg
`mise install && npm ci`), `bc.extras` (extra copy patterns, repeatable).

Source: `~/code/dotfiles/bin/`.
