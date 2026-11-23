#!/usr/bin/env sh
# Builds the Go core for the browser into app/public.
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GOOS=js GOARCH=wasm go build -ldflags '-s -w' -o "$ROOT/app/public/quickpay.wasm" "$ROOT/cmd/wasm"
GOROOT="$(go env GOROOT)"
cp "$GOROOT/lib/wasm/wasm_exec.js" "$ROOT/app/public/wasm_exec.js" 2>/dev/null \
  || cp "$GOROOT/misc/wasm/wasm_exec.js" "$ROOT/app/public/wasm_exec.js"
ls -lh "$ROOT/app/public/quickpay.wasm"
