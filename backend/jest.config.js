module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/test/**/*.test.ts'],
  setupFiles: ['<rootDir>/src/test/setup.ts'],
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
};

