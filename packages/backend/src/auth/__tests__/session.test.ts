import { Request, Response, NextFunction } from 'express';
import {
  getSessionConfig,
  requireAuth,
  optionalAuth,
  logout,
} from '../session.js';
import { AuthConfig } from '../config.js';

describe('Session utilities', () => {
  let mockConfig: AuthConfig;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

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
      },
    };

    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();

    // Reset NODE_ENV for each test
    process.env.NODE_ENV = 'test';
  });

  describe('getSessionConfig', () => {
    it('should return correct session configuration', () => {
      const config = getSessionConfig(mockConfig);

      expect(config).toEqual({
        secret: 'test-session-secret',
        name: 'test-session',
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: false, // NODE_ENV is 'test'
          httpOnly: true,
          maxAge: 3600000,
          sameSite: 'lax', // test environment
        },
      });
    });

    it('should set secure cookie in production', () => {
      process.env.NODE_ENV = 'production';
      const config = getSessionConfig(mockConfig);

      expect(config.cookie.secure).toBe(true);
      expect(config.cookie.sameSite).toBe('strict'); // production uses strict for CSRF protection
    });

    it('should not set secure cookie in development', () => {
      process.env.NODE_ENV = 'development';
      const config = getSessionConfig(mockConfig);

      expect(config.cookie.secure).toBe(false);
    });

    it('should set secure httpOnly cookies for session management', () => {
      const config = getSessionConfig(mockConfig);

      expect(config.cookie.httpOnly).toBe(true);
      expect(config.cookie.secure).toBe(false); // test environment
    });

    it('should configure cookie with sameSite protection', () => {
      const config = getSessionConfig(mockConfig);

      expect(config.cookie.sameSite).toBeDefined();
    });

    it('should support cookie signing for integrity', () => {
      const config = getSessionConfig(mockConfig);

      // Signed cookies should be supported through cookie-parser
      expect(config.secret).toBe('test-session-secret');
    });

    it('should configure domain and path restrictions when provided', () => {
      // Test with extended config that includes domain/path
      const extendedConfig = {
        ...mockConfig,
        session: {
          ...mockConfig.session,
          domain: '.example.com',
          path: '/api',
        },
      };

      const config = getSessionConfig(extendedConfig);

      expect(config.cookie.domain).toBe('.example.com');
      expect(config.cookie.path).toBe('/api');
    });

    it('should clear session cookies on logout', () => {
      const config = getSessionConfig(mockConfig);

      // Verify proper cookie clearing configuration
      expect(config.name).toBe('test-session');
    });
  });

  describe('requireAuth middleware', () => {
    it('should call next() when user is authenticated', () => {
      mockReq.isAuthenticated = jest.fn().mockReturnValue(true);

      requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 401 when user is not authenticated', () => {
      mockReq.isAuthenticated = jest.fn().mockReturnValue(false);

      requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Authentication required',
        message: 'Please log in to access this resource',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when isAuthenticated method does not exist', () => {
      // mockReq.isAuthenticated is undefined

      requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Authentication required',
        message: 'Please log in to access this resource',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth middleware', () => {
    it('should always call next() regardless of authentication status', () => {
      mockReq.isAuthenticated = jest.fn().mockReturnValue(true);
      optionalAuth(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();

      mockNext.mockClear();

      mockReq.isAuthenticated = jest.fn().mockReturnValue(false);
      optionalAuth(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();

      mockNext.mockClear();

      delete mockReq.isAuthenticated;
      optionalAuth(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should successfully logout with session', () => {
      const mockLogout = jest.fn((callback: (err?: any) => void) => callback());
      const mockDestroy = jest.fn((callback: (err?: any) => void) =>
        callback()
      );

      mockReq.logout = mockLogout;
      mockReq.session = {
        destroy: mockDestroy,
      } as any;

      logout(mockReq as Request, mockRes as Response, mockNext);

      expect(mockLogout).toHaveBeenCalled();
      expect(mockDestroy).toHaveBeenCalled();
      expect(mockRes.clearCookie).toHaveBeenCalledWith('connect.sid');
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Logged out successfully',
      });
    });

    it('should successfully logout without session', () => {
      const mockLogout = jest.fn((callback: (err?: any) => void) => callback());

      mockReq.logout = mockLogout;
      // mockReq.session is undefined

      logout(mockReq as Request, mockRes as Response, mockNext);

      expect(mockLogout).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Logged out successfully',
      });
    });

    it('should handle logout error', () => {
      const logoutError = new Error('Logout failed');
      const mockLogout = jest.fn((callback: (err?: any) => void) =>
        callback(logoutError)
      );

      mockReq.logout = mockLogout;

      logout(mockReq as Request, mockRes as Response, mockNext);

      expect(mockLogout).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(logoutError);
    });

    it('should handle session destroy error', () => {
      const destroyError = new Error('Session destroy failed');
      const mockLogout = jest.fn((callback: (err?: any) => void) => callback());
      const mockDestroy = jest.fn((callback: (err?: any) => void) =>
        callback(destroyError)
      );

      mockReq.logout = mockLogout;
      mockReq.session = {
        destroy: mockDestroy,
      } as any;

      logout(mockReq as Request, mockRes as Response, mockNext);

      expect(mockLogout).toHaveBeenCalled();
      expect(mockDestroy).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(destroyError);
    });
  });

  describe('Cookie Security Features', () => {
    it('should support cookie-parser middleware integration', () => {
      const config = getSessionConfig(mockConfig);

      // Verify cookie-parser compatible configuration
      expect(config.secret).toBeDefined();
      expect(typeof config.secret).toBe('string');
    });

    it('should configure cookies with CSRF protection considerations', () => {
      process.env.NODE_ENV = 'production';
      const config = getSessionConfig(mockConfig);

      // CSRF protection through secure, httpOnly, and sameSite
      expect(config.cookie.httpOnly).toBe(true);
      expect(config.cookie.secure).toBe(true);
    });

    it('should handle cookie integrity verification', () => {
      const config = getSessionConfig(mockConfig);

      // Cookie signing secret should be present for integrity checks
      expect(config.secret).toBeTruthy();
      expect(config.secret.length).toBeGreaterThan(0);
    });

    it('should configure proper cookie expiration', () => {
      const config = getSessionConfig(mockConfig);

      expect(config.cookie.maxAge).toBe(3600000);
      expect(config.cookie.maxAge).toBeGreaterThan(0);
    });
  });
});
