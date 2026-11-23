# QuickPay QR

Save your "receive money" QR once. The app opens straight to it, full screen, with the screen kept on and brightness at 100%, so the person paying you can scan it right away.

Your payment details stay on your device. They are encrypted at rest with AES-256-GCM and never uploaded unless you turn on the optional sync, which only ever sends ciphertext.

## Features

- **Scan or paste** a UPI, merchant (EMV) or any other QR. The app checks it and warns about unrecognised formats.
- **Several QRs**, for example personal and shop, with one-tap switching and a "main" QR shown at launch.
- **Light and dark mode**, following the system until you pick one.
- **Face / fingerprint lock** (optional), asked before showing your QR and again after the app goes to the background.
- **Works on phones, tablets and desktop browsers**, with a two-column layout on wide screens.
- **No account, no analytics.** "Delete all my data" erases every saved QR and the encryption key.

## Platform status

| Platform | Core | Encrypted at rest | Notes |
|---|---|---|---|
| Android (dev or release build) | Go, native (gomobile) | Yes | 64-bit devices only (`arm64-v8a`, `x86_64`) |
| Web | Go, WebAssembly | Yes | Key sits in the same browser storage as the data. See `docs/ARCHITECTURE.md`. |
| iOS | TypeScript fallback | **No** | Native module not built for iOS yet |
| Expo Go (any phone) | TypeScript fallback | **No** | For UI work only. Settings shows "encryption is off". |

Builds that use the TypeScript fallback must not be shipped.

## How it's built

```
core/        Go domain logic: upi (parse/validate), presets (profiles), vault (AES-256-GCM), bridge (string API)
cmd/wasm/    Go core -> WebAssembly for the browser
cmd/api/     Optional Go + PostgreSQL service that stores client-encrypted sync blobs only
internal/    syncstore (Postgres + in-memory)
migrations/  SQL for the optional service
app/         Expo (React Native + react-native-web) UI for web, Android and iOS
  modules/quickpay-core/   Local Expo module that exposes the Go core to Android
  plugins/                 Config plugins (release signing, ABIs)
scripts/     build-wasm and build-mobile-core (gomobile), each as .sh and .ps1
docs/        ARCHITECTURE.md: trade-offs, security, storage, UI spec, store readiness
```

The same Go code runs everywhere: as WebAssembly in the browser and as a native library on Android. All of it is called through one string-in, string-out API in `core/bridge`.

## Requirements

- Go 1.26.4 or later
- Node.js 22.13+ or 24.3+
- For Android: Android Studio, with the SDK, an NDK and CMake. Android Studio's bundled JDK (`jbr`) is enough.

## Run it

### Tests

```powershell
go test ./...
cd app; npx tsc --noEmit
```

### Web

```powershell
./scripts/build-wasm.ps1          # macOS/Linux: sh scripts/build-wasm.sh
cd app
npm install
npx expo start --web              # http://localhost:8081
```

The browser only allows the camera on `localhost` or over HTTPS. On other devices on your network, use **Paste** instead of **Scan**.

### Android

Build the Go core into an Android library first. Run this again whenever anything under `core/` changes.

```powershell
./scripts/build-mobile-core.ps1   # macOS/Linux: sh scripts/build-mobile-core.sh
```

Then build and install a development build on a connected device or emulator:

```powershell
cd app
npm run android                   # expo run:android
```

On Windows, long project paths can break the native C++ build. Enable long paths in Windows. If the SDK's CMake ships an old `ninja.exe` (1.10), replace it with ninja 1.12 or later.

### UI only, with Expo Go

```powershell
cd app
npx expo start                    # scan the QR with Expo Go
```

Expo Go cannot load the Go module, so the app uses the unencrypted TypeScript fallback.

### Optional sync backend

```powershell
go run ./cmd/api                  # in-memory store, listens on :8080
# With Postgres:
psql "$env:DATABASE_URL" -f migrations/001_sync_blobs.sql
$env:DATABASE_URL="postgres://user:pass@localhost:5432/quickpay"; go run ./cmd/api
```

Settings: `DATABASE_URL` (optional, in-memory without it), `ADDR` (default `:8080`) and `ALLOWED_ORIGIN` (CORS, default `*`, so set it in production). Routes: `GET /healthz` and `GET`, `PUT`, `DELETE /v1/sync/{id}`. The app doesn't call the sync service yet.

## Release APK (Android)

Release builds are signed with your own key. `app/plugins/withReleaseSigning.js` reads the key from Gradle properties, which you keep **outside the repo** in `~/.gradle/gradle.properties`, or in `$GRADLE_USER_HOME/gradle.properties` if you set that:

```properties
QUICKPAY_UPLOAD_STORE_FILE=C:/path/to/quickpay-release.jks
QUICKPAY_UPLOAD_KEY_ALIAS=quickpay
QUICKPAY_UPLOAD_STORE_PASSWORD=...
QUICKPAY_UPLOAD_KEY_PASSWORD=...
```

Create a key once with `keytool -genkeypair -keystore quickpay-release.jks -alias quickpay -keyalg RSA -keysize 4096 -validity 10000`. **Back up the key and its password.** Android installs an update only if it's signed with the same key.

```powershell
./scripts/build-mobile-core.ps1
cd app
npx expo prebuild --platform android
cd android
./gradlew :app:assembleRelease    # build only :app; plain assembleRelease fails on the local .aar
# Output: app/android/app/build/outputs/apk/release/app-release.apk
```

If the properties are missing, the release build falls back to the debug key. That build is fine for testing but not for distribution.

## Before publishing

- Replace `com.example.quickpayqr` in `app/app.json` with your own app ID. Changing it later creates a new app.
- Check that Settings does **not** show "encryption is off".
- iOS: build the Go core for iOS and add the Swift side of `app/modules/quickpay-core`.
- Web: serve with a strict Content Security Policy, as described in `docs/ARCHITECTURE.md`.

## Docs

`docs/ARCHITECTURE.md` covers the design decisions, the security model and its limits, on-device storage, the sync design, the UI spec and known limitations.

## License

[MIT](LICENSE) © 2026 Mohammad Hamza
