# End-to-end testing strategy

This document explains **why** the app has an end-to-end suite in addition
to the Jest tree under [`tests/`](../tests/), what each layer catches, and
where the boundary between them lives. The nuts-and-bolts of running the
flows live in [`.maestro/README.md`](../.maestro/README.md); this file is
the design rationale.

## The three testing layers

```
┌───────────────────────────────────────────────────────────────┐
│  Layer                    Runs on           Feedback in       │
├───────────────────────────────────────────────────────────────┤
│  Unit  (Jest, lib/**)     Node JSDOM        < 1 second        │
│  Screen (Jest, app/**)    Node JSDOM        1–2 seconds       │
│  E2E   (Maestro)          Simulator/device  ~30 s per flow    │
└───────────────────────────────────────────────────────────────┘
```

**Unit** tests hit the pure modules under `lib/`. They mock nothing that
matters — SecureStore is stubbed via `tests/setup.ts`, axios is mocked per
suite, and the assertions are made against the module's own API surface.
Coverage threshold: 90 % lines / 90 % branches
(see [`jest.config.js`](../jest.config.js)).

**Screen** tests render each screen through `@testing-library/react-native`,
mocking axios and expo-router but leaving the JSX + `useEffect` graph
intact. They catch regressions in _what the screen does_ — button dispatch,
navigation calls, state transitions — without paying the price of a real
device. Threshold: 60 % lines / 45 % branches, chosen honestly at today's
achievable ceiling because a handful of code paths (image picker →
multipart upload; family two-step picker with 409) are unreachable from a
unit harness. Both are called out in `jest.config.js` and covered by the
E2E suite instead.

**E2E** tests drive a real (or simulated) device via
[Maestro](https://maestro.mobile.dev). Only golden paths — the smoke tests
that cover regressions Jest cannot see:

- The camera permission dialog appears exactly once and does not block the
  DEV token input path.
- The Metro bundle actually boots on the OS's runtime, not just under Node.
- `expo-router` transitions between the tab layout and the modal login
  flow without leaking state.
- Bearer tokens saved by `saveSession` are actually attached by `lib/api`
  to the follow-up `/api/guest/me` request.

## Why Maestro rather than Detox

- **No native build required.** Detox needs a special `RN_SRC_EXT`-flagged
  build, which conflicts with the Expo Go workflow this project has to
  keep working (see `CLAUDE.md`). Maestro drives the app through UI
  automation only — same binary as the developer runs locally.
- **YAML flows read like guest scripts.** A wedding guest is not a
  developer; using a DSL that mirrors what they'd do keeps the flows
  reviewable without a domain deep-dive.
- **Cheap to write.** Two YAML files cover the login + logout smoke.
  Detox would need a JS test file with page objects and a `beforeAll` boot
  cycle per flow.

The Jest suite is not going away — Maestro just fills the gap it
structurally cannot reach.

## What the current flows verify

See [`.maestro/README.md`](../.maestro/README.md) for the flow-by-flow
list. Short version:

- `.maestro/solo-login.yaml` — cold start → welcome → scan → DEV token →
  backend two-step handshake → home tab.
- `.maestro/logout.yaml` — signed-in guest → settings tab → logout → back
  to welcome (session probe re-runs cleanly).

## What is deliberately NOT covered end-to-end

Each of these has been discussed and left out on purpose. Adding one is a
non-trivial decision because Maestro flows are the most expensive test
tier — flake once and CI blocks a merge.

| Not covered        | Why                                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Family QR two-step | Requires seed guest fixtures with `is_active` tracking; the 409 flow is already covered by the Jest test on `app/scan.tsx`. |
| Live camera scan   | Maestro can drive a virtual camera but calibrating a QR image → camera stream setup is disproportionate work.               |
| Photo upload       | Depends on a photo library populated in the simulator; hard to make deterministic.                                          |
| RSVP decline       | The confirm dialog + backend revocation flow is covered by the Jest screen test on `app/(tabs)/rsvp.tsx`.                   |

## CI wiring — deliberately absent for now

Options considered:

1. **Maestro Cloud + GitHub Actions.** Would need a paid account past the
   free tier and a way to reach the local Laravel backend from the cloud
   runner.
2. **Self-hosted macOS runner.** Solves the network problem but adds
   ownership and maintenance overhead that outweighs the current benefit.
3. **Nightly job on a personal machine.** Feasible but reintroduces the
   "runs on my laptop" problem the CI move was supposed to fix.

The decision today is: keep the flows in-repo, run them by hand before a
release, and revisit CI when a bug slips through that a Maestro run would
have caught. The Jest suite plus the lint/typecheck workflows are the
merge gate; E2E is a smoke test the maintainer runs consciously.

## Adding a new flow

1. Write the YAML under `.maestro/<name>.yaml`. Assert on visible text
   from `locales/de.ts` — see the "selector strategy" note in
   [`.maestro/README.md`](../.maestro/README.md).
2. Verify locally against a running dev build.
3. Update the flow table in [`.maestro/README.md`](../.maestro/README.md).
4. If the flow exercises a code path that has no Jest counterpart today,
   ask whether a Jest test would also work — Jest is cheaper for anything
   that does not need real device state.
