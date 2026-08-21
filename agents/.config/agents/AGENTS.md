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

A `git worktree` alternative on `$PATH` via `~/.local/bin`: each branch gets a
full local clone, hardlinked from the seed -> instant, ~0 disk. Subcommands
`bc-add`, `bc-list`, `bc-rm`, `bc-prune`, `bc-sync-extras`; aliases `gbc gbca
gbcp gbcr gbcs`, and `gbcd` fzf-picks a clone and cds in.

Run `git bc-<cmd> -h` for flags and semantics before using one — `--help` hits
git's man page lookup and fails. `bc-rm` and `bc-prune` refuse base clones,
dirty trees, and clones holding commits found nowhere else; prefer them to
`rm -rf`. Per-repo config on the base clone: `bc.source` marks a clone,
`bc.postadd` runs a command in each new clone, `bc.extras` adds copy patterns.

Source: `~/code/dotfiles/bin/`.

### Land finished clones onto the seed, then push the seed

A finished clone's commits are rebased onto the **seed**, which is the staging
area, and pushed from there so pre-push hooks run somewhere they can be fixed.

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

## Surface prompts must carry the repo's own rules

Surface `AGENTS.md` is authoritative for its lint gate and for the
`wiki/engineering/` house style. Implementer and Kimi K3 review prompts must
still name both explicitly — clones and reviewers follow the prompt they were
given, and Kimi reads working-directory `AGENTS.md` only.
