const preset = require('@musicverse/shared-config/jest');

module.exports = {
  ...preset,
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/e2e/'],
};
