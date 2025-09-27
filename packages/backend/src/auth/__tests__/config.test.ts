import { loadAuthConfig, AuthConfig } from '../config.js';

describe('Auth Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('loadAuthConfig', () => {
    beforeEach(() => {
      // Set up valid environment variables and clear optional ones
      process.env.JWT_SECRET = 'test-jwt-secret';
      process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
      process.env.SESSION_SECRET = 'test-session-secret';

      // Clear optional environment variables to test defaults
      delete process.env.JWT_EXPIRES_IN;
      delete process.env.JWT_ISSUER;
      delete process.env.GOOGLE_CALLBACK_URL;
      delete process.env.SESSION_NAME;
      delete process.env.SESSION_MAX_AGE;
      delete process.env.SESSION_DOMAIN;
      delete process.env.SESSION_PATH;
    });

    it('should load configuration from environment variables', () => {
      const config = loadAuthConfig();

      expect(config).toEqual({
        jwt: {
          secret: 'test-jwt-secret',
          expiresIn: '24h',
          issuer: 'misc-poc-backend',
        },
        google: {
          clientId: 'test-google-client-id',
          clientSecret: 'test-google-client-secret',
          callbackUrl: '/auth/google/callback',
        },
        session: {
          secret: 'test-session-secret',
          name: 'misc-poc-session',
          maxAge: 86400000,
          domain: '',
          path: '',
        },
      });
    });

    it('should use custom values when provided', () => {
      process.env.JWT_EXPIRES_IN = '12h';
      process.env.JWT_ISSUER = 'custom-issuer';
      process.env.GOOGLE_CALLBACK_URL = '/custom/callback';
      process.env.SESSION_NAME = 'custom-session';
      process.env.SESSION_MAX_AGE = '3600000';
      process.env.SESSION_DOMAIN = '.example.com';
      process.env.SESSION_PATH = '/api';

      const config = loadAuthConfig();

      expect(config.jwt.expiresIn).toBe('12h');
      expect(config.jwt.issuer).toBe('custom-issuer');
      expect(config.google.callbackUrl).toBe('/custom/callback');
      expect(config.session.name).toBe('custom-session');
      expect(config.session.maxAge).toBe(3600000);
      expect(config.session.domain).toBe('.example.com');
      expect(config.session.path).toBe('/api');
    });

    it('should throw error when JWT_SECRET is missing', () => {
      delete process.env.JWT_SECRET;

      expect(() => loadAuthConfig()).toThrow(
        'Missing required environment variables'
      );
    });

    it('should throw error when GOOGLE_CLIENT_ID is missing', () => {
      delete process.env.GOOGLE_CLIENT_ID;

      expect(() => loadAuthConfig()).toThrow(
        'Missing required environment variables'
      );
    });

    it('should throw error when GOOGLE_CLIENT_SECRET is missing', () => {
      delete process.env.GOOGLE_CLIENT_SECRET;

      expect(() => loadAuthConfig()).toThrow(
        'Missing required environment variables'
      );
    });

    it('should throw error when SESSION_SECRET is missing', () => {
      delete process.env.SESSION_SECRET;

      expect(() => loadAuthConfig()).toThrow(
        'Missing required environment variables'
      );
    });

    it('should throw error when multiple required variables are missing', () => {
      delete process.env.JWT_SECRET;
      delete process.env.GOOGLE_CLIENT_ID;

      expect(() => loadAuthConfig()).toThrow(
        'Missing required environment variables'
      );
    });

    it('should handle whitespace in environment variables', () => {
      process.env.JWT_SECRET = '  test-jwt-secret  ';
      process.env.GOOGLE_CLIENT_ID = '  test-google-client-id  ';

      const config = loadAuthConfig();

      expect(config.jwt.secret).toBe('test-jwt-secret');
      expect(config.google.clientId).toBe('test-google-client-id');
    });

    it('should handle invalid SESSION_MAX_AGE gracefully', () => {
      process.env.SESSION_MAX_AGE = 'invalid-number';

      const config = loadAuthConfig();
      // Should use default value when parsing fails
      expect(config.session.maxAge).toBe(86400000);
    });
  });
});
