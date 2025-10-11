# source shared environment variables
. ~/.profile

# ------------------------------------------------------------------------------
# shell options
# ------------------------------------------------------------------------------

# increase file descriptor soft limit
ulimit -n 2560

# show dotfiles first when using ls on Linux platforms
if [[ $PLATFORM == 'Linux' ]]; then
  export LC_COLLATE='C'
fi

# force xterm to screen-256color to improve tmux colors
if [[ $TERM == 'xterm' ]]; then
  export TERM='screen-256color'
fi

# history
HISTSIZE=100000
HISTFILESIZE=100000
HISTCONTROL=ignoreboth:erasedups
shopt -s histappend

# ------------------------------------------------------------------------------
# colors (from http://wiki.archlinux.org/index.php/Color_Bash_Prompt)
# ------------------------------------------------------------------------------

# reset
RESET_COLOR='\e[0m'

# regular colors
BLACK='\e[0;30m'
RED='\e[0;31m'
GREEN='\e[0;32m'
YELLOW='\e[0;33m'
BLUE='\e[0;34m'
MAGENTA='\e[0;35m'
CYAN='\e[0;36m'
WHITE='\e[0;37m'

# emphasized (bolded) colors
EBLACK='\e[1;30m'
ERED='\e[1;31m'
EGREEN='\e[1;32m'
EYELLOW='\e[1;33m'
EBLUE='\e[1;34m'
EMAGENTA='\e[1;35m'
ECYAN='\e[1;36m'
EWHITE='\e[1;37m'

# underlined colors
UBLACK='\e[4;30m'
URED='\e[4;31m'
UGREEN='\e[4;32m'
UYELLOW='\e[4;33m'
UBLUE='\e[4;34m'
UMAGENTA='\e[4;35m'
UCYAN='\e[4;36m'
UWHITE='\e[4;37m'

# background colors
BBLACK='\e[40m'
BRED='\e[41m'
BGREEN='\e[42m'
BYELLOW='\e[43m'
BBLUE='\e[44m'
BMAGENTA='\e[45m'
BCYAN='\e[46m'
BWHITE='\e[47m'

# ------------------------------------------------------------------------------
# prompt
# ------------------------------------------------------------------------------

if [[ -n $SSH_CONNECTION ]]; then
  PS1="\n\u@\H:\w\[$YELLOW\]\$(vcprompt)\[$RESET_COLOR\]"
else
  PS1="\n\w\[$YELLOW\]\$(vcprompt)\[$RESET_COLOR\]"
fi
PS1="$PS1\n\[$GREEN\]λ\[$RESET_COLOR\] "

# ------------------------------------------------------------------------------
# aliases
# ------------------------------------------------------------------------------

alias ....='cd ../../..'
alias ...='cd ../..'
alias ..='cd ..'
alias c='clear'
alias cdd='cd - 1>/dev/null'
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
alias reload='source ~/.bashrc'
alias ta='tmux attach'
alias tl='tmux ls'
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

# direnv
if command -v direnv &> /dev/null; then
  eval "$(direnv hook bash)"
fi

# lazy load pyenv
if [[ -d "$HOME/.pyenv" ]]; then
  export PYENV_ROOT="$HOME/.pyenv"
  export PATH="$PYENV_ROOT/bin:$PATH"
  pyenv() {
    unset -f pyenv
    eval "$(command pyenv init -)"
    eval "$(command pyenv virtualenv-init -)"
    pyenv "$@"
  }
fi

# lazy load rbenv
if [[ -d "$HOME/.rbenv" ]]; then
  export PATH="$HOME/.rbenv/bin:$PATH"
  rbenv() {
    unset -f rbenv
    eval "$(command rbenv init -)"
    rbenv "$@"
  }
fi

# lazy load nvm
if [[ -d "$HOME/.nvm" ]]; then
  export NVM_DIR="$HOME/.nvm"
  nvm() {
    unset -f nvm node npm npx
    [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
    nvm "$@"
  }
  node() { nvm use default &>/dev/null; command node "$@"; }
  npm() { nvm use default &>/dev/null; command npm "$@"; }
  npx() { nvm use default &>/dev/null; command npx "$@"; }
fi
