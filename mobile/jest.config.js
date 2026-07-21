module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // @react-native/jest-preset's TestEnvironment sets
  // `customExportConditions = ['require', 'react-native']`. Several
  // packages task 8 pulls into a plain-Node RTK Query test (immer via
  // `@reduxjs/toolkit`, `react-redux`) list a `"react-native"` export
  // condition ahead of `"require"`/`"import"` in their package.json, pointed
  // at an unbundled ESM build meant for Metro (which transpiles import/export
  // itself). Node's exports resolution picks the first matching key in the
  // *package's own* declaration order among the conditions present, so
  // `require(...)` still resolves to that ESM file, and Jest chokes on raw
  // `export {}` syntax (node_modules stays untransformed by default, and
  // these packages aren't in the RN/expo transform allowlist below). Drop
  // `'react-native'` from the condition set so every package resolves
  // through its plain `require`/CJS build instead — the standard fix for
  // this exact RN + Redux Toolkit test combination.
  testEnvironmentOptions: {
    customExportConditions: ['require'],
  },
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
