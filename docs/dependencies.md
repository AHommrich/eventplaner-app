# Runtime dependency audit — data-flow review

This file enumerates every runtime dependency (`package.json` →
`dependencies`) and asks the same three questions of each:

1. **What does it do at runtime?**
2. **Does it phone home?** (i.e. does it open a network connection on its own,
   independent of the code we wrote?)
3. **If yes: to whom, and can we prove it stays offline in our config?**

The audit backs the "no third-party tracking" claim in the privacy notice.
The claim is also enforced automatically by
`tests/regressions/no-tracking.test.ts`, which greps the tree for known
analytics/crash-reporting SDKs — but a green test only proves the _absence_ of
banned SDKs; this document explains what the _present_ SDKs actually do.

`devDependencies` are excluded because they never ship to a guest phone — the
production bundle is produced by Metro from `dependencies` only.

## Networked dependencies

Exactly **one** runtime dependency opens network sockets, and it only opens
them to `API_BASE` from `constants/env.ts`:

| Package                | Phones home?                                                                                                                                          | To whom                                               | Notes                                                                                                                                                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `axios`                | Only to `constants/env.ts::API_BASE`                                                                                                                  | `hommrich.app` (prod) / `beta.hommrich.app` (staging) | Sole HTTP client. All backend calls funnel through `lib/api.ts`, which enforces the base URL and attaches the bearer via interceptor.                                                                                         |
| `react-native-webview` | Only when we render a WebView; the only such surface is `lib/QrFromImage.tsx` which loads an inline HTML string (no remote URL, no `src` attributes). | —                                                     | Never used to render remote URLs. The HTML template inlines a vendored `jsQR` copy (`lib/vendor/jsQRSource.ts`) — the previous CDN reference to `cdn.jsdelivr.net` was removed so the WebView produces zero outbound traffic. |

Everything else in the list is either pure UI, a native module wrapping a
local device capability, or a bundle-time helper.

## Fonts (locally bundled, zero CDN traffic)

Every `@expo-google-fonts/*` package ships the woff/otf files inside the app
bundle. There is **no CDN fetch at runtime** — this is a deliberate DSGVO
choice because Google Fonts served from `fonts.gstatic.com` is what triggered
the "Google Fonts is a DSGVO violation" case law wave in 2022.

| Package                                 | What ships                             |
| --------------------------------------- | -------------------------------------- |
| `@expo-google-fonts/cinzel`             | Cinzel Regular + Bold as local assets. |
| `@expo-google-fonts/comfortaa`          | Comfortaa Regular + Bold.              |
| `@expo-google-fonts/cormorant-garamond` | Cormorant Garamond Regular + Bold.     |
| `@expo-google-fonts/dancing-script`     | Dancing Script Regular + Bold.         |
| `@expo-google-fonts/great-vibes`        | Great Vibes Regular (single weight).   |
| `@expo-google-fonts/josefin-sans`       | Josefin Sans Regular + Bold.           |
| `@expo-google-fonts/lora`               | Lora Regular + Bold.                   |
| `@expo-google-fonts/nunito`             | Nunito Regular + Bold.                 |
| `@expo-google-fonts/playfair-display`   | Playfair Display Regular + Bold.       |
| `@expo-google-fonts/raleway`            | Raleway Regular + Bold.                |

The active font is selected server-side (`event_info.font_heading`) and
resolved through `constants/fonts.ts::FONT_MAP` to the locally bundled asset.
Nothing over the wire.

## Expo native modules

| Package                  | Purpose                                                                                          | Phones home?                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `expo`                   | Expo SDK core runtime.                                                                           | No, once Expo Go itself is installed.                                                                      |
| `@expo/metro-runtime`    | Metro bundler runtime shim. Bundle-time; no network I/O.                                         | No                                                                                                         |
| `expo-build-properties`  | Build-time config for native builds. Not evaluated at runtime by the client.                     | No                                                                                                         |
| `expo-camera`            | Camera preview + capture; wraps AVFoundation / Camera2.                                          | No                                                                                                         |
| `expo-clipboard`         | Read/write system clipboard.                                                                     | No                                                                                                         |
| `expo-constants`         | Reads env values baked into the bundle.                                                          | No                                                                                                         |
| `expo-font`              | Loads font assets registered by `@expo-google-fonts/*`.                                          | No                                                                                                         |
| `expo-image`             | Native image renderer; caches decoded bitmaps on disk under the OS-managed sandbox.              | Only when we pass it a remote URL (e.g. photo gallery items) — those URLs already point at `hommrich.app`. |
| `expo-image-manipulator` | On-device rotate/resize/crop. Runs in-process.                                                   | No                                                                                                         |
| `expo-image-picker`      | System photo-library / camera picker.                                                            | No                                                                                                         |
| `expo-linear-gradient`   | Gradient renderer.                                                                               | No                                                                                                         |
| `expo-linking`           | Deep-link URL parsing and opening.                                                               | No                                                                                                         |
| `expo-localization`      | Reads device locale on start-up.                                                                 | No                                                                                                         |
| `expo-router`            | File-based routing.                                                                              | No                                                                                                         |
| `expo-secure-store`      | Keychain (iOS) / Keystore (Android) wrapper for the values documented in `docs/storage-keys.md`. | No                                                                                                         |
| `expo-splash-screen`     | Splash controller.                                                                               | No                                                                                                         |
| `expo-status-bar`        | Status-bar styling.                                                                              | No                                                                                                         |

## React Native core and bridging

| Package                                               | Purpose                                               | Phones home? |
| ----------------------------------------------------- | ----------------------------------------------------- | ------------ |
| `react`, `react-native`, `react-native-web`           | Framework.                                            | No           |
| `react-native-gesture-handler`                        | Native gesture bridging for the navigation stack.     | No           |
| `react-native-reanimated`                             | Native animation driver.                              | No           |
| `react-native-safe-area-context`                      | Safe-area insets from the OS.                         | No           |
| `react-native-screens`                                | Native stack primitives used by Expo Router.          | No           |
| `react-native-worklets`, `react-native-worklets-core` | Worklet runtime used by Reanimated.                   | No           |
| `@react-native-masked-view/masked-view`               | Masking primitive used by parts of the navigation UI. | No           |

## Everything else

| Package                     | Purpose                                                                                                                                                                                                                             | Phones home? |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `i18n-js`                   | Translation lookup; strings come from `locales/de.ts` + `locales/en.ts`.                                                                                                                                                            | No           |
| `jsqr`                      | Pure-JS QR decoder used by `lib/QrFromImage.tsx`. Vendored into the JS bundle (`lib/vendor/jsQRSource.ts`, regenerated by `scripts/vendor-jsqr.mjs`) so it is never fetched from a CDN at runtime. Apache-2.0 attribution retained. | No           |
| `nativewind`, `tailwindcss` | Tailwind styling compiled at bundle time.                                                                                                                                                                                           | No           |

## Summary

- **1** package makes network calls (`axios`) — only to `hommrich.app`.
- **1** package renders content on demand from a URL we pass (`expo-image`) —
  the URLs point at `hommrich.app`.
- **10** font packages ship font files locally with no CDN fallback.
- **1** vendored copy of `jsqr` ships inside the JS bundle so the gallery-
  based QR decoder needs zero CDN traffic (`lib/vendor/jsQRSource.ts`).
- **Every other runtime dep** either wraps a local device capability or is a
  pure computation / rendering library.

There is **no** analytics SDK, crash-reporter, error-tracker, feature-flag
service, remote-config client, ad tracker, session-replay tool, or push-
notification service in the tree — enforced positively by this audit and
negatively by `tests/regressions/no-tracking.test.ts`. The same test also
fails if a CDN hostname (jsDelivr, unpkg, Google Fonts) reappears in the
source tree.

## When this file must be updated

- Any addition or removal of a runtime dependency in `package.json`.
- Any change to `constants/env.ts::API_BASE`.
- Any new WebView surface that loads a remote URL.
- Any bump of the vendored `jsqr` copy (re-run `node scripts/vendor-jsqr.mjs`
  after bumping the `jsqr` version in `package.json`).
