# Builds the Go core as an Android library with gomobile (Windows).
# Needs: Go, Android SDK with an NDK, and a JDK with javac (Android Studio's bundled jbr works).
# Output: app/modules/quickpay-core/android/libs/quickpaycore.aar, wrapped by the local Expo module.
# Same settings as scripts/build-mobile-core.sh; keep the two in sync.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent

if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (-not (Test-Path $env:ANDROID_HOME)) { throw "Android SDK not found. Set ANDROID_HOME." }
if (-not $env:ANDROID_NDK_HOME) {
  $ndk = Get-ChildItem (Join-Path $env:ANDROID_HOME 'ndk') -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
  if (-not $ndk) { throw "No NDK under $env:ANDROID_HOME\ndk. Install one with sdkmanager or Android Studio." }
  $env:ANDROID_NDK_HOME = $ndk.FullName
}
if (-not $env:JAVA_HOME) { $env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr' }
if (-not (Test-Path (Join-Path $env:JAVA_HOME 'bin\javac.exe'))) { throw "javac not found. Set JAVA_HOME to a JDK." }
$gobin = Join-Path (go env GOPATH) 'bin'
$env:PATH = "$env:JAVA_HOME\bin;$gobin;$env:PATH"

function Run([string]$exe, [string[]]$argv) {
  & $exe @argv
  if ($LASTEXITCODE -ne 0) { throw "$exe failed with exit code $LASTEXITCODE" }
}

Push-Location $root
try {
  # Use the golang.org/x/mobile version pinned in go.mod.
  Run 'go' @('install', 'golang.org/x/mobile/cmd/gomobile', 'golang.org/x/mobile/cmd/gobind')
  Run 'gomobile' @('init')
  $out = Join-Path $root 'app\modules\quickpay-core\android\libs'
  New-Item -ItemType Directory $out -Force | Out-Null
  # -javapkg com.quickpay: QuickPayCoreModule.kt imports com.quickpay.bridge.Bridge.
  # Targets must match reactNativeArchitectures set by app/plugins/withReleaseSigning.js.
  Run 'gomobile' @('bind', '-target=android/arm64,android/amd64', '-androidapi', '24', '-javapkg', 'com.quickpay',
    '-o', (Join-Path $out 'quickpaycore.aar'), 'github.com/quickpay/quickpay/core/bridge')
  Write-Host ("Android core built: {0:N1} MB" -f ((Get-Item (Join-Path $out 'quickpaycore.aar')).Length / 1MB))
} finally {
  Pop-Location
}
