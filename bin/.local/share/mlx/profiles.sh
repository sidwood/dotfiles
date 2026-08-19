# shellcheck shell=bash

mlx_profiles_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mlx_profiles_file="$mlx_profiles_dir/profiles.tsv"
mlx_default_profile_file="$mlx_profiles_dir/default-profile.txt"

mlx_profile_field() {
  local profile="$1" field="$2"

  awk -F '\t' -v profile="$profile" -v field="$field" '
    $1 == profile { print $field; found = 1; exit }
    END { if (!found) exit 1 }
  ' "$mlx_profiles_file"
}

mlx_profile_exists() {
  mlx_profile_field "$1" 1 >/dev/null 2>&1
}

mlx_profile_names() {
  awk -F '\t' '!/^#/ && NF { print $1 }' "$mlx_profiles_file"
}

mlx_default_profile() {
  local profile

  [[ -s "$mlx_default_profile_file" ]] || {
    echo "Error: default MLX profile not found at $mlx_default_profile_file" >&2
    return 1
  }
  profile="$(sed -n '1p' "$mlx_default_profile_file")"
  mlx_profile_exists "$profile" || {
    echo "Error: unknown default MLX profile: $profile" >&2
    return 1
  }
  printf '%s\n' "$profile"
}

mlx_profile_model() {
  mlx_profile_field "$1" 2
}

mlx_profile_opencode_model() {
  mlx_profile_field "$1" 3
}

mlx_profile_port() {
  mlx_profile_field "$1" 4
}

mlx_profile_top_k() {
  mlx_profile_field "$1" 5
}

mlx_profile_opencode_agent() {
  mlx_profile_field "$1" 6
}

mlx_require_profile() {
  local profile="$1"

  mlx_profile_exists "$profile" && return 0
  echo "Error: unknown MLX profile: $profile" >&2
  printf 'Available profiles: ' >&2
  mlx_profile_names | awk 'BEGIN { separator = "" } { printf "%s%s", separator, $0; separator = ", " } END { print "" }' >&2
  return 1
}

mlx_print_profiles() {
  local default profile model model_ref agent port marker

  default="$(mlx_default_profile)"
  printf '%-12s %-7s %-48s %-30s %s\n' "PROFILE" "PORT" "MODEL" "OPENCODE" "AGENT"
  while IFS= read -r profile; do
    model="$(mlx_profile_model "$profile")"
    model_ref="$(mlx_profile_opencode_model "$profile")"
    agent="$(mlx_profile_opencode_agent "$profile")"
    port="$(mlx_profile_port "$profile")"
    marker=""
    [[ "$profile" == "$default" ]] && marker=" (default)"
    printf '%-12s %-7s %-48s %-30s %s%s\n' \
      "$profile" "$port" "$model" "$model_ref" "$agent" "$marker"
  done < <(mlx_profile_names)
}
