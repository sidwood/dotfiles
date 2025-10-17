#!/bin/bash

apply() {
  # Keyboard repeat rate
  defaults write NSGlobalDomain KeyRepeat -int 2
  defaults write NSGlobalDomain InitialKeyRepeat -int 15

  # Modifier key remapping (Caps Lock → Control on all keyboards)
  defaults -currentHost write -g com.apple.keyboard.modifiermapping.0-0-0 -array \
    '<dict><key>HIDKeyboardModifierMappingDst</key><integer>30064771300</integer><key>HIDKeyboardModifierMappingSrc</key><integer>30064771129</integer></dict>'

  # Mouse settings (global defaults for all mice)
  # Tracking speed - maximum (3.0 is max, 0 is slowest)
  defaults write NSGlobalDomain com.apple.mouse.scaling -float 3.0

  # Natural scrolling - enabled
  defaults write NSGlobalDomain com.apple.swipescrolldirection -bool true

  # Secondary click enabled (right-click on right side)
  defaults write com.apple.AppleMultitouchMouse MouseButtonMode -string "TwoButton"
  defaults write com.apple.driver.AppleBluetoothMultitouch.mouse MouseButtonMode -string "TwoButton"

  # Smart zoom - disabled (0 = off, 1 = on)
  defaults write com.apple.AppleMultitouchMouse MouseOneFingerDoubleTapGesture -int 0
  defaults write com.apple.driver.AppleBluetoothMultitouch.mouse MouseOneFingerDoubleTapGesture -int 0
}

reset() {
  # Reset keyboard repeat rate to system defaults
  defaults delete NSGlobalDomain KeyRepeat 2>/dev/null
  defaults delete NSGlobalDomain InitialKeyRepeat 2>/dev/null

  # Remove modifier key remapping
  defaults -currentHost delete -g com.apple.keyboard.modifiermapping.0-0-0 2>/dev/null

  # Reset mouse settings
  defaults delete NSGlobalDomain com.apple.mouse.scaling 2>/dev/null
  defaults delete NSGlobalDomain com.apple.swipescrolldirection 2>/dev/null
  defaults delete com.apple.AppleMultitouchMouse MouseButtonMode 2>/dev/null
  defaults delete com.apple.driver.AppleBluetoothMultitouch.mouse MouseButtonMode 2>/dev/null
  defaults delete com.apple.AppleMultitouchMouse MouseOneFingerDoubleTapGesture 2>/dev/null
  defaults delete com.apple.driver.AppleBluetoothMultitouch.mouse MouseOneFingerDoubleTapGesture 2>/dev/null
}

case "${1:-}" in
  apply) apply ;;
  reset) reset ;;
  *)
    echo "Usage: $0 {apply|reset}" >&2
    exit 1
    ;;
esac
