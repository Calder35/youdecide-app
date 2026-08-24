/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/index.ts', '!src/live/**'],
  // src/live/ holds real round-trips against the deployed backend. They are
  // run on demand, never in CI: a network + model call is neither fast nor
  // deterministic, and a red build caused by someone else's deploy teaches
  // nothing. See src/live/liveChat.test.ts for how to run them.
  testPathIgnorePatterns: ['/node_modules/', '/.expo/', '/src/live/'],
};
