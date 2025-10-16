
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

-- Windows
vim.opt.splitbelow = true
vim.opt.splitright = true
vim.opt.winwidth = 86
vim.opt.winheight = 5
vim.opt.winminheight = 5
vim.opt.winheight = 999

-- Appearance
vim.opt.cursorline = true
vim.opt.showmatch = true
vim.opt.wrap = false
vim.opt.listchars:append({ tab = '▸ ', eol = '¬', trail = '·', nbsp = '⍽' })

-- Scroll
vim.opt.scrolloff = 4

-- No bells
vim.opt.belloff = 'all'

-- MAPPINGS
--------------------------------------------------------------------------------

-- Navigate displayed lines over numbered lines (useful for wrapped lines)
vim.keymap.set('n', 'k', 'gk')
vim.keymap.set('n', 'j', 'gj')

-- Easier horizontal scrolling (half-screen instead of single character)
vim.keymap.set('n', 'zl', 'zL', { desc = 'Scroll right half-screen' })
vim.keymap.set('n', 'zh', 'zH', { desc = 'Scroll left half-screen' })

-- Window navigation
vim.keymap.set('n', '<C-h>', '<C-w>h', { desc = 'Move to left window' })
vim.keymap.set('n', '<C-j>', '<C-w>j', { desc = 'Move to window below' })
vim.keymap.set('n', '<C-k>', '<C-w>k', { desc = 'Move to window above' })
vim.keymap.set('n', '<C-l>', '<C-w>l', { desc = 'Move to right window' })

-- Toggle spell checking
vim.keymap.set('n', '<leader>sc', ':set spell!<CR>', {
  silent = true,
  desc = 'Toggle spell checking',
})

-- Cycle through spell languages (US → British → Canadian)
local spell_langs = { 'en', 'en_gb', 'en_ca' }
local spell_names = { en = 'US', en_gb = 'British', en_ca = 'Canadian' }
vim.keymap.set('n', '<leader>sl', function()
  local current = vim.opt.spelllang:get()[1]
  local next_idx = 1
  for i, lang in ipairs(spell_langs) do
    if lang == current then
      next_idx = (i % #spell_langs) + 1
      break
    end
  end
  local next_lang = spell_langs[next_idx]
  vim.opt.spelllang = next_lang
  vim.notify('Spelling: ' .. spell_names[next_lang], vim.log.levels.INFO)
end, { desc = 'Cycle spell language' })

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

-- Toggle git signs plugin
vim.keymap.set('n', '<leader>lg', function()
  if vim.fn.exists(':Gitsigns') == 2 then
    vim.cmd('Gitsigns toggle_signs')
  else
    vim.notify('gitsigns.nvim not installed', vim.log.levels.WARN)
  end
end, {
  silent = true,
  desc = 'Toggle git signs',
})
