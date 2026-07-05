# Layered testing strategy

**One-liner:** Three layers with sharply different jobs. Coverage
numbers are a floor to trip regressions, not a target to game.

## The constraint

A wedding-guest app has three properties that shape what testing
actually pays off:

1. **Wide but not deep.** Ten screens, none complicated on their own.
   Bugs come from screen-to-screen state (a session revoked in Settings
   still visible on Photos) far more often than from a single
   algorithmic mistake.
2. **Runs on real phones for one weekend.** A bug that manifests on
   iOS but not the Expo Go simulator ships to guests before it can be
   caught in dev.
3. **DSGVO exposure.** A regression that reintroduces a tracking SDK,
   a CDN dependency, or a leaked storage key is not "a bug to fix
   later" — it's a compliance incident. It has to be catchable in CI.

Those three constraints don't fit any single test tier. Hence three.

## The three layers

```
┌───────────────────────────────────────────────────────────────┐
│  Layer                    Runs on           Feedback in       │
├───────────────────────────────────────────────────────────────┤
│  Unit  (Jest, lib/**)     Node JSDOM        < 1 second        │
│  Screen (Jest, app/**)    Node JSDOM        1–2 seconds       │
│  E2E   (Maestro)          Simulator/device  ~30 s per flow    │
└───────────────────────────────────────────────────────────────┘
```

### Unit — `lib/**` + `constants/**`

Pure modules. SecureStore stubbed via
[`tests/setup.ts`](../../tests/setup.ts), axios mocked per suite,
no rendering. The point is to prove that the "backend of the client"
(session persistence, auth flow, consent state, erasure state, i18n,
theme resolution) is *correct in isolation*.

Threshold: **≥ 90 % lines + branches**. Enforced in
[`jest.config.js`](../../jest.config.js). The number is intentionally
high — these modules have no UI complexity and no untestable paths.
Below 90 % means either an untested branch or a genuinely dead one, and
either deserves a look.

Coverage-of-record right now: 97 % lines / 97 % branches.

### Screen — `app/**` + `components/**`

Render each screen through `@testing-library/react-native`. Mock axios
and expo-router, but leave the JSX + `useEffect` graph intact. The
suite catches regressions in *what the screen does*: button dispatch,
navigation calls, state transitions, RSVP decline confirmations,
family-picker 409 handling.

Threshold: **60 % lines / 45 % branches on `app/**`**. That number is
lower than the plan's 80 % target on purpose. Two classes of paths are
structurally unreachable from a unit harness:

- **Image picker + multipart upload** on
  [`app/(tabs)/photos.tsx`](../../app/(tabs)/photos.tsx) and
  [`app/(tabs)/photo-game.tsx`](../../app/(tabs)/photo-game.tsx). Jest
  cannot spin up a real file system; a stubbed picker would prove the
  handler wiring but not the multipart body.
- **Family two-step picker** on the login flow. The 409 case IS covered
  by the screen tests, but the successful select is easier to exercise
  end-to-end (see below).

Rather than fake those flows badly, the threshold is set honestly and
they are pushed to the E2E layer. The gap is called out in
[`jest.config.js`](../../jest.config.js) and in
[`docs/REFACTOR_PLAN.md → Follow-ups`](../REFACTOR_PLAN.md) — raising
the floor to 80 % is future work, not a target being sandbagged.

### E2E — `.maestro/`

[Maestro](https://maestro.mobile.dev) drives a real (or simulated)
device from YAML. Only golden paths: cold-start login and logout. Two
flows in [`.maestro/solo-login.yaml`](../../.maestro/solo-login.yaml)
and [`.maestro/logout.yaml`](../../.maestro/logout.yaml) chain into the
happy-path smoke.

**Why not Detox?** Detox needs a special `RN_SRC_EXT`-flagged build,
which conflicts with the Expo Go workflow this project is committed to
supporting (see [`CLAUDE.md`](../../CLAUDE.md)). Maestro drives the
app through UI automation only — same binary as the developer runs
locally, no build variant.

**Why the flows are small.** Every Maestro flow is a smoke test, not a
unit test. Duplicating what Jest already covers would just make CI
slower and flakier. See [`docs/e2e.md`](../e2e.md) for the full list of
what is and isn't covered end-to-end and why.

## Regression tests as a separate category

Two files in [`tests/regressions/`](../../tests/regressions/) and
[`tests/vendor/`](../../tests/vendor/) don't test *behaviour* — they
test **invariants**:

- **no-tracking** — fails CI if
  - A known analytics / crash-reporting package name lands in
    `package.json`.
  - A source file imports a matching module.
  - A source file contains a public-CDN hostname
    (`cdn.jsdelivr.net`, `unpkg.com`, `fonts.googleapis.com`,
    `fonts.gstatic.com`, `cdnjs.cloudflare.com`).
- **jsqr-source-sync** — fails CI if the vendored jsQR copy in
  [`lib/vendor/`](../../lib/vendor/) drifts from the version installed
  in `node_modules/jsqr`. This is what prevents a "silently outdated
  decoder" after a `npm install jsqr@latest` without a matching
  `node scripts/vendor-jsqr.mjs` run.

Both are cheap to run and permanently on. A false positive here means
the invariant was intentionally changed and the test needs an update in
the same PR — never in a follow-up.

## What the thresholds mean

The coverage numbers in [`jest.config.js`](../../jest.config.js) are a
**floor to catch regressions**, not a target to aspire to. The
distinction matters:

- Setting a target you don't yet hit lets today's flakiness sneak in;
  the number goes red for reasons unrelated to the PR that turned it
  red.
- Setting a floor at *today's* achievable coverage lets a PR add code
  freely as long as it doesn't drag the average down. Explicitly
  raising the floor is a separate PR with its own justification.

That's why the app-level floor sits at 60/45 and the plan's 80 %
target is documented as a follow-up. The follow-up is real work —
covering the image-picker + multipart flows with a proper harness —
not a matter of setting a bigger number.

## What lives in Jest and what lives in Maestro

Every rule below is a heuristic; the actual choice is a judgment call.

| If the test needs… | It belongs in… |
|---|---|
| A network response fixture | Jest (Unit or Screen) |
| Real navigation between routes | Screen test if `router.push` is enough; Maestro if state carries across tabs |
| A real filesystem, camera, or biometric prompt | Maestro |
| A pure algorithm (sorting, date math) | Unit |
| A "does the screen show the right label" check | Screen test |
| A "does the app boot on iOS the same way as Android" check | Maestro (add the flow deliberately, don't add for coverage) |
| An invariant about the source tree (no tracking, no CDN, no stale vendor) | Regression |

## Where to read next

- The full "what is / isn't tested" table in
  [`docs/e2e.md`](../e2e.md).
- Coverage thresholds + rationale in
  [`jest.config.js`](../../jest.config.js).
- The test setup in
  [`tests/setup.ts`](../../tests/setup.ts) (jest-expo mocks explained).
