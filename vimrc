" Use Vim over Vi settings (must come first)
set nocompatible

" Set leader
let mapleader=","

" Backup and swap file settings
set nobackup
set nowritebackup
set noswapfile

" Allow hidden buffers without warning
set hidden

" Fix backspace
set backspace=indent,eol,start

" Whitespace
set tabstop=2     " width of tab characters (default 8)
set softtabstop=2 " width of edit operations using <Tab> and <BS> (default 0)
set shiftwidth=2  " width of normal mode block shift (default 8)
set expandtab     " use spaces instead of tabs (default noexpandtab)

" Strip trailing whitespace function
function! <SID>StripTrailingWhitespaces()
  " Save search history and cursor position
  let _s = @/
  let l = line(".")
  let c = col(".")
  " Remove the whitespace
  %s/\s\+$//e
  " Restore search history and cursor position
  let @/ = _s
  call cursor(l, c)
endfunction

" Only do this when vim is compiled with support for autocommands
if has("autocmd")
  " Enable file type detection
  filetype on

  " Whitespace preferences
  autocmd filetype make setlocal ts=8 sts=8 sw=8 noexpandtab
  autocmd filetype yaml setlocal ts=2 sts=2 sw=2 expandtab
  autocmd Bufread,BufNewFile *gitconfig setlocal ts=8 sts=8 sw=8 noexpandtab

  " Remove trailing whitespace
  autocmd BufWritePre * :call <SID>StripTrailingWhitespaces()
endif

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

" Window focus
map <C-h> <C-w>h
map <C-j> <C-w>j
map <C-k> <C-w>k
map <C-l> <C-w>l
