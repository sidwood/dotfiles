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

### Land finished clones onto the seed, then push the seed

When a branch clone's work is done, rebase its commits onto the **seed**
checkout. That seed is the staging area. Push **from the seed** to origin so
pre-push hooks run here and can be fixed (rewrite the message, do not
`--no-verify`). Never push from the clone.

For Surface the seed is `/Users/sidwood/code/smokefree/surface`. For any other
repo it is the clone that `bc.source` points at (or the directory `git bc-add`
was given as `<source>`).

- Rebase or fast-forward. Do not merge. Seed history stays linear.
- Seed must be on its default branch and clean before the rebase.
- If the seed already has other unpushed commits, rebase the clone onto that
  tip so work stacks in landing order.
- `git push` the seed's default branch to `origin`. Fast-forward only; no
  force-push. Clones stay unpushed.
- On a hook failure, fix the commit (amend the message, restore missing
  tools) and push again. Do not `--no-verify`.
- Leave the clone in place until origin has the commits, unless Sid asked
  to remove it.

This does not override "NEVER push the dotfiles repo".

```bash
seed=/Users/sidwood/code/smokefree/surface
clone=/Users/sidwood/code/smokefree/surface.some-branch
git -C "$seed" fetch "$clone" "$(git -C "$clone" branch --show-current)"
git -C "$seed" rebase --onto HEAD FETCH_HEAD~N FETCH_HEAD   # N = clone commits
# or, when seed is a strict ancestor:
git -C "$seed" merge --ff-only FETCH_HEAD
git -C "$seed" push origin HEAD
```

### Seed `node_modules` is Sid's — never `pnpm install` there

Cursor's sandbox sets `PNPM_STORE_PATH` to an empty temp store. `CI=true pnpm
install` (or `pnpm exec` auto-install) then sees a store mismatch, purges
`node_modules`, and fails offline. A later `pnpm install --offline` prints
"Already up to date" because pnpm 11 trusts workspace-state mtimes, not a
present `.pnpm/tsx@…` tree. That is what kept breaking Sid's `tsx`.

- Work in `git bc-add` clones. Each clone owns its own `node_modules`.
- On the Surface seed: `git config bc.postadd 'pnpm install'`.
- Never `pnpm install`, `pnpm exec`, or `rm -rf node_modules` in the seed.
- Never `CI=true pnpm install` in the sandbox.
- Never honor sandbox `PNPM_STORE_PATH` for a seed install. Host store is
  `/Users/sidwood/.local/share/pnpm/store/v11`.
- Never copy or hardlink `node_modules` via `bc.extras`.

## Lint before every Surface commit

Implementers run `pnpm lint` **before** `git commit`, not after. That is
Biome (format and lint) and cspell. If lint rewrites files, stage those
paths into the same commit. Never a follow-up format or cspell commit.
Never interactive-rebase published `origin/main` to make old commits
lint-clean.

Every Surface **implementer** prompt must include this. `AGENTS.md` and
the kanban `BASE_AGENT_PROMPT` already say it; repeating it in the Task
prompt still matters.

## Surface engineering wiki is house style

Surface (`/Users/sidwood/code/smokefree/surface`) is bound by the engineering
corpus under `wiki/engineering/`. TypeScript, NestJS, testing, HTTP,
persistence, Node.js, configuration, and readability notes all apply to this
repository.

Every Surface **implementer** prompt and every **Kimi K3** review prompt must
tell the agent to read `wiki/engineering/index.md` plus the TypeScript, NestJS,
testing, and HTTP indexes, then the notes that cover the files in the change.
Review against those Memories, not generic Nest/TS taste. Flutter notes under
`wiki/engineering/flutter/` apply to Flutter codebases only, not Surface API or
web.

This is already in Surface `AGENTS.md`. Repeating it in the Task prompt still
matters: clones and reviewers follow the prompt they were given.
