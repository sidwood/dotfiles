-- Remove trailing whitespace before saving
vim.api.nvim_create_autocmd('BufWritePre', {
  pattern = '*',
  callback = function()
    local pos = vim.api.nvim_win_get_cursor(0)
    vim.cmd([[%s/\s\+$//e]])
    vim.api.nvim_win_set_cursor(0, pos)
  end,
})

-- Make git commit subject length visually obvious:
-- - first line chars 1-50 => green
-- - first line chars 51+ => warning highlight
local gitcommit_subject_ns = vim.api.nvim_create_namespace('GitCommitSubjectHighlight')

local function highlight_gitcommit_subject(bufnr)
  local line = vim.api.nvim_buf_get_lines(bufnr, 0, 1, false)[1] or ''
  local line_len_bytes = #line
  local line_len_chars = vim.fn.strchars(line)
  local cutoff_byte = line_len_bytes

  if line_len_chars > 50 then
    cutoff_byte = vim.str_byteindex(line, 50)
  end

  vim.api.nvim_buf_clear_namespace(bufnr, gitcommit_subject_ns, 0, 1)

  if line_len_bytes == 0 then
    return
  end

  vim.api.nvim_buf_add_highlight(bufnr, gitcommit_subject_ns, 'GitCommitSubjectOk', 0, 0, cutoff_byte)

  if line_len_bytes > cutoff_byte then
    vim.api.nvim_buf_add_highlight(bufnr, gitcommit_subject_ns, 'GitCommitSubjectTooLong', 0, cutoff_byte, -1)
  end
end

vim.api.nvim_create_autocmd('FileType', {
  pattern = 'gitcommit',
  callback = function(args)
    vim.api.nvim_set_hl(0, 'GitCommitSubjectOk', {
      fg = '#9acd32',
      bold = true,
      nocombine = true,
    })
    vim.api.nvim_set_hl(0, 'GitCommitSubjectTooLong', {
      fg = '#ffffff',
      bg = '#d70000',
      bold = true,
      nocombine = true,
    })

    local group = vim.api.nvim_create_augroup('GitCommitSubjectHighlight_' .. args.buf, { clear = true })
    vim.api.nvim_create_autocmd({ 'BufEnter', 'TextChanged', 'TextChangedI', 'InsertLeave' }, {
      group = group,
      buffer = args.buf,
      callback = function()
        highlight_gitcommit_subject(args.buf)
      end,
      desc = 'Highlight git commit subject length',
    })
    highlight_gitcommit_subject(args.buf)
  end,
  desc = 'Set up git commit subject highlighting',
})
