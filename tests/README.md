# Tests

This test suite covers **failure modes that would actually reach a guest
phone**, not a coverage percentage. The bar is: any regression that ships to
a real device should have a chance of failing here first.

## Layout

```
tests/
  setup.ts         Global jest setup — see the file header for every mock
  __mocks__/       Non-JS asset stubs (images, fonts) resolved via moduleNameMapper
  <module>.test.ts     Unit tests, one file per module under lib/ or constants/
  <screen>.test.tsx    Screen-level behaviour specs (Phase 9)
  regressions/     Repo-wide invariants (e.g. "no tracking dep") — Phase 8
```

## What IS tested

- **`lib/*`** — bearer interceptor, session persistence, i18n resolution,
  theme resolution, block-features polling, refresh-toast timing, QR flow.
  Everything that the tabs call more than once.
- **`constants/*`** — palette snapshot, font-key mapping.
- **Screens** (Phase 9) — one happy path + one likely failure per tab.
- **No-tracking regression** (Phase 8) — grep-asserts that no analytics /
  crash-reporting / third-party SDK creeps in.

## What is NOT tested

- Native module internals (`expo-camera`, `expo-image-picker`, ...). Mocks
  in `setup.ts` substitute the interface only.
- Metro bundler behaviour, EAS build output, deep-link resolution.
- Real backend calls — every `api.*` invocation goes through the axios mock
  the test explicitly wires up.
- Visual snapshot testing. It rots faster than the value it provides on a
  small app with dynamic theme colours.

## Running

```bash
nvm use
npm install --legacy-peer-deps  # only if you haven't already
npm test                         # single run
npm run test:watch               # watch mode during development
npm run test:coverage            # coverage report + threshold enforcement
```

Both `test` and `test:coverage` pass `--runInBand` so Jest runs the suite in
one process. The parallel worker pool holds on to a native handle from the
Reanimated / Gesture-Handler bridging chain that `--detectOpenHandles`
cannot surface; single-process execution sidesteps it and keeps the CI log
clean. The added wall clock is ~3 s (2 s → 5 s) for the current 152 tests —
a fair trade for a zero-warning run.

## Coverage thresholds

Enforced by `jest.config.js` and by the CI `test.yml` workflow:

| Path           | Lines | Branches | Notes                              |
| -------------- | ----- | -------- | ---------------------------------- |
| Overall        | 50 %  | 50 %     | Tightens to 75 % in Phase 9.       |
| `lib/**`       | 80 %  | 80 %     | Reusable modules — non-negotiable. |
| `constants/**` | 80 %  | 80 %     | Pure lookups.                      |

## Adding a new test

- File name matches the module or screen (`lib/auth.ts` → `lib/auth.test.ts`
  next to it in `tests/` mirrored path).
- `describe('<Path or symbol>')` outer, `it('<behavioural sentence>')` inner.
- Prefer `jest.useFakeTimers()` over real sleeps for anything that involves
  intervals or setTimeout.
- If a mock in `setup.ts` needs a per-test override, use
  `jest.spyOn(module, 'fn').mockResolvedValueOnce(...)` inside the test —
  never mutate the global mock's `mockReturnValue` from a suite because it
  bleeds across tests.
