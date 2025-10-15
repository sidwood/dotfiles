
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

-- Move window to new tab
vim.keymap.set('n', '<leader>nt', '<C-W>T', {
  desc = 'Move window to new tab',
})

-- Toggle background color
vim.keymap.set({'n', 'v'}, '<leader>bg', function()
  vim.opt.background = vim.o.background == 'dark' and 'light' or 'dark'
end, {
  silent = true,
  desc = 'Toggle background (light/dark)',
})

-- Toggle invisible characters
vim.keymap.set('n', '<leader>ll', ':set list!<CR>', {
  silent = true,
  desc = 'Toggle invisible characters',
})

-- Toggle between absolute and relative line numbers
vim.keymap.set('n', '<Space>', function()
  if vim.wo.relativenumber then
    vim.wo.number = true
    vim.wo.relativenumber = false
  else
    vim.wo.number = true
    vim.wo.relativenumber = true
  end
end, { desc = 'Toggle relative line numbers' })

-- Toggle line numbers on/off (preserves relative/absolute state per window)
vim.keymap.set('n', '<leader>ln', function()
  if vim.wo.number or vim.wo.relativenumber then
    -- Save state to window variable before turning off
    vim.w.saved_relativenumber = vim.wo.relativenumber
    vim.wo.number = false
    vim.wo.relativenumber = false
  else
    -- Restore previous state
    vim.wo.number = true
    vim.wo.relativenumber = vim.w.saved_relativenumber or false
  end
end, { desc = 'Toggle line numbers' })
