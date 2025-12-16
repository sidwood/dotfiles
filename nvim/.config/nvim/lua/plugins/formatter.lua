return {
  'stevearc/conform.nvim',
  event = { 'BufWritePre' },
  keys = {
    {
      '<leader>f',
      function() require('conform').format({ async = true, lsp_format = 'fallback' }) end,
      desc = 'Format buffer',
    },
  },
  opts = {
    formatters_by_ft = {
      bash = { 'shfmt' },
      c = { 'clang-format' },
      cpp = { 'clang-format' },
      css = { 'biome', 'prettier', stop_after_first = true },
      html = { 'prettier' },
      javascript = { 'biome', 'prettier', stop_after_first = true },
      javascriptreact = { 'biome', 'prettier', stop_after_first = true },
      json = { 'biome', 'prettier', stop_after_first = true },
      jsonc = { 'biome', 'prettier', stop_after_first = true },
      lua = { 'stylua' },
      markdown = { 'prettier' },
      python = { 'ruff_format', 'black', stop_after_first = true },
      ruby = { 'rubocop' },
      rust = { 'rustfmt' },
      sh = { 'shfmt' },
      typescript = { 'biome', 'prettier', stop_after_first = true },
      typescriptreact = { 'biome', 'prettier', stop_after_first = true },
      yaml = { 'prettier' },
      zig = { 'zigfmt' },
    },
    format_on_save = {
      timeout_ms = 3000,
      lsp_format = 'fallback',
    },
  },
}
