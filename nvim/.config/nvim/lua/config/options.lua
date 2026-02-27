-- Set leader (must be set before lazy.nvim loads for plugin keymaps)
vim.g.mapleader = ","

-- Whitespace
vim.opt.expandtab = true
vim.opt.tabstop = 2
vim.opt.softtabstop = 2
vim.opt.shiftwidth = 2

-- Folding
vim.opt.foldmethod = 'indent'
vim.opt.foldnestmax = 10
vim.opt.foldlevel = 2
vim.opt.foldenable = false

-- Windows
vim.opt.splitbelow = true
vim.opt.splitright = true
vim.opt.number = true
vim.opt.relativenumber = true
vim.opt.winwidth = 86
vim.opt.winheight = 999
vim.opt.winminheight = 5
vim.opt.showtabline = 2

-- Appearance
vim.opt.termguicolors = true
vim.opt.cursorline = true
vim.opt.showmatch = true
vim.opt.wrap = false
vim.opt.listchars:append({ tab = '▸ ', eol = '¬', trail = '·', nbsp = '⍽' })
do
  local cols = {}
  for i = 81, 999 do
    cols[#cols + 1] = tostring(i)
  end
  vim.opt.colorcolumn = table.concat(cols, ',')
end

-- Spelling
vim.opt.spelllang = 'en_gb'

-- Scroll
vim.opt.scrolloff = 4

-- No bells
vim.opt.belloff = 'all'
