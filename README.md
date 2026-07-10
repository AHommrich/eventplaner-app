# eventplaner-app

> **[Deutsche Version -> `README.de.md`](README.de.md)**

[![lint](https://github.com/AHommrich/eventplaner-app/actions/workflows/lint.yml/badge.svg?branch=main)](https://github.com/AHommrich/eventplaner-app/actions/workflows/lint.yml)
[![typecheck](https://github.com/AHommrich/eventplaner-app/actions/workflows/typecheck.yml/badge.svg?branch=main)](https://github.com/AHommrich/eventplaner-app/actions/workflows/typecheck.yml)
[![test](https://github.com/AHommrich/eventplaner-app/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/AHommrich/eventplaner-app/actions/workflows/test.yml)
[![License](https://img.shields.io/badge/License-All%20Rights%20Reserved-red.svg)](LICENSE)

React Native / Expo companion app for wedding guests. Guests scan a QR-code
invitation once and get a small event hub: RSVP, countdown and venue navigation,
photo gallery, photo game, drinks log, language settings, privacy notice,
consent management, data export and erasure request.

This repository is public as a portfolio/showcase project. The production
backend is separate, guest access is controlled through QR/bearer tokens, and
real event data is not part of this repository.

## Highlights

- Passwordless QR login with a two-step family picker.
- Backend-driven theme, event copy and feature flags.
- DSGVO-oriented privacy surfaces in the app, not only in external documents.
- Local font bundling, no runtime font CDN dependency.
- Shared API/auth layer with SecureStore-backed guest sessions.
- Jest coverage for library and screen behavior plus a small Maestro smoke
  suite for login/logout.

## Tech Stack

| Layer      | Choice                                           |
| ---------- | ------------------------------------------------ |
| App        | Expo SDK 54, Expo Router v6, React Native        |
| Language   | TypeScript, strict mode                          |
| Styling    | NativeWind v4, Tailwind v3, backend-driven theme |
| Data       | Axios client with bearer interceptor             |
| Storage    | `expo-secure-store` for guest/session state      |
| i18n       | `i18n-js` with German and English dictionaries   |
| Monitoring | Optional Sentry React Native integration         |
| Tests      | Jest, `jest-expo`, React Native Testing Library  |
| E2E        | Maestro local smoke flows                        |

The app expects a Laravel/Sanctum backend with the API shape documented in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and
[`docs/showcase/qr-auth.md`](docs/showcase/qr-auth.md).

## Quick Start

```bash
nvm use
npm install --legacy-peer-deps
npx expo start
```

Expo Go can run the app UI, but authenticated flows need a backend and a valid
local or demo QR token. Do not commit real guest tokens. For local smoke tests,
export a token through `MAESTRO_SOLO_TOKEN`.

`API_BASE` defaults to the staging backend in [`constants/env.ts`](constants/env.ts)
and can be overridden at build time:

| Build variant                    | API base behavior                          |
| -------------------------------- | ------------------------------------------ |
| Expo Go / `npm start`            | Uses `constants/env.ts` default            |
| `eas build --profile preview`    | Uses the preview EAS environment           |
| `eas build --profile production` | Uses the production override in `eas.json` |

Optional monitoring variables:

| Variable                                | Purpose                                          |
| --------------------------------------- | ------------------------------------------------ |
| `EXPO_PUBLIC_SENTRY_DSN`                | Enables Sentry runtime reporting when set        |
| `EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | Optional tracing sample rate, defaults to `0`    |
| `SENTRY_ORG` / `SENTRY_PROJECT`         | Optional source-map upload target overrides      |
| `SENTRY_AUTH_TOKEN`                     | Secret build-time token, never commit this value |

## Scripts

| Script                  | Purpose                           |
| ----------------------- | --------------------------------- |
| `npm start`             | Start Expo / Metro                |
| `npm run ios`           | Start iOS target                  |
| `npm run android`       | Start Android target              |
| `npm run lint`          | Run ESLint                        |
| `npm run format:check`  | Check Prettier formatting         |
| `npm run typecheck`     | Run `tsc --noEmit`                |
| `npm test`              | Run Jest once                     |
| `npm run test:coverage` | Run Jest with coverage thresholds |

## Project Structure

```text
app/          Expo Router screens
components/   Shared UI wrappers and controls
constants/    Theme, env and font maps
lib/          API, auth, guest, consent, legal and erasure logic
locales/      German and English translation dictionaries
tests/        Jest setup and mirrored test tree
.maestro/     Local E2E smoke flows
docs/         Architecture, privacy, testing and showcase notes
```

## Testing

- Unit and integration-style screen tests run through Jest.
- Regression tests guard against accidental tracking SDKs and runtime CDN font
  usage.
- Maestro covers a small real-device smoke path: login and logout.
- Store/native release steps are intentionally not fully reproducible from this
  repository alone because backend credentials and store accounts are private.

## Privacy and Security

Guest sessions are bearer-token based and intentionally long-lived for event UX.
The token is stored in `expo-secure-store` and bounded by backend-side event
cleanup/revocation. The trade-off is documented in
[`docs/showcase/qr-auth.md`](docs/showcase/qr-auth.md).

Persistent on-device keys are listed in
[`docs/storage-keys.md`](docs/storage-keys.md). Runtime dependency data-flow is
documented in [`docs/dependencies.md`](docs/dependencies.md). Vulnerability
reporting is covered by [`SECURITY.md`](SECURITY.md).

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) - layer overview and flow notes.
- [`docs/showcase/`](docs/showcase/) - short engineering narratives for review.
- [`docs/e2e.md`](docs/e2e.md) - E2E strategy and boundaries.
- [`tests/README.md`](tests/README.md) - test coverage rationale.
- [`.maestro/README.md`](.maestro/README.md) - local Maestro usage.

## Known Limitations

- The backend is a separate project and is required for authenticated flows.
- Public builds need real EAS/store credentials that are not included here.
- E2E is smoke-only; deeper behavior is covered by Jest.
- Demo data is backend-provided. The app does not ship an offline mock server.

## License

All rights reserved. See [`LICENSE`](LICENSE). Publicly viewable for portfolio
purposes; no reuse, fork or redistribution without written permission.
