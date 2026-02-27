return {
  'goolord/alpha-nvim',
  event = 'VimEnter',
  dependencies = { 'nvim-tree/nvim-web-devicons' },
  config = function()
    local dashboard = require('alpha.themes.dashboard')

    local icons = {
      find_file = '󰈞',
      recent_files = '󰋚',
      find_text = '󰊄',
      new_file = '󰝒',
      quit = '󰗼',
    }

    local function with_icon(icon, label)
      return string.format('%s  %s', icon, label)
    end

    local function telescope_button(shortcut, label, picker)
      return dashboard.button(
        shortcut,
        label,
        string.format("<cmd>lua require('telescope.builtin').%s()<CR>", picker)
      )
    end

    dashboard.section.buttons.val = {
      telescope_button('f', with_icon(icons.find_file, 'Find file'), 'find_files'),
      telescope_button('r', with_icon(icons.recent_files, 'Recent files'), 'oldfiles'),
      telescope_button('g', with_icon(icons.find_text, 'Find text'), 'live_grep'),
      dashboard.button('n', with_icon(icons.new_file, 'New file'), '<cmd>ene <BAR> startinsert<CR>'),
      dashboard.button('q', with_icon(icons.quit, 'Quit'), '<cmd>qa<CR>'),
    }

    require('alpha').setup(dashboard.config)
  end,
}
