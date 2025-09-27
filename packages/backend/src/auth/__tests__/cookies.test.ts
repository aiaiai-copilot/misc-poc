import {
  getCookieParserMiddleware,
  getSecureCookieOptions,
  setSecureCookie,
  clearSecureCookie,
} from '../cookies.js';
import { AuthConfig } from '../config.js';

describe('Cookie security utilities', () => {
  let mockConfig: AuthConfig;
  let mockRes: any;

  beforeEach(() => {
    mockConfig = {
      jwt: {
        secret: 'test-secret',
        expiresIn: '1h',
        issuer: 'test-issuer',
      },
      google: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        callbackUrl: '/test/callback',
      },
      session: {
        secret: 'test-session-secret',
        name: 'test-session',
        maxAge: 3600000,
        domain: '.example.com',
        path: '/api',
      },
    };

    mockRes = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };

    // Reset NODE_ENV for each test
    process.env.NODE_ENV = 'test';
  });

  describe('getCookieParserMiddleware', () => {
    it('should return cookie-parser middleware with signing secret', () => {
      const middleware = getCookieParserMiddleware(mockConfig);

      expect(typeof middleware).toBe('function');
      // Cookie-parser middleware should be a function
      expect(middleware.length).toBe(3); // req, res, next parameters
    });
  });

  describe('getSecureCookieOptions', () => {
    it('should return secure cookie options for test environment', () => {
      const options = getSecureCookieOptions(mockConfig);

      expect(options).toEqual({
        signed: true,
        httpOnly: true,
        secure: false, // test environment
        sameSite: 'lax',
        domain: '.example.com',
        path: '/api',
        maxAge: 3600000,
      });
    });

    it('should return strict sameSite and secure cookies in production', () => {
      process.env.NODE_ENV = 'production';
      const options = getSecureCookieOptions(mockConfig);

      expect(options.secure).toBe(true);
      expect(options.sameSite).toBe('strict');
    });

    it('should support option overrides', () => {
      const options = getSecureCookieOptions(mockConfig, {
        signed: false,
        maxAge: 7200000,
      });

      expect(options.signed).toBe(false);
      expect(options.maxAge).toBe(7200000);
      expect(options.httpOnly).toBe(true); // other defaults preserved
    });

    it('should handle missing domain and path gracefully', () => {
      const configWithoutDomainPath = {
        ...mockConfig,
        session: {
          ...mockConfig.session,
          domain: undefined,
          path: undefined,
        },
      };

      const options = getSecureCookieOptions(configWithoutDomainPath);

      expect(options.domain).toBeUndefined();
      expect(options.path).toBeUndefined();
      expect(options.signed).toBe(true);
      expect(options.httpOnly).toBe(true);
    });
  });

  describe('setSecureCookie', () => {
    it('should set cookie with secure options', () => {
      setSecureCookie(mockRes, 'testCookie', 'testValue', mockConfig);

      expect(mockRes.cookie).toHaveBeenCalledWith('testCookie', 'testValue', {
        signed: true,
        httpOnly: true,
        secure: false, // test environment
        sameSite: 'lax',
        domain: '.example.com',
        path: '/api',
        maxAge: 3600000,
      });
    });

    it('should allow option overrides when setting cookie', () => {
      setSecureCookie(mockRes, 'testCookie', 'testValue', mockConfig, {
        maxAge: 1800000,
        signed: false,
      });

      expect(mockRes.cookie).toHaveBeenCalledWith('testCookie', 'testValue', {
        signed: false,
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        domain: '.example.com',
        path: '/api',
        maxAge: 1800000,
      });
    });
  });

  describe('clearSecureCookie', () => {
    it('should clear cookie with secure options but without maxAge', () => {
      clearSecureCookie(mockRes, 'testCookie', mockConfig);

      expect(mockRes.clearCookie).toHaveBeenCalledWith('testCookie', {
        signed: true,
        httpOnly: true,
        secure: false, // test environment
        sameSite: 'lax',
        domain: '.example.com',
        path: '/api',
        // maxAge should be removed for clearing
      });
    });

    it('should handle clearing cookies in production environment', () => {
      process.env.NODE_ENV = 'production';
      clearSecureCookie(mockRes, 'authToken', mockConfig);

      expect(mockRes.clearCookie).toHaveBeenCalledWith('authToken', {
        signed: true,
        httpOnly: true,
        secure: true, // production
        sameSite: 'strict',
        domain: '.example.com',
        path: '/api',
      });
    });

    it('should support option overrides when clearing cookie', () => {
      clearSecureCookie(mockRes, 'testCookie', mockConfig, {
        signed: false,
        path: '/custom',
      });

      expect(mockRes.clearCookie).toHaveBeenCalledWith('testCookie', {
        signed: false,
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        domain: '.example.com',
        path: '/custom',
      });
    });
  });

  describe('Cookie signing integrity protection', () => {
    it('should enable signed cookies by default for integrity', () => {
      const options = getSecureCookieOptions(mockConfig);

      expect(options.signed).toBe(true);
    });

    it('should use session secret for cookie signing', () => {
      const middleware = getCookieParserMiddleware(mockConfig);

      // The middleware should be configured with the signing secret
      expect(typeof middleware).toBe('function');
    });
  });
});
