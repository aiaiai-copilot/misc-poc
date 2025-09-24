/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**/*',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  // coverageThreshold: {
  //   global: {
  //     branches: 95,
  //     functions: 80,
  //     lines: 95,
  //     statements: 95,
  //   },
  // },
  transformIgnorePatterns: [
    'node_modules/(?!@misc-poc)'
  ],
  moduleNameMapper: {
    '^@misc-poc/shared$': '<rootDir>/../shared/src/index.ts'
  }
};