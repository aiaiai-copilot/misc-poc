/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/__tests__/**'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@misc-poc/shared$': '<rootDir>/../shared/src/index.ts',
    '^@misc-poc/domain$': '<rootDir>/../domain/src/index.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!@misc-poc)'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true }],
  },
};