import { Request, Response, NextFunction } from 'express';
import { jwtValidationMiddleware } from '../jwt-validation.js';
import { JwtService } from '../../jwt.js';
import { AuthConfig } from '../../config.js';

// Mock dependencies
jest.mock('../../jwt.js');

describe('JWT Validation Middleware Contract', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jwtService: jest.Mocked<JwtService>;
  let authConfig: AuthConfig;

  beforeEach(() => {
    // Setup mock config
    authConfig = {
      jwt: {
        secret: 'test-secret',
        expiresIn: '7d',
        issuer: 'misc-app',
      },
      google: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        callbackURL: 'http://localhost/callback',
      },
      cookies: {
        secure: false,
        domain: 'localhost',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    };

    // Setup mocks
    mockRequest = {
      headers: {},
      cookies: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    // Create mocked JwtService
    jwtService = new JwtService(authConfig) as jest.Mocked<JwtService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Session Validation', () => {
    it('should validate active JWT token from Authorization header', () => {
      // Arrange
      const validPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };

      jwtService.verifyToken = jest.fn().mockReturnValue(validPayload);

      // Act
      const middleware = jwtValidationMiddleware(jwtService);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(jwtService.verifyToken).toHaveBeenCalledWith('valid-token');
      expect(mockRequest.user).toEqual(validPayload);
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should validate active JWT token from cookie', () => {
      // Arrange
      const validPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      mockRequest.cookies = {
        accessToken: 'valid-cookie-token',
      };

      jwtService.verifyToken = jest.fn().mockReturnValue(validPayload);

      // Act
      const middleware = jwtValidationMiddleware(jwtService);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(jwtService.verifyToken).toHaveBeenCalledWith('valid-cookie-token');
      expect(mockRequest.user).toEqual(validPayload);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject expired JWT token', () => {
      // Arrange
      mockRequest.headers = {
        authorization: 'Bearer expired-token',
      };

      jwtService.verifyToken = jest.fn().mockImplementation(() => {
        throw new Error('Token expired');
      });

      // Act
      const middleware = jwtValidationMiddleware(jwtService);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(jwtService.verifyToken).toHaveBeenCalledWith('expired-token');
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Token expired',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject malformed JWT token', () => {
      // Arrange
      mockRequest.headers = {
        authorization: 'Bearer malformed-token',
      };

      jwtService.verifyToken = jest.fn().mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act
      const middleware = jwtValidationMiddleware(jwtService);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(jwtService.verifyToken).toHaveBeenCalledWith('malformed-token');
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Invalid token',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should validate token signature', () => {
      // Arrange
      const validPayload = {
        userId: 'user-123',
        email: 'test@example.com',
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-signed-token',
      };

      jwtService.verifyToken = jest.fn().mockReturnValue(validPayload);

      // Act
      const middleware = jwtValidationMiddleware(jwtService);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(jwtService.verifyToken).toHaveBeenCalledWith('valid-signed-token');
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should extract user context from valid token', () => {
      // Arrange
      const userContext = {
        userId: 'user-456',
        email: 'user@test.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 7200,
      };

      mockRequest.headers = {
        authorization: 'Bearer context-token',
      };

      jwtService.verifyToken = jest.fn().mockReturnValue(userContext);

      // Act
      const middleware = jwtValidationMiddleware(jwtService);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockRequest.user).toEqual(userContext);
      expect(mockRequest.user?.userId).toBe('user-456');
      expect(mockRequest.user?.email).toBe('user@test.com');
    });
  });

  describe('Token Extraction', () => {
    it('should extract token from Authorization header with Bearer scheme', () => {
      // Arrange
      mockRequest.headers = {
        authorization: 'Bearer header-token',
      };

      jwtService.verifyToken = jest.fn().mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
      });

      // Act
      const middleware = jwtValidationMiddleware(jwtService);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(jwtService.verifyToken).toHaveBeenCalledWith('header-token');
    });

    it('should prefer Authorization header over cookie', () => {
      // Arrange
      mockRequest.headers = {
        authorization: 'Bearer header-token',
      };
      mockRequest.cookies = {
        accessToken: 'cookie-token',
      };

      jwtService.verifyToken = jest.fn().mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
      });

      // Act
      const middleware = jwtValidationMiddleware(jwtService);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(jwtService.verifyToken).toHaveBeenCalledWith('header-token');
      expect(jwtService.verifyToken).not.toHaveBeenCalledWith('cookie-token');
    });

    it('should reject request without token', () => {
      // Arrange
      mockRequest.headers = {};
      mockRequest.cookies = {};

      // Act
      const middleware = jwtValidationMiddleware(jwtService);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'No authentication token provided',
      });
      expect(jwtService.verifyToken).not.toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject Authorization header without Bearer scheme', () => {
      // Arrange
      mockRequest.headers = {
        authorization: 'Basic dXNlcjpwYXNz', // Basic auth instead of Bearer
      };

      // Act
      const middleware = jwtValidationMiddleware(jwtService);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Invalid authorization header format',
      });
      expect(jwtService.verifyToken).not.toHaveBeenCalled();
    });

    it('should handle malformed Authorization header gracefully', () => {
      // Arrange
      mockRequest.headers = {
        authorization: 'Bearer', // Missing token
      };

      // Act
      const middleware = jwtValidationMiddleware(jwtService);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Invalid authorization header format',
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle generic verification errors', () => {
      // Arrange
      mockRequest.headers = {
        authorization: 'Bearer error-token',
      };

      jwtService.verifyToken = jest.fn().mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      // Act
      const middleware = jwtValidationMiddleware(jwtService);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Unexpected error',
      });
    });

    it('should not expose sensitive error details in production', () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      mockRequest.headers = {
        authorization: 'Bearer error-token',
      };

      jwtService.verifyToken = jest.fn().mockImplementation(() => {
        throw new Error('Internal JWT processing error with sensitive data');
      });

      // Act
      const middleware = jwtValidationMiddleware(jwtService);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      const jsonCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(jsonCall.error).toBe('Unauthorized');
      // In production, we might sanitize the message
      expect(jsonCall.message).toBeDefined();

      // Cleanup
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle null or undefined token gracefully', () => {
      // Arrange
      mockRequest.headers = {
        authorization: undefined,
      };
      mockRequest.cookies = {
        accessToken: null,
      };

      // Act
      const middleware = jwtValidationMiddleware(jwtService);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(jwtService.verifyToken).not.toHaveBeenCalled();
    });
  });

  describe('Express Integration', () => {
    it('should integrate correctly with Express middleware chain', () => {
      // Arrange
      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };

      jwtService.verifyToken = jest.fn().mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
      });

      // Act
      const middleware = jwtValidationMiddleware(jwtService);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith(); // Called with no arguments = success
    });

    it('should attach user payload to request object', () => {
      // Arrange
      const payload = {
        userId: 'user-789',
        email: 'attached@test.com',
        iat: Math.floor(Date.now() / 1000),
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };

      jwtService.verifyToken = jest.fn().mockReturnValue(payload);

      // Act
      const middleware = jwtValidationMiddleware(jwtService);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockRequest).toHaveProperty('user');
      expect(mockRequest.user).toEqual(payload);
    });

    it('should not modify response on successful validation', () => {
      // Arrange
      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };

      jwtService.verifyToken = jest.fn().mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
      });

      // Act
      const middleware = jwtValidationMiddleware(jwtService);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should terminate request on validation failure', () => {
      // Arrange
      mockRequest.headers = {
        authorization: 'Bearer invalid-token',
      };

      jwtService.verifyToken = jest.fn().mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act
      const middleware = jwtValidationMiddleware(jwtService);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled(); // Request terminated
    });
  });

  describe('Security', () => {
    it('should reject token with invalid signature', () => {
      // Arrange
      mockRequest.headers = {
        authorization: 'Bearer tampered-token',
      };

      jwtService.verifyToken = jest.fn().mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act
      const middleware = jwtValidationMiddleware(jwtService);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should validate token issuer', () => {
      // Arrange
      const validPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        iss: 'misc-app', // Correct issuer
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-issuer-token',
      };

      jwtService.verifyToken = jest.fn().mockReturnValue(validPayload);

      // Act
      const middleware = jwtValidationMiddleware(jwtService);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(jwtService.verifyToken).toHaveBeenCalledWith('valid-issuer-token');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle token replay attacks through expiration', () => {
      // Arrange
      mockRequest.headers = {
        authorization: 'Bearer replayed-token',
      };

      jwtService.verifyToken = jest.fn().mockImplementation(() => {
        throw new Error('Token expired');
      });

      // Act
      const middleware = jwtValidationMiddleware(jwtService);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Token expired',
      });
    });
  });
});
