import {
  validateEnv,
  getEnvVar,
  getBooleanEnvVar,
  getNumberEnvVar,
} from '../env.js';

describe('Environment Utilities', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('validateEnv', () => {
    it('should pass when all required variables are present', () => {
      process.env.TEST_VAR1 = 'value1';
      process.env.TEST_VAR2 = 'value2';

      expect(() => validateEnv(['TEST_VAR1', 'TEST_VAR2'])).not.toThrow();
    });

    it('should throw when required variables are missing', () => {
      delete process.env.TEST_VAR1;
      process.env.TEST_VAR2 = 'value2';

      expect(() => validateEnv(['TEST_VAR1', 'TEST_VAR2'])).toThrow(
        'Missing required environment variables'
      );
    });

    it('should throw when required variables are empty strings', () => {
      process.env.TEST_VAR1 = '';
      process.env.TEST_VAR2 = '   '; // whitespace only

      expect(() => validateEnv(['TEST_VAR1', 'TEST_VAR2'])).toThrow(
        'Missing required environment variables'
      );
    });
  });

  describe('getEnvVar', () => {
    it('should return environment variable value', () => {
      process.env.TEST_VAR = 'test-value';
      expect(getEnvVar('TEST_VAR')).toBe('test-value');
    });

    it('should return default value when variable is not set', () => {
      delete process.env.TEST_VAR;
      expect(getEnvVar('TEST_VAR', 'default')).toBe('default');
    });

    it('should trim whitespace from environment variable', () => {
      process.env.TEST_VAR = '  trimmed-value  ';
      expect(getEnvVar('TEST_VAR')).toBe('trimmed-value');
    });

    it('should throw when required variable is missing and no default', () => {
      delete process.env.TEST_VAR;
      expect(() => getEnvVar('TEST_VAR', undefined, true)).toThrow(
        'Required environment variable TEST_VAR is not set'
      );
    });
  });

  describe('getBooleanEnvVar', () => {
    it('should return true for truthy values', () => {
      const truthyValues = ['true', 'TRUE', '1', 'yes', 'YES', 'on', 'ON'];

      truthyValues.forEach((value) => {
        process.env.BOOL_VAR = value;
        expect(getBooleanEnvVar('BOOL_VAR')).toBe(true);
      });
    });

    it('should return false for falsy values', () => {
      const falsyValues = [
        'false',
        'FALSE',
        '0',
        'no',
        'NO',
        'off',
        'OFF',
        'random',
      ];

      falsyValues.forEach((value) => {
        process.env.BOOL_VAR = value;
        expect(getBooleanEnvVar('BOOL_VAR')).toBe(false);
      });
    });

    it('should return default value when variable is not set', () => {
      delete process.env.BOOL_VAR;
      expect(getBooleanEnvVar('BOOL_VAR', true)).toBe(true);
      expect(getBooleanEnvVar('BOOL_VAR', false)).toBe(false);
    });
  });

  describe('getNumberEnvVar', () => {
    it('should return parsed number value', () => {
      process.env.NUM_VAR = '42';
      expect(getNumberEnvVar('NUM_VAR')).toBe(42);
    });

    it('should return default value when variable is not set', () => {
      delete process.env.NUM_VAR;
      expect(getNumberEnvVar('NUM_VAR', 100)).toBe(100);
    });

    it('should return default value for invalid numbers', () => {
      process.env.NUM_VAR = 'not-a-number';
      expect(getNumberEnvVar('NUM_VAR', 50)).toBe(50);
    });

    it('should throw when required variable is invalid number', () => {
      process.env.NUM_VAR = 'invalid';
      expect(() => getNumberEnvVar('NUM_VAR', undefined, true)).toThrow(
        'Environment variable NUM_VAR must be a valid number'
      );
    });

    it('should handle zero as valid number', () => {
      process.env.NUM_VAR = '0';
      expect(getNumberEnvVar('NUM_VAR')).toBe(0);
    });
  });
});
