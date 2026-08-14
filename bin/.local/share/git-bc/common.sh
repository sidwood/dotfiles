# shellcheck shell=bash
#
# Shared helpers for the git-bc-* branch clone commands.
#
# Sourced, not executed. Each command finds this via
# "$(dirname "$0")/../share/git-bc/common.sh", which resolves correctly both
# when stowed (~/.local/bin/../share/...) and when run in place from the
# dotfiles repo (bin/.local/bin/../share/...).
#
# A branch clone records the clone it was seeded from in `bc.source`. That
# marker is the only thing distinguishing a branch clone (disposable) from a
# base clone (never remove), so every destructive path checks it.
#

#
# Interpreter floor: bash 3.2
#
# macOS ships bash 3.2 at /bin/bash, and `git bc-add` and friends run under
# whichever bash `env` finds first — which is the system one whenever Homebrew's
# bin is late on PATH or absent, as it is under some tooling. So no bash 4
# features here: no `mapfile` (read into the array in a loop instead), and every
# array expansion that can be empty is written ${arr[@]+"${arr[@]}"}, because
# plain "${arr[@]}" on an empty array is an unbound-variable error until 4.4.
#

#
# Script identity
#

# Each command sets bc_prog to its own basename to prefix its messages.
bc_prog="${bc_prog:-git-bc}"

# Directory holding the git-bc-* commands, so they can call each other whether
# stowed onto PATH or run in place from the repo. Read by the sourcing script,
# not here.
# shellcheck disable=SC2034
bc_bin_dir="$(cd "$(dirname "$0")" && pwd)"

#
# Output
#

bc_abort() {
  printf "\n \033[31mError: %s: %s\033[0m\n\n" "$bc_prog" "$*" >&2
  exit 1
}

bc_warn() {
  printf " \033[33mWarning: %s: %s\033[0m\n" "$bc_prog" "$*" >&2
}

bc_ok() {
  printf " \033[32m%s\033[0m\n" "$*"
}

bc_info() {
  printf " %s: %s\n" "$bc_prog" "$*"
}

# Print the calling script's leading comment block as its usage text, then exit.
# Stops at the first line that is not a comment, so usage lives next to the code
# without hardcoded line numbers.
bc_usage() {
  awk 'NR == 1 { next } /^#/ { sub(/^#[[:blank:]]?/, ""); print; next } { exit }' "$0"
  exit "${1:-2}"
}

#
# Paths
#

# Absolute, symlink-resolved path to an existing directory. Stands in for GNU
# `realpath -m`, which BSD realpath on macOS rejects.
bc_abs() {
  (cd "$1" 2>/dev/null && pwd -P)
}

# Absolute path for a directory that does not exist yet: resolve its parent and
# append the basename.
bc_abs_new() {
  local parent
  parent="$(bc_abs "$(dirname "$1")")" || return 1
  printf '%s/%s\n' "$parent" "$(basename "$1")"
}

# True if inner is dir itself or lives underneath it.
bc_path_within() {
  local inner="$1" dir="$2"
  [[ "$inner" == "$dir" || "$inner" == "$dir"/* ]]
}

#
# Prompting
#

# Ask before a destructive action. Reads /dev/tty so it still works when stdin
# is a pipe, as it is in git-bc-prune's scan loop. No terminal means decline,
# unless the caller set bc_assume_yes.
bc_confirm() {
  local prompt="$1" reply
  [[ "${bc_assume_yes:-false}" == true ]] && return 0
  if [[ ! -t 1 || ! -r /dev/tty ]]; then
    bc_warn "no terminal for confirmation, declining (use --yes)"
    return 1
  fi
  printf ' %s [y/N] ' "$prompt" > /dev/tty
  IFS= read -r reply < /dev/tty || return 1
  case "$reply" in
    y|Y|yes|YES) return 0 ;;
    *) return 1 ;;
  esac
}

#
# Repository inspection
#

bc_is_git_repo() {
  git -C "$1" rev-parse --git-dir >/dev/null 2>&1
}

# A branch clone records its seed in bc.source. Base clones do not.
bc_is_branch_clone() {
  [[ -n "$(git -C "$1" config --local --get bc.source 2>/dev/null)" ]]
}

# Resolve the upstream a new clone should point at, so it never depends on the
# clone it was seeded from. Follows a chain of local clones until it reaches
# either a network URL or a repo with no origin of its own — a local bare repo or
# mirror, which is a legitimate upstream in its own right.
bc_real_remote_url() {
  local dir="$1" url next depth=0
  while [[ "$depth" -lt 10 ]]; do
    if ! url="$(git -C "$dir" remote get-url origin 2>/dev/null)"; then
      # End of the chain. Only usable if we actually walked past the seed.
      if [[ "$depth" -gt 0 ]]; then
        printf '%s\n' "$dir"
        return 0
      fi
      return 1
    fi
    case "$url" in
      *://*|*@*:*) printf '%s\n' "$url"; return 0 ;;
    esac
    # Local path remote — resolve relative to the current dir and keep walking.
    next="$(cd "$dir" && bc_abs "$url")" || return 1
    [[ -d "$next" ]] || return 1
    dir="$next"
    depth=$(( depth + 1 ))
  done
  return 1
}

# Remote default branch name, e.g. "main". Probes main then master when
# origin/HEAD was never recorded.
bc_default_branch() {
  local dir="$1" ref candidate
  ref="$(git -C "$dir" symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null)" || ref=""
  # origin/HEAD can name a branch that no longer exists, so verify before
  # trusting it and otherwise fall through to probing.
  if [[ -n "$ref" ]] && git -C "$dir" show-ref --verify --quiet "refs/remotes/$ref"; then
    printf '%s\n' "${ref#origin/}"
    return 0
  fi
  for candidate in main master; do
    if git -C "$dir" show-ref --verify --quiet "refs/remotes/origin/$candidate"; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

# Current branch name, empty on a detached HEAD.
bc_current_branch() {
  git -C "$1" symbolic-ref --short HEAD 2>/dev/null || true
}

# Flatten a branch name for use in a directory name: feat/foo -> feat-foo.
bc_safe_branch() {
  printf '%s\n' "${1//\//-}"
}

# Pull request state for a branch: MERGED, CLOSED, OPEN, or empty when gh is
# missing, unauthenticated, or finds no PR. Costs a network round trip.
bc_gh_pr_state() {
  local dir="$1" branch="$2"
  command -v gh >/dev/null 2>&1 || return 0
  [[ -n "$branch" ]] || return 0
  ( cd "$dir" && gh pr view "$branch" --json state --jq '.state' 2>/dev/null ) || true
}

#
# Discovery
#
# Branch clones are created as siblings of their source, so the scan root is the
# parent directory of a clone rather than the clone itself.
#

bc_scan_root() {
  local arg="${1:-}" toplevel
  if [[ -n "$arg" ]]; then
    bc_abs "$arg"
    return
  fi
  if toplevel="$(git rev-parse --show-toplevel 2>/dev/null)" && [[ -n "$toplevel" ]]; then
    bc_abs "$(dirname "$toplevel")"
    return
  fi
  pwd -P
}

# Emit git repositories directly under a scan root, one absolute path per line.
bc_repo_dirs() {
  local dir
  while IFS= read -r dir; do
    bc_is_git_repo "$dir" && printf '%s\n' "$dir"
  done < <(find "$1" -maxdepth 1 -mindepth 1 -type d | sort)
}

# Emit only the branch clones under a scan root. Base clones are filtered out.
bc_clone_dirs() {
  local dir
  while IFS= read -r dir; do
    bc_is_branch_clone "$dir" && printf '%s\n' "$dir"
  done < <(bc_repo_dirs "$1")
}

#
# Docker cleanup
#
# Devcontainers outlive the clone they were built from. Match on
# devcontainer.config_file rather than devcontainer.local_folder: the latter
# uses WSL path syntax on WSL and cannot be compared to a Unix path. Compose
# stacks are then expanded by project name so sidecars go too.
#
# Non-fatal by design — a Docker problem must not block removing the clone.
#

bc_prune_devcontainers() {
  local dir="$1"
  command -v docker >/dev/null 2>&1 || return 0

  local projects=() lone_ids=() all_ids=()
  local id config_file project cid p

  while IFS=$'\t' read -r id config_file project; do
    case "$config_file" in
      "$dir"/*)
        if [[ -n "$project" ]]; then
          projects+=("$project")
        else
          lone_ids+=("$id")
        fi
        ;;
    esac
  done < <(
    docker ps -a \
      --filter "label=devcontainer.local_folder" \
      --format $'{{.ID}}\t{{.Label "devcontainer.config_file"}}\t{{.Label "com.docker.compose.project"}}' \
      2>/dev/null || true
  )

  if (( ${#projects[@]} > 0 )); then
    while IFS= read -r p; do
      while IFS= read -r cid; do
        [[ -n "$cid" ]] && all_ids+=("$cid")
      done < <(
        docker ps -a \
          --filter "label=com.docker.compose.project=$p" \
          --format '{{.ID}}' \
          2>/dev/null || true
      )
    done < <(printf '%s\n' "${projects[@]}" | sort -u)
  fi

  for cid in ${lone_ids[@]+"${lone_ids[@]}"}; do
    all_ids+=("$cid")
  done

  (( ${#all_ids[@]} > 0 )) || return 0

  bc_info "removing ${#all_ids[@]} devcontainer container(s)"
  docker rm -f "${all_ids[@]}" >/dev/null \
    || bc_warn "could not remove some devcontainer containers"
  return 0
}
