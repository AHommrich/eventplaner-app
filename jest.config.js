// Jest configuration for the Expo + React Native codebase.
//
// The `jest-expo` preset ships transformer + moduleFileExtensions + mock
// scaffolding for every Expo module we depend on, which is why we do NOT
// hand-roll a custom transformer here. `transformIgnorePatterns` still needs
// an explicit allow-list of packages Expo ships as ESM — without it Jest
// tries to parse `import` syntax and blows up during test collection.
//
// Coverage in Phase 4 measures ONLY `lib/**` and `constants/**` — the two
// module trees this phase actually covers. Phase 9 adds `app/**` and
// `components/**` to `collectCoverageFrom` once behavioural screen specs land
// and simultaneously tightens the thresholds via a `global` block.
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
    // `QrFromImage.tsx` renders a real WebView + jsQR bridge — meaningfully
    // testing it needs a full harness. Excluded until Phase 9 covers it.
    '!lib/QrFromImage.tsx',
    '!**/*.d.ts',
    '!**/__mocks__/**',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    // Reusable modules must be well-covered — the numbers below reflect
    // Phase 4 reality on the current tree.
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
  },
};
