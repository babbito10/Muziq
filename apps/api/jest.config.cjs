const preset = require('@musicverse/shared-config/jest');

/**
 * Two projects:
 * - unit: pure tests next to source files (`src/**\/*.spec.ts`), no infrastructure.
 * - integration: HTTP tests against a real PostgreSQL + Redis (`test/**\/*.e2e-spec.ts`).
 *   They use TEST_DATABASE_URL (default: local `musicverse_test`) and reset the schema first.
 */
module.exports = {
  testTimeout: 30000,
  // Integration suites share one database; never run test files in parallel.
  maxWorkers: 1,
  projects: [
    {
      ...preset,
      displayName: 'unit',
      rootDir: __dirname,
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
    },
    {
      ...preset,
      displayName: 'integration',
      rootDir: __dirname,
      testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
      testPathIgnorePatterns: ['/node_modules/', '/dist/'],
      globalSetup: '<rootDir>/test/global-setup.ts',
      setupFiles: ['<rootDir>/test/setup-env.ts'],
    },
  ],
};
