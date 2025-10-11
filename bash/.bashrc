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
  PS1="\n\w\\[$YELLOW\]\$(vcprompt)\[$RESET_COLOR\]"
fi
PS1="$PS1\n\[$GREEN\]λ\[$RESET_COLOR\] "

# ------------------------------------------------------------------------------
# tool integrations
# ------------------------------------------------------------------------------

# direnv hook
if which direnv > /dev/null; then
  eval "$(direnv hook bash)"
fi

# pyenv shim
if which pyenv > /dev/null; then
  eval "$(pyenv init -)"
  eval "$(pyenv virtualenv-init -)"
fi

# rbenv shim
if which rbenv > /dev/null; then
  eval "$(rbenv init -)"
fi

# load node version manager
if [[ -d "$HOME/.nvm" && -s "$HOME/.nvm/nvm.sh" ]]; then
  source $HOME/.nvm/nvm.sh
fi

# ------------------------------------------------------------------------------
# aliases
# ------------------------------------------------------------------------------

# ./bin
alias bb=./bin/build.sh

# docker
alias dps='docker ps'

# cd
alias ..='cd ..'
alias ...='cd ../..'
alias ....='cd ../../..'
alias cdd='cd - 1>/dev/null'

# cucumber
alias cuc='cucumber -r ./features'

# edit
alias eb='vi ~/.bashrc && reload'
alias eg='vi .git/config'

# exit
alias e='exit'

# git
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

# git functions
function gch() {
  git clone git://github.com/$USER/$1.git
}

# ls
alias l='ls -Ahl'
# platform specific override of ls
if [[ $PLATFORM == 'Linux' ]]; then
  alias ls='ls -F --color'
elif [[ $PLATFORM == 'Darwin' ]]; then
  alias ls='ls -FG'
fi

# mkdir
alias md='mkdir -p'

# mkdir functions
function mdc() {
  mkdir -p "$1"
  cd "$1"
}

# osx
alias dsunhook="find . -name '.DS_Store' -exec rm -rf {} \;"

# rails
alias a='autotest -rails'
alias freeze='rake rails:freeze:gems'
alias migrate='rake db:migrate db:test:clone'
alias rc='rails console'
alias rs='rails server -p 8080'
alias rst='touch tmp/restart.txt'
alias sc='./script/console'
alias ss='./script/server'
alias sg='./script/generate'
alias tlog='tail -f log/development.log'

# reload
alias reload='source ~/.bashrc'

# subversion
alias scom='svn commit'
alias sd='svn diff \!*'
alias sdd='svn diff -r PREV'
alias sex='svn export'
alias slog='svn log | more'
alias sst='svn status'
alias sup='svn update'

# tmux
alias ta='tmux attach'
alias tl='tmux ls'

# util
alias www='python3 -m http.server 8000'
