" Use Vim over Vi settings (must come first)
set nocompatible

" Set leader
let mapleader=","

" Backup and swap file settings
set nobackup
set nowritebackup
set noswapfile

" Fix backspace
set backspace=indent,eol,start

" Whitespace
set tabstop=2     " width of tab characters (default 8)
set softtabstop=2 " width of edit operations using <Tab> and <BS> (default 0)
set shiftwidth=2  " width of normal mode block shift (default 8)
set expandtab     " use spaces instead of tabs (default noexpandtab)

" Appearance
syntax enable
set autoindent
set ruler
set cursorline
set number
set numberwidth=4
set showmatch
set nowrap

" Invisible characters
set nolist
set listchars=tab:▸\ ,eol:¬
nmap <leader>l :set list!<CR>

" Disable arrow keys
map <Left> <Nop>
map <Right> <Nop>
map <Up> <Nop>
map <Down> <Nop>

" Plugins
source ~/.vim/plugins/tabsize.vim
