/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@misc-poc/shared$': '<rootDir>/../../shared/src',
    '^@misc-poc/domain$': '<rootDir>/../../domain/src',
  },
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**/*',
    '!src/index.ts' // Re-export file
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  // coverageThreshold: {
  //   global: {
  //     branches: 80,
  //     functions: 80,
  //     lines: 80,
  //     statements: 80,
  //   },
  //   // Specific thresholds for repository files that are actually tested
  //   'src/localstorage-*-repository.ts': {
  //     branches: 70,
  //     functions: 95,
  //     lines: 85,
  //     statements: 85,
  //   },
  // },
};