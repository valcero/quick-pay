#!/usr/bin/env sh
# Builds the Go core as native libraries with gomobile.
# Android: needs Android SDK + NDK (ANDROID_HOME, ANDROID_NDK_HOME) and a JDK with javac.
# iOS: needs macOS + Xcode (the Expo module has no iOS side yet).
# Output is wrapped by the local Expo module app/modules/quickpay-core (see docs/ARCHITECTURE.md).
# Windows: use scripts/build-mobile-core.ps1.
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# Use the golang.org/x/mobile version pinned in go.mod.
go install golang.org/x/mobile/cmd/gomobile golang.org/x/mobile/cmd/gobind
gomobile init
mkdir -p "$ROOT/app/modules/quickpay-core/android/libs" "$ROOT/app/modules/quickpay-core/ios"
# -javapkg com.quickpay: QuickPayCoreModule.kt imports com.quickpay.bridge.Bridge.
# Targets must match reactNativeArchitectures set by app/plugins/withReleaseSigning.js.
gomobile bind -target=android/arm64,android/amd64 -androidapi 24 -javapkg com.quickpay \
  -o "$ROOT/app/modules/quickpay-core/android/libs/quickpaycore.aar" \
  github.com/quickpay/quickpay/core/bridge
if [ "$(uname)" = "Darwin" ]; then
  gomobile bind -target=ios,iossimulator -o "$ROOT/app/modules/quickpay-core/ios/Quickpaycore.xcframework" \
    github.com/quickpay/quickpay/core/bridge
fi
