# eventplaner-app

> **[Deutsche Version -> `README.de.md`](README.de.md)**

[![lint](https://github.com/AHommrich/eventplaner-app/actions/workflows/lint.yml/badge.svg?branch=main)](https://github.com/AHommrich/eventplaner-app/actions/workflows/lint.yml)
[![typecheck](https://github.com/AHommrich/eventplaner-app/actions/workflows/typecheck.yml/badge.svg?branch=main)](https://github.com/AHommrich/eventplaner-app/actions/workflows/typecheck.yml)
[![test](https://github.com/AHommrich/eventplaner-app/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/AHommrich/eventplaner-app/actions/workflows/test.yml)
[![License](https://img.shields.io/badge/License-All%20Rights%20Reserved-red.svg)](LICENSE)

React Native / Expo companion app for wedding guests and organizers. Guests
scan a QR-code invitation once and get a small event hub: RSVP, schedule,
countdown and venue navigation, photos, party games and privacy self-service.
Approved organizers pair the app through a short-lived, one-time QR to switch
events, manage Notes/ToDos and photos, and receive optional task notifications.

This repository is public as a portfolio/showcase project. The production
backend is separate, guest access is controlled through QR/bearer tokens, and
real event data is not part of this repository.

## Highlights

- One scanner automatically recognizes Guest invitations and Organizer pairing QRs.
- Passwordless Guest login with a two-step family picker.
- Isolated Organizer device pairing via short-lived, single-use QR.
- Active-event management for Notes/ToDos and cross-gallery photo deletion.
- Privacy-minimized assignment pushes without task or guest content on the lock screen.
- Backend-driven theme, event copy and feature flags.
- DSGVO-oriented privacy surfaces in the app, not only in external documents.
- Local font bundling, no runtime font CDN dependency.
- Shared API/auth layer with mutually exclusive SecureStore-backed guest and organizer sessions.
- Jest coverage for library and screen behavior plus a small Maestro smoke
  suite for login/logout.

## Tech Stack

| Layer      | Choice                                                 |
| ---------- | ------------------------------------------------------ |
| App        | Expo SDK 54, Expo Router v6, React Native              |
| Language   | TypeScript, strict mode                                |
| Styling    | NativeWind v4, Tailwind v3, backend-driven theme       |
| Data       | Axios client with actor-aware bearer and event scoping |
| Storage    | `expo-secure-store` for guest and organizer sessions   |
| Push       | Expo Notifications for optional organizer tasks        |
| i18n       | `i18n-js` with German and English dictionaries         |
| Monitoring | Optional Sentry React Native integration               |
| Tests      | Jest, `jest-expo`, React Native Testing Library        |
| E2E        | Maestro local smoke flows                              |

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

Organizer mode additionally needs a fresh one-time pairing QR generated from
an approved, verified web account. Real remote-push delivery requires an EAS
development/store build with configured APNs/FCM credentials; Expo Go is still
sufficient for the non-push UI.

Direct native account sign-in is intentionally not exposed yet. Password login
and the web app's OAuth providers must ship together so OAuth-only accounts are
never offered a second-class organizer path.

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
lib/          API, guest/organizer auth, management, push and privacy logic
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

Organizer sessions use a different User bearer and are mutually exclusive with
guest sessions. The backend re-authorizes every event-scoped management request.
Optional Expo pushes contain generic copy plus technical event/note IDs, never
the note title/body, event name, guest data or assigning user. Push is explicit
opt-in; logout/device revocation removes the bearer-bound server destination,
and offline logout is retried on a later app start.

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
- Remote organizer pushes need configured APNs/FCM credentials and a native build.
- E2E is smoke-only; deeper behavior is covered by Jest.
- Demo data is backend-provided. The app does not ship an offline mock server.

## License

All rights reserved. See [`LICENSE`](LICENSE). Publicly viewable for portfolio
purposes; no reuse, fork or redistribution without written permission.
