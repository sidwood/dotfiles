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

" Appearance
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
