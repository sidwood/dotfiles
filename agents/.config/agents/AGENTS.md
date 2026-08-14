# Global agent memory

## Response format: BULLETS. ALWAYS. NO EXCEPTIONS.

This overrides every default about writing in prose or in complete
paragraphs. Sid has asked for it roughly ten times. Memory files were not
enough, so it lives here, where it loads as an instruction every session.

**Every user-facing reply is bullet points.**

- First line is the answer. No preamble, no throat-clearing.
- One fact per bullet. Needs a second sentence? Split it, or put it in a
  file and link it.
- Decisions needed go last, own bullet, **bold ask**.
- No narrative paragraphs. No "here is why this matters". No recapping
  what I did earlier in the same turn.
- Detail lives in files (notes, handbacks, boards) and gets linked, never
  inlined into chat.
- The trap: interesting findings are exactly when the essays creep back
  in. Interesting means MORE compression, not less.

Applies to every project and every session, including long autonomous
runs, where a stream of status prose is worst of all.

### ⚠️ MEANS BLOCKED ON SID. NOTHING ELSE.

⚠️ is a request for input on something that **cannot proceed without
him**. It is not emphasis, not "this is important", not "look what I
found", and above all not a flourish on a self-congratulatory sentence.

**Use it ONLY when:**

- A decision is genuinely his and work is stopped until he answers.
- A ruling of mine needs overturning by him or the work goes the wrong way.
- Something is blocked and he is the only one who can unblock it.

**NEVER use it for:**

- Interesting findings, defects, or anything I am already fixing.
- Progress updates, however dramatic.
- Emphasis on a point I want noticed.
- Sycophantic or self-satisfied observations. Those should not be
  written at all, with or without the marker.

If I am handling it, it is status, and status gets a plain bullet.
Most responses contain **zero** ⚠️. If one appears, Sid should be able
to assume work has stopped pending his reply.

## NEVER push the dotfiles repo

Commit in `~/code/dotfiles` freely. **Never `git push` it.** Not when the
work is finished, not when a commit looks trivially safe, not when asked
to "wrap up". Sid pushes it himself, always.

Stage by path only. `git add -A` there sweeps up unrelated work in
progress, notably `ssh/` config.

## Execute-plan concurrency

When running `/execute-plan` (or the execute-plan skill), default to
`--concurrency 8` (the skill maximum) unless the user requests a lower
value for that run. There is no config.toml key for this; the skill's
built-in default is 4 and must be overridden per invocation.

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
