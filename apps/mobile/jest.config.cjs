// Pure-logic tests (token storage, helpers) run in Node with ts-jest. Screen-level tests with
// jest-expo + React Native Testing Library are planned with the Phase 2 player work.
module.exports = {
  ...require('@musicverse/shared-config/jest'),
  roots: ['<rootDir>/src'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
};
