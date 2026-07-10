# Release Playbook

This file is a public-safe operational checklist for preview, TestFlight and
Play Store builds. Store metadata, account state and reviewer credentials live
outside the public repository.

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

## Monitoring

Sentry is optional at runtime and intentionally disabled in Expo Go. For
development builds, TestFlight and Play Store builds, set:

| Variable                                | Required | Notes                                                                         |
| --------------------------------------- | -------- | ----------------------------------------------------------------------------- |
| `EXPO_PUBLIC_SENTRY_DSN`                | yes      | Public DSN for runtime error reporting. Leave unset to disable Sentry.        |
| `EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | no       | Defaults to `0`; keep low or disabled unless performance tracing is needed.   |
| `EXPO_PUBLIC_ENABLE_SENTRY_TEST_BUTTON` | no       | Set to `1` only for a temporary TestFlight/preview verification build.        |
| `SENTRY_ORG`                            | no       | Optional source-map upload org slug. Use an example or private EAS value.     |
| `SENTRY_PROJECT`                        | no       | Optional source-map upload project slug. Use an example or private EAS value. |
| `SENTRY_AUTH_TOKEN`                     | release  | Secret for source-map upload. Configure in EAS/CI, never commit.              |
| `SENTRY_ALLOW_FAILURE`                  | build    | Set to `true` in `eas.json` so a Sentry upload issue never blocks archives.   |

The client config in `lib/monitoring.ts` is crash-only: `sendDefaultPii: false`,
no Session Replay and no Sentry Logs. If Sentry SaaS is used, keep the app's
public privacy text in sync because diagnostics are shared with a third party
for operational purposes.

Run these once per EAS environment. The DSN is public but still kept out of the
repo so preview and production can diverge later if needed:

```bash
eas env:create --environment preview --name EXPO_PUBLIC_SENTRY_DSN --value "" --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_SENTRY_DSN --value "" --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE --value "0" --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE --value "0" --visibility plaintext
eas env:create --environment preview --name SENTRY_AUTH_TOKEN --value "<sentry-auth-token>" --visibility secret
eas env:create --environment production --name SENTRY_AUTH_TOKEN --value "<sentry-auth-token>" --visibility secret
```

`app.config.js` wires the Sentry Expo plugin from `SENTRY_ORG` and
`SENTRY_PROJECT`, with example defaults only. `SENTRY_AUTH_TOKEN` is required
for source-map upload; do not commit that token. EAS builds set
`SENTRY_ALLOW_FAILURE=true` so an invalid Sentry project/token cannot fail an
App Store archive. Treat any Sentry upload warning as a release follow-up and
verify the real org/project slugs in Sentry before relying on de-obfuscated
production stack traces.

For a temporary TestFlight verification build, enable the hidden Settings row:

```bash
eas env:create --environment production --name EXPO_PUBLIC_ENABLE_SENTRY_TEST_BUTTON --value "1" --visibility plaintext
```

After Sentry receives the test event, remove that variable or set it to `0`
before the real store release. The button only calls `captureException`; it does
not crash the app.

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

Each build profile also declares the EAS environment it consumes:

| Profile       | EAS environment |
| ------------- | --------------- |
| `development` | `preview`       |
| `preview`     | `preview`       |
| `production`  | `production`    |

## Store Upload

```bash
eas submit --profile production --platform ios
eas submit --profile production --platform android
```

Before submission, confirm the private store checklist contains:

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

For reviewer builds, also verify the private demo-token or reviewer access
flow. Never commit real reviewer tokens.

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
