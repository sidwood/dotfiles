# shellcheck shell=bash

# Shared by install.sh, uninstall.sh, and node-cli-update.
# pnpm 11 reads nodeLinker and allowBuilds from each project's
# pnpm-workspace.yaml. package.json and .npmrc do not carry them.

if ! declare -f abort >/dev/null 2>&1; then
  abort() {
    printf '\n \033[31mError: %s\033[0m\n\n' "$*" >&2
    exit 1
  }
fi

node_cli_lib_dir() {
  local source_path
  source_path="$(realpath "${BASH_SOURCE[0]}")"
  (cd "$(dirname "$source_path")" && pwd)
}

node_cli_repo_root() {
  local lib
  lib="$(node_cli_lib_dir)"
  (cd "$lib/../../../.." && pwd)
}

node_cli_tools_file() {
  printf '%s\n' "$(node_cli_lib_dir)/tools.tsv"
}

node_cli_ids() {
  local want="${1:-}"
  local id _dir _name _launcher _effects _auth _node _remove menu
  while IFS=$'\t' read -r id _dir _name _launcher _effects _auth _node _remove menu || [[ -n "${id:-}" ]]; do
    case "$id" in
      ''|'#'*) continue ;;
    esac
    if [[ -z "$want" || "$menu" == "$want" ]]; then
      printf '%s\n' "$id"
    fi
  done < "$(node_cli_tools_file)"
}

node_cli_lookup() {
  local want="$1"
  local id runtime_dir runtime_name launcher effects auth node remove_global menu
  nc_id=""
  while IFS=$'\t' read -r id runtime_dir runtime_name launcher effects auth node remove_global menu || [[ -n "${id:-}" ]]; do
    case "$id" in
      ''|'#'*) continue ;;
    esac
    if [[ "$id" == "$want" ]]; then
      nc_id="$id"
      nc_runtime_dir="$runtime_dir"
      nc_runtime_name="$runtime_name"
      nc_launcher="$launcher"
      nc_effects="$effects"
      nc_auth="$auth"
      nc_node="$node"
      nc_remove_global="$remove_global"
      nc_menu="$menu"
      return 0
    fi
  done < "$(node_cli_tools_file)"
  return 1
}

node_cli_project_dir() {
  printf '%s\n' "$(node_cli_repo_root)/node-clis/$nc_id"
}

node_cli_runtime_path() {
  printf '%s\n' "${XDG_DATA_HOME:-$HOME/.local/share}/$nc_runtime_dir"
}

node_cli_activate_tools() {
  if command -v mise >/dev/null 2>&1; then
    eval "$(mise activate bash)" 2>/dev/null || true
  fi
}

node_cli_require_toolchain() {
  command -v node >/dev/null 2>&1 || abort 'Node.js required (install mise runtimes first)'
  command -v pnpm >/dev/null 2>&1 || abort 'pnpm required (install mise runtimes first)'
}

node_cli_check_node() {
  local fail=0
  case "$nc_node" in
    ge22.19)
      node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 19) ? 0 : 1)' || fail=1
      [[ "$fail" -eq 0 ]] || abort 'Atomic requires Node.js 22.19 or newer'
      ;;
    22or24)
      node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit((major === 22 && minor >= 19) || major >= 24 ? 0 : 1)' || fail=1
      [[ "$fail" -eq 0 ]] || abort 'DeepSeek Harness requires Node.js 22.19+ (22.x) or 24+'
      ;;
    ge26)
      node -e 'const [major] = process.versions.node.split(".").map(Number); process.exit(major >= 26 ? 0 : 1)' || fail=1
      [[ "$fail" -eq 0 ]] || abort 'timecraft requires Node.js 26 or newer'
      ;;
    ge20)
      node -e 'const [major] = process.versions.node.split(".").map(Number); process.exit(major >= 20 ? 0 : 1)' || fail=1
      [[ "$fail" -eq 0 ]] || abort 'Gemini CLI requires Node.js 20 or newer'
      ;;
    ge18)
      node -e 'const [major] = process.versions.node.split(".").map(Number); process.exit(major >= 18 ? 0 : 1)' || fail=1
      [[ "$fail" -eq 0 ]] || abort 'firecrawl requires Node.js 18 or newer'
      ;;
    any) ;;
    *) abort "Unknown Node policy: $nc_node" ;;
  esac
}

node_cli_dependency_name() {
  local project="$1"
  node -e 'const fs=require("fs"); const pkg=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); const names=Object.keys(pkg.dependencies||{}); if(names.length!==1){process.exit(1)} process.stdout.write(names[0]);' "$project/package.json"
}

node_cli_require_registry_auth() {
  local template
  command -v op >/dev/null 2>&1 || abort '1Password CLI required (install Homebrew packages first)'
  export NPM_CONFIG_USERCONFIG="${XDG_CONFIG_HOME:-$HOME/.config}/npm/npmrc"
  [[ -f "$NPM_CONFIG_USERCONFIG" ]] || abort 'npm config missing (~/.config/npm/npmrc). Select "Symlink dotfile packages with GNU Stow" first.'
  template="$(node_cli_repo_root)/shell/.config/shell/local.env.tpl"
  [[ -f "$template" ]] || abort "Missing 1Password env template: $template"
}

node_cli_pnpm() {
  local template
  if [[ "${nc_auth:-0}" == "1" ]]; then
    node_cli_require_registry_auth
    template="$(node_cli_repo_root)/shell/.config/shell/local.env.tpl"
    op run --env-file="$template" -- pnpm "$@"
  else
    pnpm "$@"
  fi
}

node_cli_prefer_local_bin() {
  export PATH="$HOME/.local/bin:$PATH"
}

node_cli_exact_version() {
  case "$1" in
    *[!0-9A-Za-z.+-]*) return 1 ;;
    [0-9]*.[0-9]*.[0-9]*) return 0 ;;
  esac
  return 1
}

node_cli_set_version() {
  local project="$1"
  local version="$2"
  node -e 'const fs=require("fs"); const file=process.argv[1]; const version=process.argv[2]; const pkg=JSON.parse(fs.readFileSync(file,"utf8")); const names=Object.keys(pkg.dependencies||{}); if(names.length!==1){process.exit(1)} pkg.dependencies[names[0]]=version; fs.writeFileSync(file, JSON.stringify(pkg, null, 2)+"\n");' "$project/package.json" "$version"
}

node_cli_assert_macho() {
  local path="$1"
  local label="$2"
  [[ -f "$path" ]] || abort "$label build output is missing ($path)"
  file "$path" | grep -q 'Mach-O' || abort "$label build did not produce a native binary"
}

node_cli_plugins() {
  local runtime="$1"
  node "$(node_cli_lib_dir)/plugins.mjs" "$nc_effects" "$runtime" || abort "$nc_id plugin lookup failed"
}

link_agent_memory() {
  local canonical="$HOME/.config/agents/AGENTS.md"

  if [[ ! -e "$canonical" ]]; then
    echo "Skipping agent memory links (agents package not stowed)"
    return 0
  fi

  # <command>|<global instructions path>. Every harness reads a different
  # filename in a different place, so rather than keep a copy per tool we keep
  # one file and point them all at it. Add a harness by adding a line.
  #
  # Paths verified against the tools themselves: codex (binary references
  # ~/.codex/AGENTS.md), grok (its shipped docs/user-guide), opencode (config
  # root ~/.config/opencode), pi (global context lives in agentDir, default
  # ~/.pi/agent). claude and gemini follow each vendor's documented path.
  # Cursor's home-level rules are .mdc files in ~/.cursor/rules/. The shared
  # file carries no alwaysApply frontmatter, so enable the rule in Cursor.
  #
  # Deliberately absent: kimi. It only reads AGENTS.md from the working
  # directory — global support is an open, unimplemented request
  # (MoonshotAI/kimi-cli#2152). Add "kimi|$HOME/.kimi/AGENTS.md" when it lands.
  local harnesses=(
    "claude|$HOME/.claude/CLAUDE.md"
    "codex|$HOME/.codex/AGENTS.md"
    "grok|$HOME/.grok/AGENTS.md"
    "opencode|$HOME/.config/opencode/AGENTS.md"
    "cursor|$HOME/.cursor/rules/global-agent-memory.mdc"
    "gemini|$HOME/.gemini/GEMINI.md"
    "pi|$HOME/.pi/agent/AGENTS.md"
    "dsh|${DSH_HOME:-$HOME/.dsh}/AGENTS.md"
    "atomic|${ATOMIC_CODING_AGENT_DIR:-${PI_CODING_AGENT_DIR:-$HOME/.atomic/agent}}/AGENTS.md"
  )

  echo "Linking global agent memory"
  local entry cmd target
  for entry in "${harnesses[@]}"; do
    cmd="${entry%%|*}"
    target="${entry#*|}"

    # Only touch harnesses that are actually here, so $HOME does not collect
    # config directories for tools that were never installed.
    if ! command -v "$cmd" >/dev/null 2>&1 && [[ ! -d "$(dirname "$target")" ]]; then
      continue
    fi

    if [[ -L "$target" ]]; then
      [[ "$(readlink "$target")" == "$canonical" ]] && continue
    elif [[ -e "$target" ]]; then
      echo "  Backing up existing ${target##*/} to ${target}.bak"
      mv "$target" "${target}.bak"
    fi

    mkdir -p "$(dirname "$target")"
    ln -sfn "$canonical" "$target"
    echo "  ${cmd} -> ~/${target#"$HOME"/}"
  done
}

node_cli_side_effects() {
  local repo runtime agent_dir harness_home launcher
  repo="$(node_cli_repo_root)"
  runtime="$(node_cli_runtime_path)"
  launcher="$HOME/.local/bin/$nc_launcher"
  case "$nc_effects" in
    atomic)
      agent_dir="${ATOMIC_CODING_AGENT_DIR:-${PI_CODING_AGENT_DIR:-$HOME/.atomic/agent}}"
      (
        umask 077
        mkdir -p "$agent_dir" || exit 1
        if [[ ! -e "$agent_dir/settings.json" && ! -L "$agent_dir/settings.json" ]]; then
          cp "$repo/atomic/.config/atomic/settings.json" "$agent_dir/settings.json" || exit 1
        fi
      ) || abort 'Could not initialise Atomic settings'
      "$launcher" --version || abort 'Atomic executable check failed'
      node_cli_plugins "$runtime"
      link_agent_memory
      echo 'Atomic ready: run atomic in a project, then use /login and /model'
      ;;
    harness)
      harness_home="${DSH_HOME:-$HOME/.dsh}"
      (
        umask 077
        mkdir -p "$harness_home" || exit 1
        if [[ ! -e "$harness_home/settings.yaml" && ! -L "$harness_home/settings.yaml" ]]; then
          cp "$repo/dsh/.config/dsh/settings.yaml" "$harness_home/settings.yaml" || exit 1
        fi
      ) || abort 'Could not initialise DeepSeek Harness settings'
      DSH_HOME="$harness_home" "$launcher" web --dump-default-config >/dev/null || abort 'Could not initialise the DeepSeek Harness web profile'
      node_cli_plugins "$runtime"
      link_agent_memory
      echo 'DeepSeek Harness ready: run dsh web, then configure a provider in Settings > Models'
      ;;
    gemini)
      node_cli_assert_macho "$runtime/node_modules/node-pty/build/Release/pty.node" 'Gemini node-pty'
      node_cli_assert_macho "$runtime/node_modules/@github/keytar/build/Release/keytar.node" 'Gemini keytar'
      link_agent_memory
      ;;
    opencode)
      node_cli_assert_macho "$runtime/node_modules/opencode-ai/bin/opencode.exe" 'OpenCode'
      "$launcher" --version >/dev/null || abort 'OpenCode executable check failed'
      link_agent_memory
      ;;
    none) ;;
    *) abort "Unknown Node CLI side effects: $nc_effects" ;;
  esac
}

node_cli_install() {
  local project runtime
  node_cli_lookup "$1" || abort "Unknown Node CLI: $1"
  node_cli_activate_tools
  node_cli_require_toolchain
  node_cli_check_node
  project="$(node_cli_project_dir)"
  runtime="$(node_cli_runtime_path)"
  if [[ "$nc_launcher" != "-" ]]; then
    local launcher="$HOME/.local/bin/$nc_launcher"
    local bin_link="$runtime/node_modules/.bin/$nc_launcher"
    if [[ -e "$launcher" || -L "$launcher" ]]; then
      [[ -L "$launcher" && "$(readlink "$launcher")" == "$bin_link" ]] || abort "Preserving existing $launcher; move it before installing $nc_id"
    fi
  fi
  if [[ -e "$runtime" || -L "$runtime" ]]; then
    [[ ! -L "$runtime" && -f "$runtime/package.json" ]] &&
      grep -Fqx "  \"name\": \"$nc_runtime_name\"," "$runtime/package.json" || abort "Preserving unrecognised runtime at $runtime"
  fi

  # Build beside the runtime so a failed install, including a missing
  # 1Password session, leaves the previous runtime in place.
  local incoming="$runtime.incoming"
  rm -rf "$incoming"
  echo "Installing $nc_id from its dependency lockfile"
  mkdir -p "$incoming" "$HOME/.local/bin" || abort 'Could not create Node CLI directories'
  local file
  for file in package.json pnpm-lock.yaml pnpm-workspace.yaml; do
    [[ -f "$project/$file" ]] || abort "Missing $project/$file"
    cp "$project/$file" "$incoming/$file" || abort "Could not copy $file"
  done
  if ! node_cli_pnpm install --dir "$incoming" --frozen-lockfile --config.confirmModulesPurge=false; then
    rm -rf "$incoming"
    if [[ "$nc_auth" == "1" ]]; then
      abort 'Failed to install timecraft (check 1Password CLI auth and GitHub Registry Token)'
    fi
    abort "$nc_id installation failed"
  fi
  rm -rf "$runtime" || abort "Could not replace runtime at $runtime"
  mv "$incoming" "$runtime" || abort "Could not replace runtime at $runtime"
  if [[ "$nc_launcher" != "-" ]]; then
    local linked="$runtime/node_modules/.bin/$nc_launcher"
    [[ -e "$linked" || -L "$linked" ]] || abort "No launcher $nc_launcher in $runtime"
    ln -sfn "$linked" "$HOME/.local/bin/$nc_launcher" || abort "Could not link $nc_launcher"
  fi
  node_cli_prefer_local_bin
  node_cli_remove_pnpm_global
  node_cli_side_effects
  if [[ "$nc_launcher" == "-" ]]; then
    echo "Installed $nc_id runtime at $runtime"
  else
    echo "Installed $nc_launcher -> $HOME/.local/bin/$nc_launcher"
  fi
}

node_cli_remove_pnpm_global() {
  local project spec pnpm_home
  [[ "$nc_remove_global" == "1" ]] || return 0
  project="$(node_cli_project_dir)"
  spec="$(node_cli_dependency_name "$project")" || abort "Could not read the package name for $nc_id"
  pnpm_home="${PNPM_HOME:-${XDG_DATA_HOME:-$HOME/.local/share}/pnpm}"
  [[ -d "$pnpm_home" ]] || return 0
  if PNPM_HOME="$pnpm_home" pnpm list -g --depth 0 2>/dev/null | grep -F "${spec}@" >/dev/null; then
    PNPM_HOME="$pnpm_home" pnpm remove -g "$spec" || abort "Could not remove global $spec"
  fi
}

node_cli_install_menu() {
  local id
  while IFS= read -r id || [[ -n "${id:-}" ]]; do
    [[ -n "$id" ]] || continue
    node_cli_install "$id"
  done < <(node_cli_ids "$1")
}

node_cli_memory_path() {
  case "$nc_effects" in
    atomic)
      printf '%s\n' "${ATOMIC_CODING_AGENT_DIR:-${PI_CODING_AGENT_DIR:-$HOME/.atomic/agent}}/AGENTS.md"
      ;;
    harness)
      printf '%s\n' "${DSH_HOME:-$HOME/.dsh}/AGENTS.md"
      ;;
    gemini)
      printf '%s\n' "$HOME/.gemini/GEMINI.md"
      ;;
    opencode)
      printf '%s\n' "${XDG_CONFIG_HOME:-$HOME/.config}/opencode/AGENTS.md"
      ;;
  esac
}

node_cli_uninstall() {
  local runtime launcher bin_link memory canonical
  node_cli_lookup "$1" || abort "Unknown Node CLI: $1"
  runtime="$(node_cli_runtime_path)"
  canonical="$HOME/.config/agents/AGENTS.md"
  if [[ -e "$runtime" || -L "$runtime" ]]; then
    [[ ! -L "$runtime" && -f "$runtime/package.json" ]] &&
      grep -Fqx "  \"name\": \"$nc_runtime_name\"," "$runtime/package.json" || abort "Preserving unrecognised runtime at $runtime"
    rm -rf "$runtime" || abort "Could not remove $nc_id runtime"
  fi
  if [[ "$nc_launcher" != "-" ]]; then
    launcher="$HOME/.local/bin/$nc_launcher"
    bin_link="$runtime/node_modules/.bin/$nc_launcher"
    if [[ -L "$launcher" && "$(readlink "$launcher")" == "$bin_link" ]]; then
      rm "$launcher" || abort "Could not remove $nc_launcher link"
    fi
  fi
  memory="$(node_cli_memory_path || true)"
  if [[ -n "$memory" && -L "$memory" && "$(readlink "$memory")" == "$canonical" ]]; then
    rm "$memory" || abort "Could not remove $nc_id memory link"
  fi
  case "$nc_effects" in
    atomic)
      echo "Atomic removed; settings, credentials and sessions remain in ${ATOMIC_CODING_AGENT_DIR:-${PI_CODING_AGENT_DIR:-$HOME/.atomic/agent}}"
      ;;
    harness)
      echo "DeepSeek Harness removed; settings, credentials and sessions remain in ${DSH_HOME:-$HOME/.dsh}"
      ;;
    *)
      echo "$nc_id removed"
      ;;
  esac
}

node_cli_uninstall_menu() {
  local id
  while IFS= read -r id || [[ -n "${id:-}" ]]; do
    [[ -n "$id" ]] || continue
    node_cli_uninstall "$id"
  done < <(node_cli_ids "$1")
}

node_cli_update() {
  local project
  node_cli_exact_version "$2" || abort 'Version must be exact, for example 1.2.3 or 0.1.5-rc.1'
  node_cli_lookup "$1" || abort "Unknown Node CLI: $1"
  node_cli_activate_tools
  node_cli_require_toolchain
  project="$(node_cli_project_dir)"
  node_cli_set_version "$project" "$2" || abort "Could not set the version for $nc_id"
  if ! node_cli_pnpm install --dir "$project" --lockfile-only --ignore-scripts --config.confirmModulesPurge=false; then
    if [[ "$nc_auth" == "1" ]]; then
      abort 'Failed to update timecraft (check 1Password CLI auth and GitHub Registry Token)'
    fi
    abort "Could not rewrite the lockfile for $nc_id"
  fi
  if [[ -d "$project/node_modules" ]]; then
    rm -rf "$project/node_modules"
  fi
  node_cli_install "$nc_id"
}
