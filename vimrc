" PLUGIN INITIALIZATION
""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

" Vi IMproved
set nocompatible

" Disable file type detection
filetype off

" Initialize vundle
set rtp+=~/.vim/bundle/Vundle.vim
call vundle#begin()

Plugin 'VundleVim/Vundle.vim'

" Color
Plugin 'cyplo/vim-colors-solarized'
Plugin 'jonathanfilip/vim-lucius'

" Status line
Plugin 'edkolev/tmuxline.vim'
Plugin 'vim-airline/vim-airline'
Plugin 'vim-airline/vim-airline-themes'

" Utils
Plugin 'rking/ag.vim'
Plugin 'kien/ctrlp.vim'
Plugin 'Raimondi/delimitMate'
Plugin 'editorconfig/editorconfig-vim'
Plugin 'sjl/gundo.vim'
Plugin 'scrooloose/nerdtree'
Plugin 'scrooloose/syntastic'
Plugin 'godlygeek/tabular'
Plugin 'SirVer/ultisnips'
Plugin 'tpope/vim-bundler'
Plugin 'tpope/vim-rake'
Plugin 'tpope/vim-commentary'
Plugin 'tpope/vim-dispatch'
Plugin 'tpope/vim-endwise'
Plugin 'tpope/vim-eunuch'
Plugin 'tpope/vim-fugitive'
Plugin 'tpope/vim-git'
Plugin 'airblade/vim-gitgutter'
Plugin 'jistr/vim-nerdtree-tabs'
Plugin 'tpope/vim-rails'
Plugin 'thoughtbot/vim-rspec'
Plugin 'vim-ruby/vim-ruby'
Plugin 'honza/vim-snippets'
Plugin 'tpope/vim-surround'
Plugin 'Yggdroot/indentLine'
Plugin 'mattn/emmet-vim'

" Syntax
Plugin 'dart-lang/dart-vim-plugin'
Plugin 'kchmck/vim-coffee-script'
Plugin 'tpope/vim-cucumber'
Plugin 'elixir-lang/vim-elixir'
Plugin 'fatih/vim-go'
Plugin 'tpope/vim-haml'
Plugin 'digitaltoad/vim-jade'
Plugin 'pangloss/vim-javascript'
Plugin 'mitsuhiko/vim-jinja'
Plugin 'elzr/vim-json'
Plugin 'groenewege/vim-less'
Plugin 'plasticboy/vim-markdown'
Plugin 'mustache/vim-mustache-handlebars'
Plugin 'slim-template/vim-slim'
Plugin 'wavded/vim-stylus'
Plugin 'puppetlabs/puppet-syntax-vim'
Plugin 'leafgarland/typescript-vim'
Plugin 'lambdatoast/elm.vim'

" Finalize vundle initialization
call vundle#end()

" Enable file type detection
filetype plugin indent on

" PLUGIN SETTINGS
""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

" Airline settings
if isdirectory(expand('~/.vim/bundle/vim-airline'))
  let g:airline_powerline_fonts = 1
  let g:airline#extensions#tabline#enabled = 1
endif

" CtrlP settings
if isdirectory(expand('~/.vim/bundle/ctrlp.vim'))
  let g:ctrlp_show_hidden = 1
  " Use ag if available
  if executable('ag')
    " Silver searcher will exclude files in .gitignore
    let g:ctrlp_user_command = 'ag %s -l --nocolor --hidden -g ""'
    " No need to cache when using ag
    let g:ctrlp_use_caching = 0
  endif
endif

" delimitMate settings
if isdirectory(expand('~/.vim/bundle/delimitMate'))
  let g:delimitMate_expand_cr = 1
  let g:delimitMate_expand_space = 1
endif

" EditorConfig settings
if isdirectory(expand('~/.vim/bundle/editorconfig-vim'))
  let g:EditorConfig_verbose=0
endif

" Emmet settings
if isdirectory(expand('~/.vim/bundle/emmet-vim'))
  let g:user_emmet_leader_key = '<leader>e'
endif

" Gundo settings
if isdirectory(expand('~/.vim/bundle/gundo.vim'))
  let g:gundo_right = 1
  let g:gundo_preview_bottom = 1
endif

" NERDTree settings
if isdirectory(expand('~/.vim/bundle/nerdtree'))
  let NERDTreeIgnore = ['\.git$']
  let NERDTreeShowHidden = 1
endif

" Syntastic settings
if isdirectory(expand('~/.vim/bundle/syntastic'))
  let g:syntastic_error_symbol = '✗'
  let g:syntastic_warning_symbol = '⚠'
  let g:syntastic_javascript_checkers = ['eslint', 'jshint', 'jscs']
  " Ignore common AngularJS HTML errors
  let g:syntastic_html_tidy_ignore_errors = [
    \ 'lacks "action" attribute',
    \ 'discarding unexpected',
    \ 'proprietary attribute',
    \ 'is not recognized',
    \ 'trimming empty',
    \ 'unescaped &'
    \ ]
endif

" UltiSnips settings
if isdirectory(expand('~/.vim/bundle/ultisnips'))
  let g:snips_author = 'Sid Wood'
  let g:snips_author_email = 'sidwood@me.com'
  let g:UltiSnipsEditSplit = 'vertical'
  let g:UltiSnipsSnippetsDir = '~/.vim/snips'
  let g:UltiSnipsSnippetDirectories = ['UltiSnips', 'snips']
  let g:UltiSnipsListSnippets='<c-l>'
  let g:UltiSnipsExpandTrigger = '<tab>'
  let g:UltiSnipsJumpForwardTrigger = '<tab>'
  let g:UltiSnipsJumpBackwardTrigger = '<s-tab>'
endif

" VimMarkdown settings
if isdirectory(expand('~/.vim/bundle/vim-markdown'))
  let g:vim_markdown_folding_disabled = 1
endif

" GitGutter settings
if isdirectory(expand('~/.vim/bundle/vim-gitgutter'))
  let g:gitgutter_sign_column_always = 1
endif

" Json settings
if isdirectory(expand('~/.vim/bundle/vim-json'))
  let g:vim_json_syntax_conceal = 0
endif

" Markdown settings
if isdirectory(expand('~/.vim/bundle/vim-markdown'))
  let g:vim_markdown_folding_disabled = 1
endif

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

" Highlight errors
match Error /\%81v.\+/

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
set incsearch

" Use ag over grep
if executable('ag')
  set grepprg=ag\ --nogroup\ --nocolor
endif

" Scroll
set scrolloff=4

" Appearance
set autoindent
set cursorline
set showmatch
set nowrap

" No beeps
set visualbell

" Line numbers
set numberwidth=4
if exists('+relativenumber')
  set number
  set relativenumber
else
  set number
endif

" Windows
set splitbelow
set splitright
set winwidth=86
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
if has('statusline')
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
endif

" Cursor position info
set ruler " not visible with status line enabled but what the heck

" Whitespace
set nolist
set listchars=tab:▸\ ,eol:¬
set tabstop=2     " width of tab characters (default 8)
set softtabstop=2 " width of edit operations using <Tab> and <BS> (default 0)
set shiftwidth=2  " width of normal mode block shift (default 8)
set expandtab     " use spaces instead of tabs (default noexpandtab)

" Folding
set foldmethod=indent
set foldnestmax=10
set foldlevel=2
set nofoldenable

" Macvim and gvim settings
if has('gui_running')
  set guifont=Menlo-Regular:h18
  set guioptions=aAc
  set guioptions-=Be
endif

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

" Toggle background color
map <leader>bg :let &background = (&background == 'dark' ? 'light' : 'dark')<CR>

" Toggle invisible characters
nmap <leader>ll :set list!<CR>/<BS>

if exists('+relativenumber')
  " Toggle line number display
  nmap <leader>ln :call <SID>LineNumberToggle()<CR>/<BS>

  " Toggle between absolute and relative line numbers
  nnoremap <space> :call <SID>AbsoluteRelativeLineNumberToggle()<CR>/<BS>
endif

" Toggle GitGutter
if isdirectory(expand('~/.vim/bundle/vim-gitgutter'))
  nmap <leader>lg :GitGutterToggle<CR>/<BS>
endif

" Toggle Gundo
if isdirectory(expand('~/.vim/bundle/gundo.vim'))
  nmap <leader>u :GundoToggle<CR>/<BS>
endif

" Toggle indentLine
if isdirectory(expand('~/.vim/bundle/indentLine'))
  nmap <leader>ig :IndentLinesToggle<CR>/<BS>
endif

" Toggle NERDTree
if isdirectory(expand('~/.vim/bundle/nerdtree'))
  nmap <leader>m :NERDTreeMirrorToggle<CR>/<BS>
  nmap <leader>ff :NERDTreeFind<CR>/<BS>
endif

" Toggle Syntastic
if isdirectory(expand('~/.vim/bundle/syntastic'))
  nmap <leader>ls :SyntasticToggleMode<CR>/<BS>
endif

" Dispatch asynchronous command
if isdirectory(expand('~/.vim/bundle/vim-dispatch'))
  nnoremap <leader>d :call <SID>DispatchCommand()<CR>/<BS>
endif

" vim-rspec mappings
if isdirectory(expand('~/.vim/bundle/vim-rspec'))
  map <leader>rt :call RunCurrentSpecFile()<CR>/<BS>
  map <leader>rs :call RunNearestSpec()<CR>/<BS>
  map <leader>rl :call RunLastSpec()<CR>/<BS>
  map <leader>ra :call RunAllSpecs()<CR>/<BS>
endif

" Cucumber table auto-alignment
inoremap <silent> <Bar>  <Bar><Esc>:call <SID>CucumberTableAlign()<CR>a

" Preserve indentation while pasting text from OSX clipboard
noremap <leader>p :set paste<CR>:put  *<CR>:set nopaste<CR>

" Easier horizontal scrolling
map zl zL
map zh zH

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

" AUTOCMD
""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

if has("autocmd")
  " Filetype definitions
  autocmd Bufread,BufNewFile *.handlebars set filetype=mustache
  autocmd Bufread,BufNewFile *.hbs set filetype=mustache
  autocmd Bufread,BufNewFile *.j2 set filetype=jinja
  autocmd Bufread,BufNewFile .eslintrc,.jscsrc,.jshintrc set filetype=json
  autocmd Bufread,BufNewFile .babelrc set filetype=json

  " Whitespace preferences
  autocmd FileType make setlocal ts=8 sts=8 sw=8 noexpandtab
  autocmd FileType markdown,mkd setlocal ts=4 sts=4 sw=4 expandtab
  autocmd FileType yaml setlocal ts=2 sts=2 sw=2 expandtab
  autocmd Bufread,BufNewFile *gitconfig setlocal ts=8 sts=8 sw=8 noexpandtab
  autocmd Bufread,BufNewFile *gitmodules setlocal ts=8 sts=8 sw=8 noexpandtab

  " Markdown auto textwidth
  autocmd Bufread,BufNewFile *.markdown,*.md set textwidth=79

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
function! s:AbsoluteRelativeLineNumberToggle()
  if(&relativenumber == 1)
    set number
    set norelativenumber
  else
    set number
    set relativenumber
  endif
endfunction

" Toggle line numbers
function! s:LineNumberToggle()
  if(&relativenumber == 1)
    set nonumber
    set norelativenumber
  elseif(&number == 1)
    set nonumber
    set norelativenumber
  else
    set number
    set norelativenumber
  endif
endfunction

" Call dispatch command with provided input
function! s:DispatchCommand()
  let dispatch_command = input('> ')
  execute ':Dispatch ' . dispatch_command
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
