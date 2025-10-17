#!/bin/bash

apply() {
  # Keyboard repeat rate
  defaults write NSGlobalDomain KeyRepeat -int 2
  defaults write NSGlobalDomain InitialKeyRepeat -int 15

  # Modifier key remapping (Caps Lock → Control on all keyboards)
  defaults -currentHost write -g com.apple.keyboard.modifiermapping.0-0-0 -array \
    '<dict><key>HIDKeyboardModifierMappingDst</key><integer>30064771300</integer><key>HIDKeyboardModifierMappingSrc</key><integer>30064771129</integer></dict>'
}

reset() {
  # Reset keyboard repeat rate to system defaults
  defaults delete NSGlobalDomain KeyRepeat 2>/dev/null
  defaults delete NSGlobalDomain InitialKeyRepeat 2>/dev/null

  # Remove modifier key remapping
  defaults -currentHost delete -g com.apple.keyboard.modifiermapping.0-0-0 2>/dev/null
}

case "${1:-}" in
  apply) apply ;;
  reset) reset ;;
  *)
    echo "Usage: $0 {apply|reset}" >&2
    exit 1
    ;;
esac
