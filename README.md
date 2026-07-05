# eventplaner-app

> **[Deutsche Version → `README.de.md`](README.de.md)**

[![lint](https://github.com/AHommrich/eventplaner-app/actions/workflows/lint.yml/badge.svg?branch=main)](https://github.com/AHommrich/eventplaner-app/actions/workflows/lint.yml)
[![typecheck](https://github.com/AHommrich/eventplaner-app/actions/workflows/typecheck.yml/badge.svg?branch=main)](https://github.com/AHommrich/eventplaner-app/actions/workflows/typecheck.yml)
[![test](https://github.com/AHommrich/eventplaner-app/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/AHommrich/eventplaner-app/actions/workflows/test.yml)
[![License](https://img.shields.io/badge/License-All%20Rights%20Reserved-red.svg)](LICENSE)

> **Status: portfolio-ready.** The 12-phase refactor documented in
> [`docs/REFACTOR_PLAN.md`](docs/REFACTOR_PLAN.md) is complete and every
> follow-up is closed. The repo is not under active feature work — future
> changes will land as isolated PRs (Dependabot bumps, occasional polish).
> For a reviewer-oriented tour of the four decisions that shaped the code,
> start at [`docs/showcase/`](docs/showcase/).

A wedding-guest companion app. Guests receive a QR-code invitation, scan it
once and land in a small event hub — RSVP, home screen with countdown and
venue navigation, photo gallery, photo game, drinks log, and a settings tab
that also houses the DSGVO surfaces (privacy notice, consents, data export,
erasure request). No passwords, no accounts, no third-party trackers.

The app is built as the client to a Laravel 12 backend that the same author
maintains at [github.com/AHommrich/eventplaner](https://github.com/AHommrich/eventplaner).
The wedding is real, the couple is André & Tabea Hommrich, and the code is
made publicly viewable for portfolio and reference purposes after the
phased refactor documented in
[`docs/REFACTOR_PLAN.md`](docs/REFACTOR_PLAN.md).

---

## Table of contents

1. [Highlights](#1-highlights)
2. [Tech stack](#2-tech-stack)
3. [Quick start](#3-quick-start)
4. [Scripts](#4-scripts)
5. [Project structure](#5-project-structure)
6. [Testing](#6-testing)
7. [DSGVO / privacy](#7-dsgvo--privacy)
8. [Documentation index](#8-documentation-index)
9. [License](#9-license)

---

## 1. Highlights

1. **Passwordless QR login with two-step family flow.** A solo guest lands
   directly in the app; a family QR opens a name-picker before minting the
   per-guest session. Implementation: [`app/index.tsx`](app/index.tsx),
   [`app/scan.tsx`](app/scan.tsx), [`lib/auth.ts`](lib/auth.ts).
2. **Backend-driven dynamic theme.** Colours, fonts and event copy are
   fetched from `/api/event/info` and threaded through every screen via
   `useEventTheme()`. Zero hard-coded hex values in screens is a code-review
   rule. Implementation: [`lib/EventThemeContext.tsx`](lib/EventThemeContext.tsx).
3. **DSGVO compliance surfaced in the app, not just on a website.** In-app
   privacy notice (Art. 13), explicit purpose-scoped consents (Art. 6 / 7),
   JSON data export (Art. 15) and a 30-day erasure window (Art. 17), each
   as its own screen. Implementation: [`app/legal/`](app/legal),
   [`app/consents/`](app/consents), [`app/data-export.tsx`](app/data-export.tsx),
   [`app/erasure-pending.tsx`](app/erasure-pending.tsx),
   [`lib/legal.ts`](lib/legal.ts), [`lib/consents.ts`](lib/consents.ts),
   [`lib/erasure.ts`](lib/erasure.ts).
4. **Ten Google Fonts bundled locally.** No `fonts.gstatic.com` traffic at
   runtime — a deliberate choice to avoid the DSGVO problem that broke
   third-party font hotlinking in 2022. Implementation:
   [`constants/fonts.ts`](constants/fonts.ts) + `@expo-google-fonts/*`
   packages.
5. **One-line pull-to-refresh across every tab.** `useRefreshToast()` centralises
   the "spinner + confirmation toast" pattern so screens never wire it manually.
   Implementation: [`lib/useRefreshToast.ts`](lib/useRefreshToast.ts).
6. **Per-tab visibility rules driven by backend flags.** Drinks tab hides
   when the couple disables it mid-event; RSVP tab hides once the guest is
   fully accepted. Implementation: [`app/(tabs)/_layout.tsx`](<app/(tabs)/_layout.tsx>),
   [`lib/BlockedFeaturesContext.tsx`](lib/BlockedFeaturesContext.tsx).
7. **Photo game with a four-state client automaton.** No task yet →
   assigned → submitted → done. Implementation:
   [`app/(tabs)/photo-game.tsx`](<app/(tabs)/photo-game.tsx>).
8. **Native maps handoff with coordinate-first URL construction.** iOS shows
   an app picker (Apple Maps / Google Maps) with a Google Maps fallback to
   Apple Maps; Android uses `geo:lat,lng` — never
   `geo:lat,lng?q=<address>` because the `q=` overrides the coordinates.
   Implementation: `openInMaps` in [`app/(tabs)/home.tsx`](<app/(tabs)/home.tsx>).

Screenshots live in [`docs/screenshots/`](docs/screenshots) once captured
against a stable staging state; the folder is intentionally empty on first
commit so the repo does not ship placeholder art.

---

## 2. Tech stack

| Layer        | Choice                                               | Why this one                                                                                                                                        |
| ------------ | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework    | Expo SDK 54 + Expo Router v6                         | File-based routing keeps the redirect matrix (session → RSVP → home) close to the file tree.                                                        |
| Language     | TypeScript (strict)                                  | Every backend response has an interface; every provider a shape.                                                                                    |
| Styling      | NativeWind v4 + Tailwind v3                          | Tailwind tokens for structure, `useEventTheme()` colours for brand.                                                                                 |
| HTTP         | Axios + Bearer interceptor                           | Single client in [`lib/api.ts`](lib/api.ts); screens never import axios directly.                                                                   |
| Auth storage | `expo-secure-store`                                  | Keychain / Keystore only — never AsyncStorage — because tokens never expire on the backend.                                                         |
| Icons        | `@expo/vector-icons` (Ionicons)                      | Single icon family, ships offline.                                                                                                                  |
| i18n         | `i18n-js` + `LanguageContext`                        | Two locales (DE + EN), device-detected on first launch, switchable in Settings.                                                                     |
| Test runner  | Jest + `jest-expo` + `@testing-library/react-native` | Official Expo test preset, no custom transformer.                                                                                                   |
| Fonts        | `@expo-google-fonts/*` (10 families)                 | Bundled locally, zero CDN traffic.                                                                                                                  |
| Backend      | Laravel 12 + Sanctum                                 | [`AHommrich/eventplaner`](https://github.com/AHommrich/eventplaner); wedding-app-specific tokens with `app_blocked` / `drinks_blocked` soft-blocks. |

Pinned dependency versions for Expo Go SDK 54 compatibility (touching these
crashes the JSI bridge — do not upgrade in isolation):

```
react-native-screens: ~4.16.0
react-native-reanimated: ~4.1.1
react-native-gesture-handler: ~2.28.0
react-native-safe-area-context: ~5.6.0
```

---

## 3. Quick start

```bash
nvm use                              # Node 20 (`.nvmrc`)
npm install --legacy-peer-deps       # React 19 peer-dep conflict flag
npx expo start                       # Metro + Expo Go pairing QR
```

Open Expo Go on a real device, scan the Metro QR, and use one of the DEV
tokens on the scan screen (`app/scan.tsx`). Production QR codes point at
`https://hommrich.app`; the development tokens documented in `CLAUDE.md`
target the local Laravel instance and will not authenticate on staging or
production.

`API_BASE` lives in [`constants/env.ts`](constants/env.ts) — staging by
default (`https://beta.hommrich.app`). Flip to production only for a
release build.

---

## 4. Scripts

| Script                                            | What it does                                                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `npm start`                                       | `expo start` — Metro + QR pairing.                                                                      |
| `npm run ios` / `npm run android` / `npm run web` | Same as above with a platform preset.                                                                   |
| `npm run lint`                                    | ESLint over the tree. Warnings are allowed — the tightening path is tracked in `docs/REFACTOR_PLAN.md`. |
| `npm run lintfix`                                 | ESLint `--fix`. **Do not** run against pre-refactor code without reviewing the diff.                    |
| `npm run format:check`                            | Prettier check-only.                                                                                    |
| `npm run format`                                  | Prettier write. Same "not on pre-refactor code" caveat.                                                 |
| `npm run typecheck`                               | `tsc --noEmit`, strict.                                                                                 |
| `npm test`                                        | Jest single run.                                                                                        |
| `npm run test:watch`                              | Jest watch mode.                                                                                        |
| `npm run test:coverage`                           | Jest with coverage; enforces the per-directory thresholds in [`jest.config.js`](jest.config.js).        |

---

## 5. Project structure

Full tree with per-file rationale lives in [`CLAUDE.md`](CLAUDE.md) and
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Short version:

```
app/                Screens (Expo Router file-based routing)
  legal/            Privacy notice (Art. 13)
  consents/         Consent management (Art. 6 / 7 / 7 (3))
  (tabs)/           Home + tab bar (RSVP, photos, photo game, drinks, settings)
components/         Shared UI wrappers (ThemedText, RefreshToast, ConsentGate)
lib/                Non-UI modules — the "backend of the client" (api, auth, guest, legal, consents, erasure, ...)
constants/          Static design tokens + env (`theme.ts`, `env.ts`, `fonts.ts`)
locales/            de + en translation dictionaries
docs/               ARCHITECTURE, REFACTOR_PLAN, dependencies audit, storage-keys audit, e2e strategy
tests/              setup + mirrored test tree (Jest)
.maestro/           E2E flow suite (Maestro) — login + logout smoke
scripts/            One-off maintenance scripts (jsQR vendor sync)
```

---

## 6. Testing

- **Unit tests** — every module under `lib/**` and `constants/**` has a
  matching `*.test.ts` file. Thresholds enforced: ≥ 90 % lines and branches
  on `lib/**`, 100 % on `constants/**`.
- **Screen tests** — happy path + one plausible failure per screen. Current
  floor is 60 % lines on `app/**`; the 80 % target sits in
  [`docs/REFACTOR_PLAN.md → Follow-ups`](docs/REFACTOR_PLAN.md).
- **Regressions** — [`tests/regressions/no-tracking.test.ts`](tests/regressions/no-tracking.test.ts)
  fails CI if any known analytics or crash-reporting SDK sneaks into
  `package.json`, or if a public-CDN hostname reappears in the source tree.
- **Vendor sync** — [`tests/vendor/jsqr-source-sync.test.ts`](tests/vendor/jsqr-source-sync.test.ts)
  fails CI if the vendored jsQR copy under
  [`lib/vendor/`](lib/vendor/) drifts from the installed npm version.
  Regenerated via `node scripts/vendor-jsqr.mjs`.
- **End-to-end** — [`.maestro/`](.maestro/) hosts a small Maestro flow
  suite that drives a real device through the golden login + logout path.
  Design rationale in [`docs/e2e.md`](docs/e2e.md), how-to in
  [`.maestro/README.md`](.maestro/README.md).

More detail (what is and isn't tested, why no visual snapshots): see
[`tests/README.md`](tests/README.md).

---

## 7. DSGVO / privacy

This app is built for a real wedding in Germany. DSGVO is not a checkbox
here — it is part of the design.

- **Art. 13 (transparency)** — the privacy notice lives at
  `Settings → Datenschutzerklärung`. Content is served from the backend and
  cached in `expo-secure-store` for 24 h so airplane mode still shows the
  text. Implementation: [`app/legal/privacy.tsx`](app/legal/privacy.tsx),
  [`lib/legal.ts`](lib/legal.ts).
- **Art. 6 / 7 (consent)** — every processing surface (photo upload,
  photo-game submission, camera scan) is wrapped in a `ConsentGate` that
  shows a purpose-specific consent modal before the OS permission dialog.
  Consents are stored per purpose with a timestamp (the Art. 7 (1) burden
  of proof). Implementation: [`components/ConsentGate.tsx`](components/ConsentGate.tsx),
  [`lib/consents.ts`](lib/consents.ts).
- **Art. 7 (3) (withdrawal)** — `Settings → Einwilligungen verwalten` lists
  every granted consent with its timestamp and a one-tap revoke. Withdrawal
  is exactly as easy as granting. Implementation:
  [`app/consents/index.tsx`](app/consents/index.tsx).
- **Art. 15 (access)** — `Settings → Meine Daten exportieren` downloads a
  JSON copy of everything the backend holds about the guest and hands it to
  `expo-sharing`. The file never lands on disk unencrypted. Implementation:
  [`app/data-export.tsx`](app/data-export.tsx).
- **Art. 17 (erasure)** — `Settings → Konto löschen` schedules a 30-day
  soft delete on the backend. During the window the app stays signed out
  but keeps enough state to offer a one-tap revocation without another QR
  scan. Implementation: [`app/erasure-pending.tsx`](app/erasure-pending.tsx),
  [`lib/erasure.ts`](lib/erasure.ts).
- **Data minimisation** — enforced by
  [`tests/regressions/no-tracking.test.ts`](tests/regressions/no-tracking.test.ts).
  Documented by [`docs/dependencies.md`](docs/dependencies.md) (every runtime
  dep, does it phone home) and
  [`docs/storage-keys.md`](docs/storage-keys.md) (every on-device key).
- **Fonts** — 10 Google Fonts bundled locally, zero CDN traffic at runtime.
  This is the specific compliance failure that hit hard in 2022; we do not
  reproduce it.

---

## 8. Documentation index

- [`CLAUDE.md`](CLAUDE.md) — patterns, colour rules, endpoint reference,
  pitfalls. Written for anyone (or any coding agent) opening the tree.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — layer diagram, provider
  tree, auth-flow sequence, per-screen non-obvious rules, DSGVO design.
- [`docs/REFACTOR_PLAN.md`](docs/REFACTOR_PLAN.md) — the twelve phases that
  brought the repo to this state, plus the running follow-ups list.
- [`docs/dependencies.md`](docs/dependencies.md) — per-package data-flow
  audit backing the "no third-party tracking" claim.
- [`docs/storage-keys.md`](docs/storage-keys.md) — every `expo-secure-store`
  key: purpose, retention, cleared-on-logout status.
- [`SECURITY.md`](SECURITY.md) — vulnerability reporting policy.
- [`tests/README.md`](tests/README.md) — what the Jest suite tests and why.
- [`docs/e2e.md`](docs/e2e.md) — end-to-end strategy, layer boundaries, and
  the reasoning behind the Maestro flows.
- [`.maestro/README.md`](.maestro/README.md) — Maestro setup + how to run
  the E2E flows locally.
- [`docs/showcase/`](docs/showcase/) — engineering narratives for a
  reviewer reading the repo cold: the four decisions that shaped it
  (DSGVO, theme engine, QR auth, testing pyramid) and the alternatives
  that were rejected.

---

## 9. License

All rights reserved. See [`LICENSE`](LICENSE). Publicly viewable for
portfolio purposes; no reuse, fork, or redistribution without written
permission. The wedding photos and any personal data that flow through
the running app are of course not covered by the code license.
