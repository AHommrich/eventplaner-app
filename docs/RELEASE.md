# Release Playbook

This file is the operational checklist for preview, TestFlight and Play Store
builds. Store metadata and account state live in `docs/STORE_RELEASE.md`.

## Preflight

Run under the Node version from `.nvmrc`:

```bash
nvm use
npm run typecheck
npm run lint
npm run test:coverage
```

Run the Maestro smoke suite locally before uploading a store build:

```bash
maestro test .maestro
```

Do not continue if any check fails. Fix, re-run the failing check, then re-run
the full preflight before building.

## Versioning

- `app.json` `expo.version` is the user-visible version (`1.0.0`, `1.0.1`,
  `1.1.0`). Bump it manually when the release has user-visible changes.
- EAS `production.autoIncrement` handles native build numbers for store
  uploads. Do not hand-edit build numbers unless EAS specifically requires it.
- JS-only fixes can ship through EAS Update only when they do not touch native
  configuration, permissions, assets, plugins or dependencies.

## Build Profiles

| Command                                             | Backend                     | Purpose                        |
| --------------------------------------------------- | --------------------------- | ------------------------------ |
| `eas build --profile preview --platform all`        | `https://beta.hommrich.app` | Internal device testing        |
| `eas build --profile production --platform ios`     | `https://eveplan.de`        | TestFlight / App Store         |
| `eas build --profile production --platform android` | `https://eveplan.de`        | Play Internal / Closed Testing |

The production backend override comes from `eas.json`. Do not edit
`constants/env.ts` for a production release.

## Store Upload

```bash
eas submit --profile production --platform ios
eas submit --profile production --platform android
```

Before submission, confirm `docs/STORE_RELEASE.md` contains:

- Apple Developer and Play Console access status
- Support email
- Privacy URL
- Imprint URL
- Reviewer access notes
- Age-rating decision

## Smoke-Test Matrix

Run this once on iOS and once on Android before store upload:

| Area       | Check                                                                     |
| ---------- | ------------------------------------------------------------------------- |
| Login      | Fresh install, scan a real solo QR, land on the correct post-login route. |
| RSVP       | Submit or update RSVP and verify the expected route/tab state.            |
| Home       | Countdown, cover image and venue navigation render; maps handoff opens.   |
| Photos     | Gallery loads, upload asks for consent, successful upload refreshes.      |
| Photo game | Assignment loads; consent gate appears before photo submission.           |
| Drinks     | Drink list, search, log action and leaderboard load when enabled.         |
| Legal      | Impressum, Datenschutz, Consents, Data Export and Erasure routes open.    |
| Language   | Switch DE/EN in settings and verify tab + legal labels update.            |
| Logout     | Session clears and the welcome screen appears on restart.                 |

For reviewer builds, also verify the demo-token flow documented in
`docs/STORE_RELEASE.md`.

## Rollback

### JS-only Regression

Use EAS Update rollback when the broken change is purely JavaScript and does
not require native code, assets, permissions or plugin changes:

```bash
eas update:rollback --branch production
```

After rollback, smoke-test login, home, photos and settings on both platforms.

### Native Regression

If the regression touches native code or config, ship a new store build or
roll the store track back to the previous known-good build:

- App Store: make the previous build active again where Apple allows it, or
  submit a fixed build.
- Play Console: move the affected track back to the previous release or submit
  a fixed build.

## Not Safe For EAS Update

These always require a new native build:

- Info.plist / AndroidManifest changes
- permission text changes
- app icon, adaptive icon or splash changes
- native dependency changes
- Expo plugin changes
- bundle identifier / package name changes
- camera, photo-library or SecureStore native configuration changes
