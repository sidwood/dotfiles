return {
  'nvim-lualine/lualine.nvim',
  dependencies = { 'nvim-tree/nvim-web-devicons' },
  event = 'VeryLazy',
  opts = {
    options = {
      theme = 'solarized_dark',
      component_separators = { left = '', right = '' },
      section_separators = { left = '', right = '' },
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
    },
  },
}
