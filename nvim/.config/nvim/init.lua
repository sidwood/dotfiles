
-- SETTINGS
--------------------------------------------------------------------------------

-- Set leader
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

-- Appearance
vim.opt.listchars:append({ tab = '▸ ', eol = '¬', trail = '·', nbsp = '⍽' })

-- MAPPINGS
--------------------------------------------------------------------------------

-- Navigate displayed lines over numbered lines (useful for wrapped lines)
vim.keymap.set('n', 'k', 'gk')
vim.keymap.set('n', 'j', 'gj')

-- Toggle spell checking
vim.keymap.set('n', '<leader>sc', ':set spell!<CR>', {
  silent = true,
  desc = 'Toggle spell checking',
})

-- Edit vimrc..err..I mean init.lua in new tab
vim.keymap.set('n', '<leader>vi', ':tabe ~/.config/nvim/init.lua<CR>', {
  silent = true,
  desc = 'Edit init.lua'
})

-- Source current file
vim.keymap.set('n', '<leader>so', ':so %<CR>', {
  silent = true,
  desc = 'Source current file',
})
