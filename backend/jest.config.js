module.exports = {
  testEnvironment: 'node',
  globalSetup: '<rootDir>/tests/globalSetup.js',
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  maxWorkers: 1, // shared SQLite file - avoid concurrent-write lock errors
  testTimeout: 15000,
};
