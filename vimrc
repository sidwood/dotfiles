set nocompatible
filetype off
call pathogen#runtime_append_all_bundles()
filetype on

""""""""""""
" SETTINGS
""""""""""""

" Enable 256 colors
set t_Co=256

" Color scheme
set background=dark
colorscheme lucius

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

" Spelling
set spelllang=en_gb

" Seach ignores case
set ignorecase

" Highlight search results
set hlsearch

" Appearance
syntax enable
set autoindent
set cursorline
set showmatch
set nowrap

" Windows
set splitbelow
set splitright
set winwidth=84
set winheight=5
set winminheight=5
set winheight=999

" Cursor position info
set ruler

" Line numbers
set number
set numberwidth=4

" Whitespace
set nolist
set listchars=tab:▸\ ,eol:¬
set tabstop=2     " width of tab characters (default 8)
set softtabstop=2 " width of edit operations using <Tab> and <BS> (default 0)
set shiftwidth=2  " width of normal mode block shift (default 8)
set expandtab     " use spaces instead of tabs (default noexpandtab)

" NERDTree settings
let NERDTreeIgnore = ['\.git$']
let NERDTreeShowHidden = 1

"""""""""""
" MAPPINGS
"""""""""""

" Navigate displayed lines over numbered lines
nmap k gk
nmap j gj

" Clear search results
nmap <leader>c :nohlsearch<CR>

" Toggle spell checking
nmap <leader>sc :set spell!<CR>

" Edit vimrc in new tab
nmap <leader>vi :tabe ~/.vimrc<CR>

" Source current file
nmap <leader>so :so %<CR>

" View current file in new tab
nmap <leader>nt <C-W>T

" Toggle whitespace characters
nmap <leader>l :set list!<CR>

" Toggle NERDTree
nmap <leader>m :NERDTreeToggle<CR>

" Window focus
map <C-h> <C-w>h
map <C-j> <C-w>j
map <C-k> <C-w>k
map <C-l> <C-w>l

" Disable arrow keys
map <Left> <Nop>
map <Right> <Nop>
map <Up> <Nop>
map <Down> <Nop>

" Open file from current file directory
map <leader>ew :e <C-R>=expand("%:p:h") . "/" <CR>
map <leader>es :sp <C-R>=expand("%:p:h") . "/" <CR>
map <leader>ev :vsp <C-R>=expand("%:p:h") . "/" <CR>
map <leader>et :tabe <C-R>=expand("%:p:h") . "/" <CR>

"""""""""""
" AUTOCMD
"""""""""""

if has("autocmd")
  " Whitespace preferences
  autocmd filetype make setlocal ts=8 sts=8 sw=8 noexpandtab
  autocmd filetype yaml setlocal ts=2 sts=2 sw=2 expandtab
  autocmd Bufread,BufNewFile *gitconfig setlocal ts=8 sts=8 sw=8 noexpandtab
  autocmd Bufread,BufNewFile *gitmodules setlocal ts=8 sts=8 sw=8 noexpandtab

  " Remove trailing whitespace
  autocmd BufWritePre * :call <SID>StripTrailingWhitespaces()
endif

"""""""""""""""""
" UTIL FUNCTIONS
"""""""""""""""""

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
