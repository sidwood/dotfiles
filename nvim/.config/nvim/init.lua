
-- SETTINGS
--------------------------------------------------------------------------------

-- Set leader
vim.g.mapleader= ","

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

-- Appearance
vim.opt.listchars:append({ tab = '▸ ', eol = '¬', trail = '·', nbsp = '⍽' })
