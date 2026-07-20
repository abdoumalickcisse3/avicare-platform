module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Jest's default testMatch treats every file under a __tests__ directory
  // as a suite. sync/__tests__/fakeDriver.ts is a shared test helper (a
  // better-sqlite3-backed SqlDriver), not a suite itself, so it needs to be
  // excluded — narrow the match to files that actually declare tests.
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  // NOTE: the brief's pattern only exempted the literal `expo/` package from
  // being ignored, not any `expo-*` package (expo-modules-core, expo-sqlite,
  // expo-secure-store, ...). jest-expo's own setup script imports
  // expo-modules-core directly, so without the `[\\w-]*` suffix below Jest
  // never transforms it and fails on its raw TS/ESM source. Broadened to
  // match jest-expo's own default transformIgnorePatterns.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?[\\w-]*|@expo(nent)?[\\w-]*/.*|expo-router|react-navigation|@react-navigation/.*)/)',
  ],
};
