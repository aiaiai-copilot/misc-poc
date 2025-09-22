import {
  validateEnv,
  validateProductionEnv,
  getEnvConfig,
} from '../env-validator';

describe('Environment Validator', () => {
  const validEnv = {
    NODE_ENV: 'development',
    PORT: '3000',
    HOST: 'localhost',
    POSTGRES_DB: 'test_db',
    POSTGRES_USER: 'test_user',
    POSTGRES_PASSWORD: 'secure_password_123',
    DATABASE_URL:
      'postgresql://test_user:secure_password_123@localhost:5432/test_db',
    DB_POOL_MIN: '2',
    DB_POOL_MAX: '10',
    DB_CONNECTION_TIMEOUT: '30000',
    JWT_SECRET: 'very_long_secure_jwt_secret_key_here_123456789',
    JWT_EXPIRES_IN: '15m',
    JWT_REFRESH_SECRET: 'very_long_secure_refresh_secret_key_here_123456789',
    JWT_REFRESH_EXPIRES_IN: '7d',
  };

  describe('validateEnv', () => {
    test('should validate correct environment variables', () => {
      const result = validateEnv(validEnv);

      expect(result).toEqual({
        NODE_ENV: 'development',
        PORT: 3000,
        HOST: 'localhost',
        POSTGRES_DB: 'test_db',
        POSTGRES_USER: 'test_user',
        POSTGRES_PASSWORD: 'secure_password_123',
        DATABASE_URL:
          'postgresql://test_user:secure_password_123@localhost:5432/test_db',
        DB_POOL_MIN: 2,
        DB_POOL_MAX: 10,
        DB_CONNECTION_TIMEOUT: 30000,
        JWT_SECRET: 'very_long_secure_jwt_secret_key_here_123456789',
        JWT_EXPIRES_IN: '15m',
        JWT_REFRESH_SECRET:
          'very_long_secure_refresh_secret_key_here_123456789',
        JWT_REFRESH_EXPIRES_IN: '7d',
      });
    });

    test('should apply default values for optional variables', () => {
      const minimalEnv = {
        POSTGRES_DB: 'test_db',
        POSTGRES_USER: 'test_user',
        POSTGRES_PASSWORD: 'secure_password_123',
        DATABASE_URL:
          'postgresql://test_user:secure_password_123@localhost:5432/test_db',
        JWT_SECRET: 'very_long_secure_jwt_secret_key_here_123456789',
        JWT_REFRESH_SECRET:
          'very_long_secure_refresh_secret_key_here_123456789',
      };

      const result = validateEnv(minimalEnv);

      expect(result.NODE_ENV).toBe('development');
      expect(result.PORT).toBe(3000);
      expect(result.HOST).toBe('localhost');
      expect(result.DB_POOL_MIN).toBe(2);
      expect(result.DB_POOL_MAX).toBe(10);
      expect(result.DB_CONNECTION_TIMEOUT).toBe(30000);
      expect(result.JWT_EXPIRES_IN).toBe('15m');
      expect(result.JWT_REFRESH_EXPIRES_IN).toBe('7d');
    });

    test('should throw error for missing required variables', () => {
      const invalidEnv: Partial<typeof validEnv> = { ...validEnv };
      delete invalidEnv.POSTGRES_DB;

      expect(() => validateEnv(invalidEnv)).toThrow(
        'Environment validation failed'
      );
      expect(() => validateEnv(invalidEnv)).toThrow('POSTGRES_DB:');
    });

    test('should throw error for invalid PORT', () => {
      const invalidEnv = { ...validEnv, PORT: '0' };

      expect(() => validateEnv(invalidEnv)).toThrow(
        'Environment validation failed'
      );
    });

    test('should throw error for short password', () => {
      const invalidEnv = { ...validEnv, POSTGRES_PASSWORD: 'short' };

      expect(() => validateEnv(invalidEnv)).toThrow(
        'Environment validation failed'
      );
      expect(() => validateEnv(invalidEnv)).toThrow('POSTGRES_PASSWORD:');
    });

    test('should throw error for short JWT secrets', () => {
      const invalidEnv = { ...validEnv, JWT_SECRET: 'short' };

      expect(() => validateEnv(invalidEnv)).toThrow(
        'Environment validation failed'
      );
      expect(() => validateEnv(invalidEnv)).toThrow('JWT_SECRET:');
    });

    test('should throw error for invalid DATABASE_URL', () => {
      const invalidEnv = { ...validEnv, DATABASE_URL: 'invalid-url' };

      expect(() => validateEnv(invalidEnv)).toThrow(
        'Environment validation failed'
      );
      expect(() => validateEnv(invalidEnv)).toThrow('DATABASE_URL:');
    });
  });

  describe('validateProductionEnv', () => {
    test('should pass validation for development environment', () => {
      const config = {
        ...validateEnv(validEnv),
        NODE_ENV: 'development' as const,
      };

      expect(() => validateProductionEnv(config)).not.toThrow();
    });

    test('should require OAuth variables in production', () => {
      const prodEnv = { ...validEnv, NODE_ENV: 'production' };
      const config = validateEnv(prodEnv);

      expect(() => validateProductionEnv(config)).toThrow(
        'Missing required production environment variables'
      );
    });

    test('should pass with OAuth variables in production', () => {
      const prodEnv = {
        ...validEnv,
        NODE_ENV: 'production',
        GOOGLE_CLIENT_ID: 'google_client_id',
        GOOGLE_CLIENT_SECRET: 'google_client_secret',
        GOOGLE_REDIRECT_URI: 'https://example.com/auth/google/callback',
      };
      const config = validateEnv(prodEnv);

      expect(() => validateProductionEnv(config)).not.toThrow();
    });

    test('should reject insecure values in production', () => {
      const prodEnv = {
        ...validEnv,
        NODE_ENV: 'production',
        POSTGRES_PASSWORD: 'your_secure_password_here',
        GOOGLE_CLIENT_ID: 'google_client_id',
        GOOGLE_CLIENT_SECRET: 'google_client_secret',
        GOOGLE_REDIRECT_URI: 'https://example.com/auth/google/callback',
      };
      const config = validateEnv(prodEnv);

      expect(() => validateProductionEnv(config)).toThrow(
        'Insecure default values detected in production'
      );
    });
  });

  describe('getEnvConfig', () => {
    test('should return validated configuration', () => {
      // Mock process.env for this test
      const originalEnv = process.env;
      process.env = { ...validEnv };

      try {
        const config = getEnvConfig();
        expect(config.NODE_ENV).toBe('development');
        expect(config.PORT).toBe(3000);
        expect(config.POSTGRES_DB).toBe('test_db');
      } finally {
        process.env = originalEnv;
      }
    });
  });
});
