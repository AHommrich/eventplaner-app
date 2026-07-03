// Jest configuration for the Expo + React Native codebase.
//
// The `jest-expo` preset ships transformer + moduleFileExtensions + mock
// scaffolding for every Expo module we depend on, which is why we do NOT
// hand-roll a custom transformer here. `transformIgnorePatterns` still needs
// an explicit allow-list of packages Expo ships as ESM — without it Jest
// tries to parse `import` syntax and blows up during test collection.
//
// Coverage: Phase 3 sets floors on `lib/**` and `constants/**` because those
// modules are pure logic and land in Phase 4. The overall floor stays low so
// screens aren't required to have specs until Phase 9 tightens the numbers.
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
    '!**/*.d.ts',
    '!**/__mocks__/**',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    // Overall floor stays modest — Phase 9 tightens it to 75 %.
    global: {
      lines: 50,
      branches: 50,
      functions: 50,
      statements: 50,
    },
    // Reusable modules must be well-covered from Phase 4 onwards.
    'lib/': {
      lines: 80,
      branches: 80,
      functions: 80,
      statements: 80,
    },
    'constants/': {
      lines: 80,
      branches: 80,
      functions: 80,
      statements: 80,
    },
  },
};
