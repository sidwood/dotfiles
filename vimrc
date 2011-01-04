" SETTINGS
""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
set nocompatible

" Initialize pathogen bundles
filetype off
call pathogen#runtime_append_all_bundles()
filetype on

" GNOME terminal supports 256 colors but reports 8 colors
if $COLORTERM == 'gnome-terminal'
  set t_Co=256
endif

" Color scheme
if &t_Co == 256 || has('gui_running')
  set background=dark
  colorscheme lucius
endif

" Macvim and gvim settings
if has('gui_running')
  set guifont=Menlo-Regular:h18
  set guioptions=aAc
  set guioptions-=Be
endif

" Set leader
let mapleader=","

" Backup and swap file settings
set nobackup
set nowritebackup
set noswapfile

" Allow hidden buffers without warning
set hidden

" Enable command-line <Tab> completion
set wildmenu

" Fix backspace
set backspace=indent,eol,start

" Spelling
set spelllang=en_gb

" Search
set ignorecase
set smartcase
set hlsearch

" Scroll
set scrolloff=4

" Appearance
syntax enable
set autoindent
set cursorline
set showmatch
set nowrap

" Line numbers
set number
set numberwidth=4

" Windows
set splitbelow
set splitright
set winwidth=84
set winheight=5
set winminheight=5
set winheight=999

" Remove lucius bold text StatusLine
hi StatusLine gui=none
hi StatusLine cterm=none

" Custom status line highlight group
" Used for modified flag (based on lucius Error)
hi User1 guifg=#e37170 guibg=#432323 gui=bold
hi User1 ctermfg=167 ctermbg=52 cterm=bold

" Status line
set laststatus=2 " always show statusline
set statusline=
set statusline+=\ %F " space and full filename
set statusline+=%1* " switch to User1 highlight group
set statusline+=%m " modified flag [+] or [-]
set statusline+=%* " restore normal highlight
set statusline+=%r " read only flag [RO]
set statusline+=%w " preview flag [Preview]
set statusline+=[ " open square bracket
set statusline+=%{strlen(&ft)?&ft:'none'} " (space) file type
set statusline+=: " separator
set statusline+=%{strlen(&fenc)?&fenc:&enc} " file encoding
set statusline+=: " separator
set statusline+=%{&ff} " file format
set statusline+=] " close square bracket
set statusline+=%= " right align
set statusline+=c%c " cursor column
set statusline+=\ r%l/%L " (space) line/total lines

" Cursor position info
set ruler " not visible with status line enabled but what the heck

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

" Highlight characters that exceed column 80
hi OverLength ctermbg=239 guibg=#202438
match OverLength /\%81v.\+/

" MAPPINGS
""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

" Navigate displayed lines over numbered lines
nmap k gk
nmap j gj

" Clear search results
nnoremap <CR> :nohlsearch<CR>/<BS>

" Toggle spell checking
nmap <leader>sc :set spell!<CR>/<BS>

" Edit vimrc in new tab
nmap <leader>vi :tabe ~/.vimrc<CR>/<BS>

" Source current file
nmap <leader>so :so %<CR>/<BS>

" View current file in new tab
nmap <leader>nt <C-W>T

" Toggle whitespace characters
nmap <leader>l :set list!<CR>/<BS>

" Toggle NERDTree
nmap <leader>m :NERDTreeToggle<CR>/<BS>

" Remap tab key to autocomplete or indent depending on context
inoremap <Tab> <C-r>=<SID>SmartTabComplete()<CR>
inoremap <S-Tab> <C-n>

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

" AUTOCMD
""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

if has("autocmd")
  " Whitespace preferences
  autocmd filetype make setlocal ts=8 sts=8 sw=8 noexpandtab
  autocmd filetype yaml setlocal ts=2 sts=2 sw=2 expandtab
  autocmd Bufread,BufNewFile *gitconfig setlocal ts=8 sts=8 sw=8 noexpandtab
  autocmd Bufread,BufNewFile *gitmodules setlocal ts=8 sts=8 sw=8 noexpandtab

  " Remove trailing whitespace
  autocmd BufWritePre * :call <SID>StripTrailingWhitespaces()
endif

" FUNCTIONS
""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

" Tab key autocompletion or indentation depending on context
function! <SID>SmartTabComplete()
  let col = col('.') - 1
  if !col || getline('.')[col - 1] !~ '\k'
    return "\<Tab>"
  else
    return "\<C-p>"
  endif
endfunction

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
