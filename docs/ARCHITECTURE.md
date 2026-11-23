# Architecture

## 1. Shape of the system

```
                 ┌────────────────────── app/ (Expo: React Native + react-native-web) ──────────────────────┐
                 │ ReceiveScreen · SetupScreen · ManageScreen · Button/QRCard/ProfileChips                   │
                 │ src/core (platform split)        src/storage + src/kv (platform split)                    │
                 └───────┬──────────────────────────────┬─────────────────────────────┬──────────────────────┘
                   Web   │ WASM                  Android│iOS gomobile          native │ web
                         ▼                              ▼                             ▼
                  cmd/wasm  ──────────►  core/bridge  ◄──────  .aar / .xcframework    SQLite kv + Keychain/Keystore | localStorage
                                           │  upi · presets · vault
                                           ▼ (optional, user-enabled, ciphertext only)
                                      cmd/api (Go) ──► PostgreSQL (sync_blobs)
```

One Go package, `core/bridge`, is the only API the UI sees. It takes and returns strings (JSON), so the same code is exported by `syscall/js` on web and by `gomobile bind` on Android and iOS.

### Why Expo (React Native + Web) and not Flutter

| Criterion | Expo / RN + react-native-web | Flutter |
|---|---|---|
| Go on web | Go WASM loaded by JS, simple | Needs JS interop with the WASM glue |
| Go on mobile | gomobile `.aar`/`.xcframework` wrapped in an Expo module | `dart:ffi` to a cgo C library, or platform channels to the gomobile libs |
| Web output | Real DOM, small JS bundle (about 700 KB here) | CanvasKit/Skwasm, 2 MB or more, weaker SEO and text selection |
| Cold start | Hermes bytecode, fine for 3 screens | Slightly faster raw rendering, similar here |
| Store pipeline | EAS Build/Submit, iOS builds without owning a Mac | Needs Xcode on macOS for iOS |

Both work. Expo wins here because the Go bridge cost is lower on web and the web build is a normal website. Flutter would win for a heavy custom-rendered UI, which this app does not have.

### Why the Go core is "pure"

`core/` does no I/O: no disk, no network, no keystore. Hosts own storage and keys; Go validates, transforms and encrypts. That keeps one tested implementation behind three runtimes and makes it impossible for the core to leak data by itself.

### Native bridge (to finish before shipping)

`app/src/core/index.native.ts` expects a native module named `QuickPayCore` with the same function names and JSON contract as `core/bridge`.

1. `sh scripts/build-mobile-core.sh` produces `quickpaycore.aar` and `Quickpaycore.xcframework` (Android needs SDK + NDK, iOS needs macOS).
2. `npx create-expo-module --local quickpay-core` under `app/modules/`, add the artifacts, and expose each `bridge` function as a synchronous `Function(...)` calling `Bridge.parseQR(...)` etc. (Kotlin: `quickpaycore.Bridge`, Swift: `QuickpaycoreBridge`).
3. Build a dev client: `npx expo prebuild && npx expo run:android` (or `run:ios`). Expo Go cannot load custom native code.

Until then the app uses `src/core/fallback.ts`, a TS port of `core/upi` and `core/presets` for UI development. It does not encrypt. `Core.engine` and `Core.encrypted` make this visible, and Manage shows a warning. Parity risk: two implementations of the parser. Mitigation: add shared golden vectors (JSON file read by both `go test` and the app's tests) and delete the fallback once the native module ships.

Alternative if gomobile becomes a burden: run the same WASM inside the app via a JS engine, at the cost of startup time and a larger bundle. Not recommended for launch speed.

## 2. Data: PostgreSQL and on-device storage

Rule: **payment identifiers (UPI IDs, QR payloads) never leave the device unless the user turns on sync, and then only as ciphertext.**

| Where | Store | Holds | Why |
|---|---|---|---|
| Android / iOS | SQLite kv (`expo-sqlite/kv-store`), file in the app sandbox | One AES-256-GCM sealed document (`qp1.…`) | Real embedded DB, offline, fast |
| Android / iOS | Keystore / Keychain via `expo-secure-store` | 32-byte key, `WHEN_UNLOCKED_THIS_DEVICE_ONLY` | Key never sits next to the ciphertext |
| Web | `localStorage` today; IndexedDB or OPFS when you store images | Same sealed document + key | See web caveat below |
| Server (optional) | PostgreSQL `sync_blobs` | Ciphertext, version, timestamp | Multi-device sync only |

**PostgreSQL does not run on the phone.** There is no supported way to embed server PostgreSQL in iOS/Android sandboxes. Faking it (for example shipping a Postgres-compatible layer over SQLite) adds size and failure modes for no benefit. So:

- Postgres is used only by `cmd/api`, and only for the opt-in sync table. The app is fully functional with no backend.
- On-device uses SQLite, the correct embedded engine for mobile.
- On web you could use PGlite (Postgres compiled to WASM, persisted in IndexedDB/OPFS). It is about 3 MB or more and slows first load, so it is not used. Choose it only if you later need relational queries in the browser that match the server schema.
- The data model is one small JSON document (max 12 profiles). A relational schema on-device would be over-engineering. If it grows (history, images), move to SQLite tables on native and OPFS on web.

Sync design (not wired into the UI yet): the client derives the key from a passphrase with `DeriveKey` (PBKDF2-HMAC-SHA256, 600k iterations), generates a random 128-bit id, and `PUT`s the sealed document with `If-Match: <version>`. The server enforces the `qp1.` ciphertext prefix, a 64 KB limit and optimistic concurrency. It has no accounts, emails or analytics. Trade-off: no account means no password recovery. Losing the passphrase loses synced data; local data is unaffected.

### On-device security

- Local-first: no network calls in the app code path for save, load or display.
- Encryption at rest on top of OS sandboxing; key in hardware-backed storage on native.
- Optional biometric/device lock (`expo-local-authentication`), re-locks when backgrounded. Lock gates display only; it is not a second encryption layer.
- `allowBackup: false` on Android so cloud backup does not copy the ciphertext without the key. iOS Keychain item is `ThisDeviceOnly`, so iCloud backup restores ciphertext without a key. In both cases the app starts clean, as designed.
- Input validated in Go at the trust boundary: length cap, control characters rejected, strict UPI VPA, amount and currency checks, EMV CRC16.
- "Delete all my data" removes the document and the key.
- Web caveat: any script on the origin can read `localStorage`, key included. Mitigate with a strict CSP (`default-src 'self'; script-src 'self' 'wasm-unsafe-eval'`), no third-party scripts, and an optional passphrase-derived key (`deriveKey`). The web build is weaker than native; say so in the privacy copy.

## 3. Payload handling

- `upi://pay?...` is parsed, validated and re-emitted canonically. A fixed amount or transaction reference produces a warning, because a static receive QR normally has neither.
- EMVCo merchant QR (`000201…`) has its CRC16 verified.
- Anything else is stored as `generic` and rendered as-is, so other regions and bank formats work.
- Setup accepts camera scan or pasted text. Next: image import (`expo-image-picker` plus a QR decoder, no storage permission needed with the system picker).

## 4. UI spec

Principles: one job per screen, one primary action, large touch targets, no ads/offers/feeds.

- **Receive (default once configured):** pure white screen for maximum contrast, "Show to receive money", QR sized to `min(width-88, 46% height, 420)`, label below, chips to switch (hidden with one QR), `＋` and Manage at the bottom. Brightness 100% and wake lock while visible, previous brightness restored on leave. QR springs in on each switch, chips give selection haptics.
- **Empty state:** "Get paid in one tap", single "Add my QR" button, "Stays on this device. Never uploaded."
- **Setup:** Scan or Paste, instant preview, one editable name, "Save and show" returns to the QR immediately.
- **Manage:** list, make main, delete with confirm, biometric toggle, delete everything.
- **Duolingo cues:** cream background, chunky 3D buttons with press-down and haptic, rounded shapes, per-profile accent colors, friendly short copy.
- **SuperMoney cues:** zero chrome on the main screen, fast path, no onboarding wall, plain money language.
- Roadmap: swipe left/right to switch, home-screen shortcut / Android quick-settings tile / iOS App Intent and Lock Screen widget to open directly on the QR, dark-QR-on-white even in system dark mode (already forced white).

## 5. Launch speed

- Receive screen renders from local data; no network gate.
- Hermes on native. Avoid heavy imports on the first screen (camera loads with Setup only; lazy-load it with `React.lazy` if bundle size grows).
- Web: WASM is 4.3 MB raw (about 1.2 MB gzip/brotli; serve with compression and long cache headers). Fallback if first paint matters more: TinyGo for the bridge (about 300–600 KB), at the cost of some stdlib gaps; test `crypto/pbkdf2` support before adopting.
- Web PWA: add a manifest and service worker so repeat visits open offline and instantly.

## 6. Store readiness

**Positioning:** a "QR display and organiser" utility. It does not move money, hold funds, process payments or connect to banks, so it is not a payment gateway or wallet. Avoid names or icons that imply PhonePe/Paytm/Google Pay/UPI affiliation. Do not use NPCI/UPI logos without brand-guideline approval. State "not affiliated with any payment provider".

**Permissions (minimal):**
| Permission | Why | Notes |
|---|---|---|
| Camera | Scan your own QR | Requested only on tapping "Allow camera". Paste works without it |
| Biometric / Face ID | Optional lock | `USE_BIOMETRIC`, `NSFaceIDUsageDescription` |
| Brightness | App-window brightness | No permission needed (not system brightness) |
| Network | Only if sync is enabled | None used today |

Audio and storage permissions are blocked in `app.json`.

**Google Play Data safety:** data collected: none (with no sync). With sync on: "App activity/other user content, encrypted in transit and at rest, user can request deletion", optional. Declare encryption in transit, deletion mechanism (in-app "Delete all my data" plus `DELETE /v1/sync/{id}`). Provide a privacy policy URL. Target the current required API level.

**Apple App Privacy:** "Data Not Collected" with no sync. Camera usage string is set. `ITSAppUsesNonExemptEncryption: false` is set; standard AES/TLS used only for data protection generally qualifies for the exemption, but confirm your export-compliance answers. Apple guideline 4.2 (minimum functionality): the app should ship with real utility beyond a web wrapper (multiple profiles, lock, camera scan, widgets) which the roadmap covers. Provide review notes with a sample `upi://pay?pa=test@bank` payload.

**Other:** do not claim "official" payment or bank-grade security; say "encrypted on your device". Add accessibility labels (done on buttons/QR) and test with large font sizes. Supply a support email and privacy policy. Legal review for your regions is on you.

## 7. Known limitations and next steps

1. Native Go module not built in this repo (needs NDK/Xcode). Until linked, mobile runs the unencrypted TS fallback.
2. Web key sits beside ciphertext (see caveat).
3. Sync server has no rate limiting or auth beyond an unguessable id; add rate limits at the edge before enabling publicly.
4. No automated UI tests; add Jest + golden vectors shared with Go.
5. `com.example.quickpayqr`, icons and splash are placeholders.
