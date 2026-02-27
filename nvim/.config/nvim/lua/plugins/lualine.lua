return {
  'nvim-lualine/lualine.nvim',
  dependencies = { 'nvim-tree/nvim-web-devicons' },
  event = 'VeryLazy',
  opts = {
    options = {
      theme = 'solarized_dark',
      component_separators = { left = '', right = '' },
      section_separators = { left = '', right = '' },
    },
    tabline = {
      lualine_a = {
        {
          'buffers',
          mode = 2, -- index + filename
          symbols = {
            modified = '+',
            alternate_file = '#',
          },
        },
      },
      lualine_z = { 'tabs' },
    },
    sections = {
      lualine_x = {
        {
          function()
            local spelllang = vim.opt.spelllang:get()[1] or vim.o.spelllang or ''
            return string.format('SPELL [%s]', string.upper(spelllang))
          end,
          cond = function()
            return vim.wo.spell
          end,
          color = { fg = '#eeee00', gui = 'bold' },
        },
        'encoding',
        'fileformat',
        'filetype',
      },
      lualine_y = {
        {
          function()
            local wc = vim.fn.wordcount()
            local words = wc.visual_words or wc.words or 0
            return string.format('%d words', words)
          end,
          cond = function()
            return vim.bo.buftype == ''
          end,
        },
      },
      lualine_z = {
        {
          function()
            local line = vim.fn.line('.')
            local total = vim.fn.line('$')
            local col = vim.fn.col('.')
            return string.format('%d/%d:%d', line, total, col)
          end,
        },
      },
    },
  },
}
