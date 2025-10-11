# source shared environment variables
. ~/.profile

# ------------------------------------------------------------------------------
# shell options
# ------------------------------------------------------------------------------

# initialize homebrew
if [[ $PLATFORM == "Darwin" && -f "/opt/homebrew/bin/brew" ]]; then
  eval $(/opt/homebrew/bin/brew shellenv)
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
zinit light lukechilds/zsh-nvm
zinit light zsh-users/zsh-autosuggestions
zinit light zsh-users/zsh-completions
zinit light zsh-users/zsh-syntax-highlighting

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
HISTFILE=~/.zsh-history
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

local CR=$'\n'
local ICON="%(?,%{$fg[green]%}λ,%{$fg[red]%}λ)"
if [[ -n $SSH_CONNECTION ]]; then
  PROMPT='${CR}%n@%M:%~%{$fg[black]%}$(vcprompt)%{$reset_color%}'
else
  PROMPT='${CR}%~%{$fg[black]%}$(vcprompt)%{$reset_color%}'
fi
PROMPT="${PROMPT}${CR}${ICON}%{$reset_color%} "
RPROMPT='%{$fg[gray]%}$($ZDOTDIR/git-cwd-info.sh)%{$reset_color%}'

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
alias gdm='git diff master'
alias ge='vi .git/config'
alias gg='git log --graph --all'
alias ggf='git log --graph --all --pretty=fuller --decorate'
alias gl='git pull'
alias gp='git push'
alias gs='git status'
alias l='ls -Ahl'
alias ls='ls -F --color'
alias reload='source $ZDOTDIR/.zshrc'
alias ta='tmux attach'
alias tl='tmux ls'
# alias vim='nvim'
alias www='python3 -m http.server 8000'

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

# lazy load pyenv
if [[ -d "$HOME/.pyenv" ]]; then
  export PYENV_ROOT="$HOME/.pyenv"
  path=("$PYENV_ROOT/bin" $path)
  pyenv() {
    unfunction pyenv
    eval "$(command pyenv init -)"
    eval "$(command pyenv virtualenv-init -)"
    pyenv "$@"
  }
fi

# lazy load rbenv
if [[ -d "$HOME/.rbenv" ]]; then
  path=("$HOME/.rbenv/bin" $path)
  rbenv() {
    unfunction rbenv
    eval "$(command rbenv init -)"
    rbenv "$@"
  }
fi

# zoxide (cd but smarter)
if command -v zoxide &> /dev/null; then
  eval "$(zoxide init --cmd cd zsh)"
fi

# heroku autocomplete setup
if command -v heroku &> /dev/null; then
  eval "$(heroku autocomplete:script zsh)"
fi
