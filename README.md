# QuickPay QR

Save your "receive money" QR once. The app opens straight to it: full screen, screen kept on, brightness at 100%. Runs as a web app, on Android and on iOS from one codebase. Your payment data stays on the device.

```
core/        Go domain logic: upi (parse/validate), presets (profiles), vault (AES-256-GCM), bridge (string API)
cmd/wasm/    Go core -> WebAssembly for the browser
cmd/api/     OPTIONAL Go + PostgreSQL service: stores client-encrypted sync blobs only
internal/    syncstore (Postgres + in-memory)
migrations/  SQL for the optional service
app/         Expo (React Native + react-native-web) UI for Web, Android, iOS
scripts/     build-wasm, build-mobile-core (gomobile)
docs/        ARCHITECTURE.md: trade-offs, security, store readiness, UI spec
```

## Run it

Prerequisites: Go 1.24+, Node 20+. Android Studio for Android, Xcode (macOS) for iOS.

```powershell
# 1. Go core: tests
go test ./...

# 2. Build the Go core for the browser (writes app/public/quickpay.wasm + wasm_exec.js)
./scripts/build-wasm.ps1          # macOS/Linux: sh scripts/build-wasm.sh

# 3. Web app
cd app
npm install
npx expo start --web              # http://localhost:8081

# 4. Phone (Expo Go works for the UI; uses the dev TS fallback core, see docs)
npx expo start                    # scan the QR with Expo Go

# 5. Optional sync backend (in-memory without DATABASE_URL)
go run ./cmd/api
#   with Postgres:
psql "$env:DATABASE_URL" -f migrations/001_sync_blobs.sql
$env:DATABASE_URL="postgres://user:pass@localhost:5432/quickpay"; go run ./cmd/api
```

## Ship it

```powershell
cd app
npm i -g eas-cli; eas login; eas build:configure
# Web: static export, host anywhere (Netlify, Cloudflare Pages, S3 + CDN)
npx expo export --platform web            # output: app/dist
# Stores (cloud builds; iOS builds do not need a local Mac)
eas build --platform android --profile production   # .aab for Google Play
eas build --platform ios --profile production       # .ipa for App Store
eas submit --platform android; eas submit --platform ios
```

Before release, replace `com.example.quickpayqr` in `app/app.json`, link the Go native module (see `docs/ARCHITECTURE.md`, "Native bridge"), and confirm the app reports `engine: go-native` in Manage. A build running the TS fallback does not encrypt and must not be shipped.

## Status

Verified here: `go vet` and `go test ./...` pass, the WASM build runs in Node (add, seal, open, validation errors), `tsc` is clean, and `expo export --platform web` succeeds.
Not verified here: Android/iOS runtime, the gomobile build (needs Android NDK or Xcode), and Postgres against a live database.
