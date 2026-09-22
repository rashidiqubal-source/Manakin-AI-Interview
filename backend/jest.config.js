module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/test/**/*.test.ts'],
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
};
