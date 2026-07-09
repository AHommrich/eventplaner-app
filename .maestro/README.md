# End-to-end flows (Maestro)

The Jest suite under [`tests/`](../tests/) covers unit and screen-behaviour
tests, but it stops at the boundary where React Native meets the platform:
camera permissions, deep links, real navigation transitions, cross-tab
state. This directory closes that gap with a small [Maestro](https://maestro.mobile.dev)
suite that drives a real (or simulated) device the way a wedding guest
would.

The flows are deliberately kept small — Maestro is best used for a handful
of golden-path smoke tests, not exhaustive coverage. Detailed logic belongs
in Jest.

## What the suite tests today

| Flow                                 | What it proves                                                                                                                                                                                                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`solo-login.yaml`](solo-login.yaml) | Cold-launched app → welcome screen → scan screen → DEV token entry → backend two-step auth → home tab renders. Exercises `app/index.tsx` (session probe), `app/scan.tsx` (DEV token path), `lib/auth.ts` (SecureStore save), and `lib/EventThemeContext.tsx` (theme fetch). |
| [`logout.yaml`](logout.yaml)         | Signed-in guest → Settings tab → Logout → welcome screen re-renders. Exercises `app/(tabs)/settings.tsx`, `lib/auth.ts::clearSession` (which also fires the backend logout), and the empty-session branch of the welcome screen probe.                                      |

Family QR (two-step picker), gallery-based QR login, RSVP flow, photo
upload, and photo-game submission are intentionally NOT covered here yet —
each has real hardware/permission demands that inflate flow time without
adding proportional confidence. The Jest screen-behaviour tests cover the
UI logic; add a Maestro flow later only if a bug reaches production that
Jest could plausibly have caught but did not.

## Prerequisites

1. **Maestro CLI installed locally.**

   ```bash
   curl -Ls "https://get.maestro.mobile.dev" | bash
   # …then follow the printed hint to add ~/.maestro/bin to PATH.
   ```

   On a machine without Homebrew the tarball at [github.com/mobile-dev-inc/maestro/releases](https://github.com/mobile-dev-inc/maestro/releases)
   works as well. This project pins nothing — any Maestro `≥ 1.38` runs
   the flows.

2. **A running app instance.** Either
   - iOS Simulator with the native dev client installed via `npx expo run:ios`, **or**
   - Android emulator with `npx expo run:android`, **or**
   - Expo Go on a physical device that just booted the project from `npx expo start` (see the note in [`config.yaml`](config.yaml)).

3. **A running backend.** The default `API_BASE` in
   [`constants/env.ts`](../constants/env.ts) points at `beta.hommrich.app`;
   for CI-style runs against your local Laravel container, swap it (or
   flip `EXPO_PUBLIC_API_BASE` at bundle time — see
   [`docs/e2e.md`](../docs/e2e.md)).

4. **A test token exported to the shell.**

   ```bash
   export MAESTRO_SOLO_TOKEN='<solo QR token>'
   ```

   Use a **local-only** or dedicated demo token that will not authenticate
   against production. The flow references the env var, not the raw token, so
   nothing sensitive is committed to the repo.

## Running the flows

Single flow:

```bash
maestro test .maestro/solo-login.yaml
```

Full happy path (login → logout, chained):

```bash
maestro test .maestro/solo-login.yaml .maestro/logout.yaml
```

Interactive REPL — useful when tweaking a flow that keeps failing on a
specific step (Maestro shows a screenshot per command):

```bash
maestro studio
```

## Notes on selector strategy

The flows select by **visible text**, not by `testID`. The trade-off:

- Pro: no code changes in the app to make E2E work; the flows read like a
  guest's actual path through the UI.
- Con: rewording a label in `locales/*.ts` breaks the flow. If a text-label
  changes, the fix is a one-line yaml edit — cheap to update.
- The alternative — `testID` everywhere — would litter the JSX and still
  requires a Maestro `id:` selector, so unless a flow becomes chronically
  flaky, we keep the text-based approach.

All flows target the **German** copy because the app defaults to `de` per
[`lib/LanguageContext.tsx`](../lib/LanguageContext.tsx). Testing against
the English copy is a matter of setting `EXPO_PUBLIC_DEFAULT_LOCALE=en` at
bundle time and swapping the assertion strings; it is not wired up yet
because DE is the only launch locale for the actual wedding.

## Where CI fits in

Full CI-hosted E2E is currently **not wired**. Options considered:

- [Maestro Cloud](https://cloud.mobile.dev) — hosted iOS + Android runs.
  Not enabled yet because the free tier is limited and the flows already
  exercise a backend endpoint that must be reachable from the runner.
- [GitHub Actions with `mobile-dev-inc/action-maestro-cloud`](https://github.com/mobile-dev-inc/action-maestro-cloud)
  — would need a Maestro Cloud account.
- Self-hosted macOS runner — overkill for the current flow count.

For now the flows run locally on the developer machine and the Jest suite
plus lint/typecheck workflows handle CI. See
[`docs/e2e.md`](../docs/e2e.md) for a longer discussion.
