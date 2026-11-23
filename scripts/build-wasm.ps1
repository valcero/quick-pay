# Builds the Go core for the browser into app/public.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$env:GOOS = 'js'; $env:GOARCH = 'wasm'
go build -ldflags '-s -w' -o "$root/app/public/quickpay.wasm" "$root/cmd/wasm"
Remove-Item Env:GOOS, Env:GOARCH
$goroot = go env GOROOT
$exec = Join-Path $goroot 'lib/wasm/wasm_exec.js'
if (-not (Test-Path $exec)) { $exec = Join-Path $goroot 'misc/wasm/wasm_exec.js' }
Copy-Item $exec "$root/app/public/wasm_exec.js" -Force
Write-Host "WASM built: $((Get-Item "$root/app/public/quickpay.wasm").Length / 1MB) MB"
