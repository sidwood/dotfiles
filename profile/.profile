# shared environment variables (POSIX-compatible)
# sourced by both .zshenv and .bashrc

PLATFORM=$(uname)
export EDITOR="vim"

# reset PATH
export PATH=/usr/bin:/usr/sbin:/bin:/sbin

# add /usr/local/bin and sbin to PATH
export PATH=/usr/local/bin:/usr/local/sbin:$PATH

# add home .bin to PATH
export PATH=$HOME/.bin:$PATH

# add /usr/local/heroku/bin to PATH
export PATH=/usr/local/heroku/bin:$PATH

# add local node_modules/.bin to PATH
export PATH=./node_modules/.bin:$PATH

# professional cow-free environment
export ANSIBLE_NOCOWS=1

# npm XDG config location
export NPM_CONFIG_USERCONFIG="${XDG_CONFIG_HOME:-$HOME/.config}/npm/npmrc"

# get my gopher on
export GOPATH=$HOME/code/golang
export PATH=$GOPATH/bin:$PATH

# add my timecraft cli tool to PATH (temp solution)
export PATH=$HOME/code/timecraft/bin:$PATH

# set node version manager directory
if [ -d "$HOME/.nvm" ] && [ -s "$HOME/.nvm/nvm.sh" ]; then
  export NVM_DIR=$HOME/.nvm
fi

# add pyenv to PATH
if [ -d "$HOME/.pyenv" ] && [ -s "$HOME/.pyenv/bin/pyenv" ]; then
  export PATH=$HOME/.pyenv/bin:$PATH
fi

# add rbenv to PATH
if [ -d "$HOME/.rbenv" ] && [ -s "$HOME/.rbenv/bin/rbenv" ]; then
  export PATH=$HOME/.rbenv/bin:$PATH
fi
