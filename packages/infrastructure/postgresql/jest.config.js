export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@misc-poc/shared$': '<rootDir>/../../shared/src/index.ts',
    '^@misc-poc/domain$': '<rootDir>/../../domain/src/index.ts',
    '^@misc-poc/application$': '<rootDir>/../../application/src/index.ts',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
    }],
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.ts',
    '<rootDir>/src/**/*.test.ts'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/__tests__/**',
    '!src/**/*.test.ts'
  ],
  // coverageThreshold: {
  //   global: {
  //     branches: 90,
  //     functions: 90,
  //     lines: 90,
  //     statements: 90
  //   }
  // },
  // Integration tests with containers need more time
  // Performance tests need even more time for large datasets
  testTimeout: 120000
};