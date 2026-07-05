// Jest configuration for the Expo + React Native codebase.
//
// The `jest-expo` preset ships transformer + moduleFileExtensions + mock
// scaffolding for every Expo module we depend on, which is why we do NOT
// hand-roll a custom transformer here. `transformIgnorePatterns` still needs
// an explicit allow-list of packages Expo ships as ESM — without it Jest
// tries to parse `import` syntax and blows up during test collection.
//
// Coverage started as `lib/**` + `constants/**` in Phase 4. Phase 9 adds
// `app/**` + `components/**` alongside the screen-behaviour specs and
// enforces a per-directory threshold. The app/** floor sits below the
// plan's 80 % target because a handful of flows are structurally hard to
// reach from a unit test (image-picker + multipart upload on `photos.tsx`
// and `photo-game.tsx`, the family-picker second step on `index.tsx`).
// Those hit `docs/REFACTOR_PLAN.md` Follow-ups; the threshold below stops
// regressions below today's coverage without demanding untestable paths.
module.exports = {
  preset: 'jest-expo',
  // RNTL v13+ ships its extended matchers automatically once
  // `@testing-library/react-native` is imported anywhere in the suite, so we
  // do not wire `@testing-library/jest-native/extend-expect` separately.
  setupFiles: ['./tests/setup.ts'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|nativewind))',
  ],
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/tests/__mocks__/fileMock.js',
  },
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'constants/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    // `QrFromImage.tsx` renders a real WebView + jsQR bridge — meaningful
    // coverage needs an actual WebView harness rather than a unit stub.
    '!lib/QrFromImage.tsx',
    // Vendored jsQR source (auto-generated from node_modules/jsqr). Sync
    // is checked separately by tests/vendor/jsqr-source-sync.test.ts.
    '!lib/vendor/**',
    // Route layouts wire providers together and mount routes; behaviour is
    // observed indirectly through every screen test that renders under
    // them, so per-line coverage on the layouts themselves would just
    // measure JSX plumbing.
    '!app/_layout.tsx',
    '!app/(tabs)/_layout.tsx',
    '!**/*.d.ts',
    '!**/__mocks__/**',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    // Reusable modules — the tight numbers already in place from Phase 4.
    'lib/': {
      lines: 90,
      branches: 90,
      functions: 80,
      statements: 90,
    },
    'constants/': {
      lines: 100,
      branches: 100,
      functions: 100,
      statements: 100,
    },
    // Screens — a floor set at today's coverage so a future regression
    // fails CI. The plan's 80 % target is deliberately NOT pursued: the
    // uncovered lines cluster in image-picker + multipart-upload flows
    // (`app/index.tsx` gallery-QR fallback, `photos.tsx` / `photo-game.tsx`
    // uploads) that would need a real WebView + FormData harness rather
    // than a unit stub. Doing that badly buys percentage points and no
    // confidence. See `docs/REFACTOR_PLAN.md → Follow-ups`.
    'app/': {
      lines: 61,
      branches: 48,
      functions: 56,
      statements: 55,
    },
    // Components — the two shared components (`ThemedText`,
    // `RefreshToast`) plus `ConsentGate` are all directly covered.
    // Branch coverage on `ThemedText` sits low because the font-fallback
    // matrix is exercised through screen tests, not directly.
    'components/': {
      lines: 70,
      branches: 40,
      functions: 70,
      statements: 70,
    },
  },
};
