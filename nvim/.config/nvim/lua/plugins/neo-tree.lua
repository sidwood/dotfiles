return {
  'nvim-neo-tree/neo-tree.nvim',
  branch = 'v3.x',
  dependencies = {
    'nvim-lua/plenary.nvim',
    'nvim-tree/nvim-web-devicons',
    'MunifTanjim/nui.nvim',
  },
  keys = {
    { '<leader>m', '<cmd>Neotree toggle<cr>', desc = 'Toggle file explorer' },
    { '<leader>gm', '<cmd>Neotree toggle git_status<cr>', desc = 'Toggle git explorer' },
    { '<leader>bm', '<cmd>Neotree toggle buffers<cr>', desc = 'Toggle buffer explorer' },
  },
  config = function()
    require('neo-tree').setup({
      close_if_last_window = true,
      popup_border_style = 'rounded',
      event_handlers = {
        {
          event = 'vim_buffer_enter',
          handler = function()
            if vim.bo.filetype == 'neo-tree' then
              vim.cmd('setlocal winfixwidth')
              vim.api.nvim_win_set_width(0, 36)
            end
          end,
        },
      },
      filesystem = {
        follow_current_file = { enabled = true },
        use_libuv_file_watcher = true,
        filtered_items = {
          visible = false,
          hide_dotfiles = false,
          hide_gitignored = true,
          never_show = {
            '.DS_Store',
          },
        },
      },
      window = {
        width = 36,
        mappings = {
          ['<space>'] = 'none',
          ['o'] = 'open',
          ['x'] = 'close_node',
        },
      },
      default_component_configs = {
        indent = {
          with_expanders = true,
        },
        git_status = {
          symbols = {
            added = '',
            modified = '',
            deleted = '✖',
            renamed = '󰁕',
            untracked = '',
            ignored = '',
            unstaged = '󰄱',
            staged = '',
            conflict = '',
          },
        },
      },
    })
  end,
}
