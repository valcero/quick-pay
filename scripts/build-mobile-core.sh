#!/usr/bin/env sh
# Builds the Go core as native libraries with gomobile.
# Android: needs Android SDK + NDK. iOS: needs macOS + Xcode.
# Output is wrapped by a small Expo module (see docs/ARCHITECTURE.md, "Native bridge").
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
go install golang.org/x/mobile/cmd/gomobile@latest
gomobile init
mkdir -p "$ROOT/app/modules/quickpay-core/android/libs" "$ROOT/app/modules/quickpay-core/ios"
gomobile bind -target=android -androidapi 24 -o "$ROOT/app/modules/quickpay-core/android/libs/quickpaycore.aar" \
  github.com/quickpay/quickpay/core/bridge
if [ "$(uname)" = "Darwin" ]; then
  gomobile bind -target=ios,iossimulator -o "$ROOT/app/modules/quickpay-core/ios/Quickpaycore.xcframework" \
    github.com/quickpay/quickpay/core/bridge
fi
