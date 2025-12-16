return {
  'mfussenegger/nvim-lint',
  event = { 'BufReadPre', 'BufNewFile' },
  config = function()
    local lint = require('lint')

    lint.linters_by_ft = {
      bash = { 'shellcheck' },
      css = { 'biomejs' },
      javascript = { 'biomejs' },
      javascriptreact = { 'biomejs' },
      json = { 'biomejs' },
      jsonc = { 'biomejs' },
      lua = { 'luacheck' },
      python = { 'ruff' },
      ruby = { 'rubocop' },
      sh = { 'shellcheck' },
      typescript = { 'biomejs' },
      typescriptreact = { 'biomejs' },
      yaml = { 'yamllint' },
    }

    vim.api.nvim_create_autocmd({ 'BufWritePost', 'BufReadPost', 'InsertLeave' }, {
      callback = function()
        lint.try_lint()
      end,
    })
  end,
}
