return {
  'maxmx03/solarized.nvim',
  lazy = false,
  priority = 1000,
  config = function()
    local function apply_spell_highlights()
      -- Use block-style spell highlights to avoid visual clashes with markdown underline syntax.
      vim.api.nvim_set_hl(0, 'SpellBad', {
        underline = false,
        undercurl = false,
        bg = '#5f0000',
        fg = '#ffd7d7',
        nocombine = true,
      })
      vim.api.nvim_set_hl(0, 'SpellCap', {
        underline = false,
        undercurl = false,
        bg = '#5f5f00',
        fg = '#ffffd7',
        nocombine = true,
      })
      vim.api.nvim_set_hl(0, 'SpellRare', {
        underline = false,
        undercurl = false,
        bg = '#5f3f00',
        fg = '#ffe7c7',
        nocombine = true,
      })
      vim.api.nvim_set_hl(0, 'SpellLocal', {
        underline = false,
        undercurl = false,
        bg = '#5f3f00',
        fg = '#ffe7c7',
        nocombine = true,
      })
    end

    vim.o.background = 'dark'
    require('solarized').setup()
    vim.cmd.colorscheme('solarized')

    apply_spell_highlights()
    vim.api.nvim_create_autocmd('ColorScheme', {
      group = vim.api.nvim_create_augroup('CustomSpellHighlights', { clear = true }),
      callback = apply_spell_highlights,
      desc = 'Restore custom spell highlight colors',
    })
  end,
}
