# source shared environment variables
. ~/.profile

# ------------------------------------------------------------------------------
# shell options
# ------------------------------------------------------------------------------

# initialize homebrew
if [[ $PLATFORM == "Darwin" && -f "/opt/homebrew/bin/brew" ]]; then
  eval $(/opt/homebrew/bin/brew shellenv)
fi

# initialize omarchy
if [[ -d "$HOME/.local/share/omarchy" ]]; then
  export OMARCHY_PATH="$HOME/.local/share/omarchy"
  export PATH="$OMARCHY_PATH/bin:$PATH"
fi

# set the zinit directory for plugins
ZINIT_HOME="${XDG_DATA_HOME:-${HOME}/.local/share}/zinit/zinit.git"

# download zinit if it doesn't exist
if [[ ! -d "$ZINIT_HOME" ]]; then
  mkdir -p "$(dirname $ZINIT_HOME)"
  git clone https://github.com/zdharma-continuum/zinit.git "$ZINIT_HOME"
fi

# source zinit
source "${ZINIT_HOME}/zinit.zsh"

# add plugins
zinit light Aloxaf/fzf-tab
zinit light zsh-users/zsh-autosuggestions
zinit light zsh-users/zsh-completions
zinit light zsh-users/zsh-syntax-highlighting

# powerlevel10k prompt
zinit ice depth=1
zinit light romkatv/powerlevel10k

# add snippets
zinit snippet OMZL::git.zsh
# zinit snippet OMZP::git
zinit snippet OMZP::sudo
zinit snippet OMZP::archlinux
zinit snippet OMZP::aws
zinit snippet OMZP::kubectl
zinit snippet OMZP::kubectx
zinit snippet OMZP::command-not-found

# initialise zsh's colour variables
autoload -Uz colors && colors

# load completions
autoload -Uz compinit && compinit
zinit cdreplay -q

# history
HISTFILE="$ZDOTDIR/.zsh_history"
HISTSIZE=100000
SAVEHIST=$HISTSIZE
setopt APPEND_HISTORY HIST_VERIFY EXTENDED_HISTORY INC_APPEND_HISTORY
setopt HIST_IGNORE_SPACE HIST_IGNORE_ALL_DUPS HIST_REDUCE_BLANKS SHARE_HISTORY

# shell behavior
REPORTTIME=10
LISTMAX=0
setopt NO_BEEP NO_CORRECT NO_BG_NICE NO_HUP IGNORE_EOF
setopt LOCAL_OPTIONS LOCAL_TRAPS PROMPT_SUBST
setopt MENUCOMPLETE COMPLETE_IN_WORD

# completion styles
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Z}'
zstyle ':completion:*' insert-tab pending

# ------------------------------------------------------------------------------
# prompt
# ------------------------------------------------------------------------------

# load powerlevel10k configuration
[[ -f "$ZDOTDIR/.p10k.zsh" ]] && source "$ZDOTDIR/.p10k.zsh"

# legacy manual prompt (commented out in favor of powerlevel10k)
# local CR=$'\n'
# local ICON="%(?,%{$fg[green]%}λ,%{$fg[red]%}λ)"
# if [[ -n $SSH_CONNECTION ]]; then
#   PROMPT='${CR}%n@%M:%~%{$fg[black]%}$(vcprompt)%{$reset_color%}'
# else
#   PROMPT='${CR}%~%{$fg[black]%}$(vcprompt)%{$reset_color%}'
# fi
# PROMPT="${PROMPT}${CR}${ICON}%{$reset_color%} "
# RPROMPT='%{$fg[gray]%}$($ZDOTDIR/git-cwd-info.sh)%{$reset_color%}'

# ------------------------------------------------------------------------------
# aliases
# ------------------------------------------------------------------------------

alias ....='cd ../../..'
alias ...='cd ../..'
alias ..='cd ..'
alias c='clear'
alias cdd='cd - 1>/dev/null'
alias e='vim $(fzf -m --preview "bat --color=always --style=numbers {}")'
alias gaa='git add --all'
alias gb='git branch'
alias gba='git branch -a'
alias gc='git commit --verbose'
alias gca='git commit --verbose --all'
alias gco='git checkout'
alias gd='git diff'
alias gdm='git diff main'
alias ge='vi .git/config'
alias gg='git log --graph --all'
alias ggf='git log --graph --all --pretty=fuller --decorate'
alias gl='git pull'
alias gp='git push'
alias gs='git status'
alias reload='source $ZDOTDIR/.zshrc'
alias ta='tmux attach'
alias tl='tmux ls'
# alias vim='nvim'
alias www='python3 -m http.server 8000'

# use eza for ls with icons
if command -v eza &> /dev/null; then
  alias ls='eza -lh --group-directories-first --icons=auto'
  alias l='ls'
  alias lsa='ls -a'
  alias lt='eza --tree --level=2 --long --icons --git'
  alias lta='lt -a'
else
  alias l='ls -Ahl'
  if [[ $PLATFORM == 'Darwin' ]]; then
    alias ls='ls -FG'
  else
    alias ls='ls -F --color=auto'
  fi
fi


# recursively remove .DS_Store files on macOS
if [[ $PLATFORM == 'Darwin' ]]; then
  alias dsunhook="find . -name '.DS_Store' -exec rm -rf {} \;"
fi

# top aliases for macOS
if [[ $PLATFORM == 'Darwin' ]]; then
  alias tu='top -o cpu'
  alias tm='top -o vsize'
fi

# ------------------------------------------------------------------------------
# shell integrations
# ------------------------------------------------------------------------------

# fzf
if command -v fzf &> /dev/null; then
  eval "$(fzf --zsh)"
fi

# direnv
if command -v direnv &> /dev/null; then
  eval "$(direnv hook zsh)"
fi

# mise (version manager for node, python, ruby, etc.)
if command -v mise &> /dev/null; then
  eval "$(mise activate zsh)"
fi

# zoxide (cd but smarter)
if command -v zoxide &> /dev/null; then
  eval "$(zoxide init --cmd cd zsh)"
fi

# heroku autocomplete setup
if command -v heroku &> /dev/null; then
  HEROKU_AC_CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/heroku/autocomplete"
  if [[ ! -d "$HEROKU_AC_CACHE" ]]; then
    heroku autocomplete &>/dev/null
  fi
  eval "$(heroku autocomplete:script zsh)" 2>/dev/null || true
fi
