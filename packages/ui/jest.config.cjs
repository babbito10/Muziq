const preset = require('@musicverse/shared-config/jest');

module.exports = {
  ...preset,
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};
