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
        },
      });
    });

    it('should set secure cookie in production', () => {
      process.env.NODE_ENV = 'production';
      const config = getSessionConfig(mockConfig);

      expect(config.cookie.secure).toBe(true);
    });

    it('should not set secure cookie in development', () => {
      process.env.NODE_ENV = 'development';
      const config = getSessionConfig(mockConfig);

      expect(config.cookie.secure).toBe(false);
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
});
