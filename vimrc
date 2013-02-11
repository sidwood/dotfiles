" INIT
""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

" Vi IMproved
set nocompatible

" Initialize vundle
filetype off
set rtp+=~/.vim/bundle/vundle
call vundle#rc()

Bundle 'gmarik/vundle'

" Color
Bundle 'altercation/vim-colors-solarized'

" Utils
Bundle 'mileszs/ack.vim'
Bundle 'kien/ctrlp.vim'
Bundle 'scrooloose/nerdtree'
Bundle 'scrooloose/syntastic'
Bundle 'godlygeek/tabular'
Bundle 'SirVer/ultisnips'
Bundle 'Townk/vim-autoclose'
Bundle 'tpope/vim-bundler'
Bundle 'tpope/vim-commentary'
Bundle 'tpope/vim-endwise'
Bundle 'tpope/vim-fugitive'
Bundle 'tpope/vim-git'
Bundle 'tpope/vim-rails'
Bundle 'tpope/vim-surround'
Bundle 'nathanaelkane/vim-indent-guides'

" Syntax
Bundle 'kchmck/vim-coffee-script'
Bundle 'tpope/vim-cucumber'
Bundle 'tpope/vim-haml'
Bundle 'digitaltoad/vim-jade'
Bundle 'pangloss/vim-javascript'
Bundle 'elzr/vim-json'
Bundle 'groenewege/vim-less'
Bundle 'plasticboy/vim-markdown'
Bundle 'mustache/vim-mustache-handlebars'
Bundle 'slim-template/vim-slim'
Bundle 'wavded/vim-stylus'
Bundle 'puppetlabs/puppet-syntax-vim'

filetype plugin indent on

" COLORS
""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

" GNOME terminal supports 256 colors but reports 8 colors
if $COLORTERM == 'gnome-terminal'
  set t_Co=256
endif

" Syntax highlighting
if &t_Co > 8 || has('gui_running')
  syntax on
else
  syntax off
endif

" Color scheme
if $COLORTERM == 'gnome-terminal'
  set background=dark
  colorscheme lucius
elseif &t_Co == 256 || has('gui_running')
  set background=dark
  colorscheme solarized

  " Spelling highlights taken from lucius
  highlight SpellBad guisp=#ee0000 gui=undercurl
  highlight SpellBad ctermbg=196 cterm=undercurl
  highlight SpellCap guisp=#eeee00 gui=undercurl
  highlight SpellCap ctermbg=226 cterm=undercurl
  highlight SpellRare guisp=#ffa500 gui=undercurl
  highlight SpellRare ctermbg=214 cterm=undercurl
  highlight SpellLocal guisp=#ffa500 gui=undercurl
  highlight SpellLocal ctermbg=214 cterm=undercurl
endif

" Right margin
if exists('+colorcolumn')
  let &colorcolumn=join(range(81,999),",")
else
  " Highlight characters that exceed column 80
  hi OverLength ctermbg=239 guibg=#202438
  match OverLength /\%81v.\+/
endif

" SETTINGS
""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

" Set leader
let mapleader=","

" Set encoding
set encoding=utf-8
set fileencoding=utf-8

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
set statusline+=%{fugitive#statusline()} " fugitive plugin status line
set statusline+=%r " read only flag [RO]
set statusline+=%w " preview flag [Preview]
set statusline+=[ " open square bracket
set statusline+=%{strlen(&ft)?&ft:'none'} " file type
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

" Macvim and gvim settings
if has('gui_running')
  set guifont=Menlo-Regular:h18
  set guioptions=aAc
  set guioptions-=Be
endif

" CtrlP settings
let g:ctrlp_show_hidden = 1

" Markdown settings
let g:vim_markdown_folding_disabled = 1

" NERDTree settings
let NERDTreeIgnore = ['\.git$']
let NERDTreeShowHidden = 1

" Syntastic settings
let g:syntastic_error_symbol = '✗'
let g:syntastic_warning_symbol = '⚠'
" let g:syntastic_quiet_warnings = 1

" UltiSnips settings
let g:UltiSnipsEditSplit = 'vertical'
let g:UltiSnipsSnippetsDir = '~/.vim/snippets'
let g:UltiSnipsListSnippets='<c-l>'
let g:UltiSnipsExpandTrigger = '<tab>'
let g:UltiSnipsJumpForwardTrigger = '<tab>'
let g:UltiSnipsJumpBackwardTrigger = '<s-tab>'

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

" Edit TODO file in new tab
nmap <leader>td :tabe ~/Google\ Drive/Notes/TODO<CR>/<BS>

" Source current file
nmap <leader>so :so %<CR>/<BS>

" View current file in new tab
nmap <leader>nt <C-W>T

" Toggle invisible characters
nmap <leader>ll :set list!<CR>/<BS>

" Toggle NERDTree
nmap <leader>m :NERDTreeToggle<CR>/<BS>

" Cucumber table auto-alignment
inoremap <silent> <Bar>  <Bar><Esc>:call <SID>CucumberTableAlign()<CR>a

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
cnoremap %% <C-R>=fnameescape(expand('%:p:h')).'/'<CR>
map <leader>ew :e %%
map <leader>es :sp %%
map <leader>ev :vsp %%
map <leader>et :tabe %%

" Toggle between absolute and relative line numbers
if exists('+relativenumber')
  nnoremap <space> :call <SID>NumberToggle()<CR>
endif

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

  " Automatically remove hidden fugitive buffers
  autocmd BufReadPost fugitive://* set bufhidden=delete
endif

" FUNCTIONS
""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

" Call tabularize plugin to align '|' characters in a cucumber feature file
" https://gist.github.com/tpope/287147
function! s:CucumberTableAlign()
  let p = '^\s*|\s.*\s|\s*$'
  if exists(':Tabularize') && getline('.') =~# '^\s*|'
    if getline(line('.')-1) =~# p || getline(line('.')+1) =~# p
      let col = strlen(substitute(getline('.')[0:col('.')],'[^|]','','g'))
      let pos = strlen(matchstr(getline('.')[0:col('.')],'.*|\s*\zs.*'))
      Tabularize/|/l1
      normal! 0
      call search(repeat('[^|]*|',col).'\s\{-\}'.repeat('.',pos),'ce',line('.'))
    endif
  endif
endfunction

" Toggle between absolute and relative line numbers
function! s:NumberToggle()
  if(&relativenumber == 1)
    set number
    set norelativenumber
  else
    set nonumber
    set relativenumber
  endif
endfunction

" Strip trailing whitespace function
function! s:StripTrailingWhitespaces()
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
