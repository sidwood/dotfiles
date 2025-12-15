local servers = {
  'bashls',
  'clangd',
  'cssls',
  'html',
  'jsonls',
  'lua_ls',
  'pyright',
  'ruby_lsp',
  'rust_analyzer',
  'ts_ls',
  'yamlls',
  'zls',
}

return {
  {
    'williamboman/mason.nvim',
    build = ':MasonUpdate',
    opts = {},
  },
  {
    'williamboman/mason-lspconfig.nvim',
    dependencies = { 'williamboman/mason.nvim' },
    opts = {
      ensure_installed = servers,
    },
  },
  {
    'neovim/nvim-lspconfig',
    event = { 'BufReadPre', 'BufNewFile' },
    dependencies = {
      'williamboman/mason.nvim',
      'williamboman/mason-lspconfig.nvim',
    },
    config = function()
      vim.lsp.config('*', {
        capabilities = vim.lsp.protocol.make_client_capabilities(),
      })

      vim.api.nvim_create_autocmd('LspAttach', {
        callback = function(args)
          local opts = { buffer = args.buf }

          vim.keymap.set('n', '<leader>ca', vim.lsp.buf.code_action, opts)
          vim.keymap.set('n', 'gd', vim.lsp.buf.definition, opts)
          vim.keymap.set('n', 'gD', vim.lsp.buf.declaration, opts)
          vim.keymap.set('n', 'gi', vim.lsp.buf.implementation, opts)
          vim.keymap.set('n', 'gy', vim.lsp.buf.type_definition, opts)
          vim.keymap.set('n', 'K', vim.lsp.buf.hover, opts)

          vim.keymap.set('n', '<leader>f', function() vim.lsp.buf.format({ async = true }) end, opts)
          vim.keymap.set('n', '<leader>d', vim.diagnostic.open_float, opts)
          vim.keymap.set('n', '[d', function() vim.diagnostic.jump({ count = -1 }) end, opts)
          vim.keymap.set('n', ']d', function() vim.diagnostic.jump({ count = 1 }) end, opts)
        end,
      })

      vim.lsp.config('lua_ls', {
        settings = {
          Lua = {
            runtime = { version = 'LuaJIT' },
            workspace = {
              checkThirdParty = false,
              library = { vim.env.VIMRUNTIME },
            },
            telemetry = { enable = false },
          },
        },
      })

      vim.lsp.enable(servers)
    end,
  },
}
