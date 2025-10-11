# Powerlevel10k configuration
# Generated to match legacy manual prompt: ~/code/dotfiles[git:master] on left, SHA on right

# Temporarily change options
'builtin' 'local' '-a' 'p10k_config_opts'
[[ ! -o 'aliases'         ]] || p10k_config_opts+=('aliases')
[[ ! -o 'sh_glob'         ]] || p10k_config_opts+=('sh_glob')
[[ ! -o 'no_brace_expand' ]] || p10k_config_opts+=('no_brace_expand')
'builtin' 'setopt' 'no_aliases' 'no_sh_glob' 'brace_expand'

() {
  emulate -L zsh -o extended_glob

  # Unset all configuration options
  unset -m '(POWERLEVEL9K_*|DEFAULT_USER)~POWERLEVEL9K_GITSTATUS_DIR'

  # Zsh >= 5.1 is required
  [[ $ZSH_VERSION == (5.<1->*|<6->.*) ]] || return

  # Left prompt segments
  typeset -g POWERLEVEL9K_LEFT_PROMPT_ELEMENTS=(
    dir                     # current directory
    vcs                     # git status
    newline                 # newline
    prompt_char             # prompt symbol
  )

  # Right prompt segments
  typeset -g POWERLEVEL9K_RIGHT_PROMPT_ELEMENTS=(
    my_git_sha              # custom segment for short SHA
  )

  # Basic style - no special icons or powerline symbols for clean look
  typeset -g POWERLEVEL9K_MODE=ascii
  typeset -g POWERLEVEL9K_ICON_PADDING=none

  # Prompt styling
  typeset -g POWERLEVEL9K_BACKGROUND=                            # transparent background
  typeset -g POWERLEVEL9K_LEFT_SUBSEGMENT_SEPARATOR=''
  typeset -g POWERLEVEL9K_RIGHT_SUBSEGMENT_SEPARATOR=''
  typeset -g POWERLEVEL9K_LEFT_SEGMENT_SEPARATOR=''
  typeset -g POWERLEVEL9K_RIGHT_SEGMENT_SEPARATOR=''
  typeset -g POWERLEVEL9K_LEFT_PROMPT_LAST_SEGMENT_END_SYMBOL=''
  typeset -g POWERLEVEL9K_RIGHT_PROMPT_FIRST_SEGMENT_START_SYMBOL=''
  typeset -g POWERLEVEL9K_LEFT_PROMPT_FIRST_SEGMENT_START_SYMBOL=''
  typeset -g POWERLEVEL9K_RIGHT_PROMPT_LAST_SEGMENT_END_SYMBOL=''
  typeset -g POWERLEVEL9K_EMPTY_LINE_LEFT_PROMPT_LAST_SEGMENT_END_SYMBOL=
  # Remove gap between segments
  typeset -g POWERLEVEL9K_WHITESPACE_BETWEEN_LEFT_SEGMENTS=''
  typeset -g POWERLEVEL9K_WHITESPACE_BETWEEN_RIGHT_SEGMENTS=''

  # Add newline before prompt (matches legacy CR)
  typeset -g POWERLEVEL9K_PROMPT_ADD_NEWLINE=true

  # ---------------------------------
  # Directory segment
  # ---------------------------------
  typeset -g POWERLEVEL9K_DIR_FOREGROUND=none
  typeset -g POWERLEVEL9K_SHORTEN_STRATEGY=truncate_to_unique
  typeset -g POWERLEVEL9K_SHORTEN_DELIMITER=
  typeset -g POWERLEVEL9K_DIR_SHORTENED_FOREGROUND=none
  typeset -g POWERLEVEL9K_DIR_ANCHOR_FOREGROUND=none
  typeset -g POWERLEVEL9K_DIR_ANCHOR_BOLD=false
  # Show ~ for home
  typeset -g POWERLEVEL9K_DIR_HOME_FOREGROUND=none
  typeset -g POWERLEVEL9K_DIR_HOME_SUBFOLDER_FOREGROUND=none
  typeset -g POWERLEVEL9K_DIR_DEFAULT_FOREGROUND=none
  typeset -g POWERLEVEL9K_DIR_ETC_FOREGROUND=none
  # No whitespace/padding after directory
  typeset -g POWERLEVEL9K_DIR_{LEFT,RIGHT}_WHITESPACE=

  # ---------------------------------
  # VCS (Git) segment - format: [git:branch]
  # ---------------------------------
  typeset -g POWERLEVEL9K_VCS_FOREGROUND='#465F67'
  typeset -g POWERLEVEL9K_VCS_LOADING_FOREGROUND='#465F67'
  # No whitespace/padding before vcs
  typeset -g POWERLEVEL9K_VCS_{LEFT,RIGHT}_WHITESPACE=

  # Use content expansion to show ONLY [git:branch] with no counts or icons
  # ${VCS_STATUS_LOCAL_BRANCH} contains the branch name
  typeset -g POWERLEVEL9K_VCS_CONTENT_EXPANSION='[git:${VCS_STATUS_LOCAL_BRANCH}]'

  # Disable all VCS icons
  typeset -g POWERLEVEL9K_VCS_BRANCH_ICON=
  typeset -g POWERLEVEL9K_VCS_GIT_ICON=
  typeset -g POWERLEVEL9K_VCS_GIT_GITHUB_ICON=
  typeset -g POWERLEVEL9K_VCS_GIT_GITLAB_ICON=
  typeset -g POWERLEVEL9K_VCS_GIT_BITBUCKET_ICON=

  # VCS colors for different states
  typeset -g POWERLEVEL9K_VCS_CLEAN_FOREGROUND='#465F67'
  typeset -g POWERLEVEL9K_VCS_MODIFIED_FOREGROUND='#465F67'
  typeset -g POWERLEVEL9K_VCS_UNTRACKED_FOREGROUND='#465F67'

  # ---------------------------------
  # Prompt character (like the λ in original)
  # ---------------------------------
  typeset -g POWERLEVEL9K_PROMPT_CHAR_OK_{VIINS,VICMD,VIVIS,VIOWR}_FOREGROUND=green
  typeset -g POWERLEVEL9K_PROMPT_CHAR_ERROR_{VIINS,VICMD,VIVIS,VIOWR}_FOREGROUND=red
  typeset -g POWERLEVEL9K_PROMPT_CHAR_{OK,ERROR}_VIINS_CONTENT_EXPANSION='λ'
  typeset -g POWERLEVEL9K_PROMPT_CHAR_{OK,ERROR}_VICMD_CONTENT_EXPANSION='λ'
  typeset -g POWERLEVEL9K_PROMPT_CHAR_{OK,ERROR}_VIVIS_CONTENT_EXPANSION='λ'
  typeset -g POWERLEVEL9K_PROMPT_CHAR_{OK,ERROR}_VIOWR_CONTENT_EXPANSION='λ'
  typeset -g POWERLEVEL9K_PROMPT_CHAR_OVERWRITE_STATE=false

  # ---------------------------------
  # Custom segment: Git SHA (right side) with dirty indicator
  # ---------------------------------
  function prompt_my_git_sha() {
    # Only show in git repos
    [[ -d .git ]] || git rev-parse --git-dir &>/dev/null || return
    local sha
    sha=$(git rev-parse --short HEAD 2>/dev/null) || return

    # Check for dirty state (modified files)
    local dirty=""
    if [[ -n $(git ls-files -m 2>/dev/null) ]]; then
      dirty=" %F{red}✖%f"
    fi

    p10k segment -f '#465F67' -t "${sha}${dirty}"
  }

  # ---------------------------------
  # SSH context (show user@host when in SSH, like original)
  # ---------------------------------
  typeset -g POWERLEVEL9K_CONTEXT_ROOT_FOREGROUND=none
  typeset -g POWERLEVEL9K_CONTEXT_{REMOTE,REMOTE_SUDO}_FOREGROUND=none
  typeset -g POWERLEVEL9K_CONTEXT_FOREGROUND=none

  # ---------------------------------
  # Transient prompt (optional - shows minimal prompt after command runs)
  # ---------------------------------
  typeset -g POWERLEVEL9K_TRANSIENT_PROMPT=off

  # ---------------------------------
  # Instant prompt mode
  # ---------------------------------
  typeset -g POWERLEVEL9K_INSTANT_PROMPT=quiet

  # ---------------------------------
  # Hot reload
  # ---------------------------------
  (( ! $+functions[p10k] )) || p10k reload
}

# Restore options
(( ${#p10k_config_opts} )) && setopt ${p10k_config_opts[@]}
'builtin' 'unset' 'p10k_config_opts'
