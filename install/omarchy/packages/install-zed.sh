#!/bin/bash
set -e

omarchy-pkg-add zed

# Arch Linux installs zed as 'zeditor' to avoid naming conflicts.
# Create a symlink so 'zed' command works as expected.
if command -v zeditor &>/dev/null && ! command -v zed &>/dev/null; then
    ln -sf "$(command -v zeditor)" "$HOME/.local/share/omarchy/bin/zed"
    echo "Created 'zed' symlink to zeditor"
fi

echo "zed installed successfully"
