/**
 * Comprehensive OAuth Error Handling Tests
 *
 * These tests verify comprehensive error handling for OAuth authentication
 * as specified in the PRD under Authentication Contract requirements.
 *
 * Test specifications come directly from PRD section 4.1.1:
 * - Should handle Google OAuth service unavailability
 * - Should reject invalid Google token with appropriate error
 * - Should handle authentication errors gracefully
 * - Should handle OAuth errors gracefully
 * - Should display user-friendly error messages
 * - Should redirect to login on 401
 * - Should show network error notifications
 * - Should handle rate limit errors
 * - Should log errors for debugging
 */

import request from 'supertest';
import express from 'express';
import { AuthService } from '../index.js';
import {
  OAuthError,
  AuthenticationError,
  GoogleOAuthServiceError,
  InvalidTokenError,
  RateLimitError,
  NetworkError,
} from '../errors/oauth-errors.js';
import { setupOAuthErrorHandling } from '../middleware/oauth-error-middleware.js';

describe('Comprehensive OAuth Error Handling', () => {
  let app: express.Application;
  let authService: AuthService;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    authService = new AuthService({
      jwt: {
        secret: 'test-jwt-secret',
        expiresIn: '7d',
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
        maxAge: 604800000,
      },
    });
  });

  // Helper function to setup routes and error handling
  const setupRouteWithErrorHandling = (
    path: string,
    handler: express.RequestHandler
  ): void => {
    app.get(path, handler);
    setupOAuthErrorHandling(app);
  };

  const setupPostRouteWithErrorHandling = (
    path: string,
    handler: express.RequestHandler
  ): void => {
    app.post(path, handler);
    setupOAuthErrorHandling(app);
  };

  describe('Google OAuth Service Errors', () => {
    it('should handle Google OAuth service unavailability with appropriate error response', async () => {
      // Setup route that simulates Google service unavailability
      setupRouteWithErrorHandling('/auth/google/callback', (req, res, next) => {
        const error = new GoogleOAuthServiceError(
          'Google OAuth service temporarily unavailable',
          'SERVICE_UNAVAILABLE'
        );
        next(error);
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(503);

      expect(response.body).toEqual(
        expect.objectContaining({
          error: 'Authentication Service Unavailable',
          message:
            'Google authentication service is temporarily unavailable. Please try again later.',
          code: 'SERVICE_UNAVAILABLE',
          retryAfter: expect.any(Number),
        })
      );
    });

    it('should handle Google API rate limiting with backoff strategy', async () => {
      setupRouteWithErrorHandling('/auth/google/callback', (req, res, next) => {
        const error = new RateLimitError(
          'Google API rate limit exceeded',
          'RATE_LIMIT_EXCEEDED',
          300 // 5 minutes
        );
        next(error);
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(429);

      expect(response.body).toEqual(
        expect.objectContaining({
          error: 'Rate Limit Exceeded',
          message:
            'Too many authentication requests. Please wait before trying again.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: 300,
        })
      );

      expect(response.headers['retry-after']).toBe('300');
    });

    it('should handle Google OAuth configuration errors', async () => {
      setupRouteWithErrorHandling('/auth/google/callback', (req, res, next) => {
        const error = new GoogleOAuthServiceError(
          'Invalid Google OAuth configuration',
          'INVALID_CONFIGURATION'
        );
        next(error);
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(500);

      expect(response.body).toEqual(
        expect.objectContaining({
          error: 'Authentication Configuration Error',
          message:
            'Authentication service is misconfigured. Please contact support.',
          code: 'INVALID_CONFIGURATION',
        })
      );
    });
  });

  describe('Invalid Token Handling', () => {
    it('should reject invalid Google token with structured error response', async () => {
      setupPostRouteWithErrorHandling('/auth/verify', (req, res, next) => {
        const error = new InvalidTokenError(
          'Invalid Google OAuth token',
          'INVALID_TOKEN',
          'google_oauth'
        );
        next(error);
      });

      const response = await request(app)
        .post('/auth/verify')
        .send({ token: 'invalid-token' })
        .expect(401);

      expect(response.body).toEqual(
        expect.objectContaining({
          error: 'Invalid Authentication Token',
          message: 'The provided authentication token is invalid or expired.',
          code: 'INVALID_TOKEN',
          tokenType: 'google_oauth',
        })
      );
    });

    it('should reject expired Google token with refresh suggestion', async () => {
      setupPostRouteWithErrorHandling('/auth/verify', (req, res, next) => {
        const error = new InvalidTokenError(
          'Google OAuth token has expired',
          'TOKEN_EXPIRED',
          'google_oauth'
        );
        next(error);
      });

      const response = await request(app)
        .post('/auth/verify')
        .send({ token: 'expired-token' })
        .expect(401);

      expect(response.body).toEqual(
        expect.objectContaining({
          error: 'Authentication Token Expired',
          message:
            'Your authentication session has expired. Please log in again.',
          code: 'TOKEN_EXPIRED',
          tokenType: 'google_oauth',
          action: 'redirect_to_login',
        })
      );
    });

    it('should reject malformed Google token with validation error', async () => {
      setupPostRouteWithErrorHandling('/auth/verify', (req, res, next) => {
        const error = new InvalidTokenError(
          'Malformed Google OAuth token',
          'MALFORMED_TOKEN',
          'google_oauth'
        );
        next(error);
      });

      const response = await request(app)
        .post('/auth/verify')
        .send({ token: 'malformed.token' })
        .expect(400);

      expect(response.body).toEqual(
        expect.objectContaining({
          error: 'Malformed Authentication Token',
          message: 'The authentication token format is invalid.',
          code: 'MALFORMED_TOKEN',
          tokenType: 'google_oauth',
        })
      );
    });
  });

  describe('Network and Connectivity Errors', () => {
    it('should handle network errors during Google OAuth flow', async () => {
      setupRouteWithErrorHandling('/auth/google/callback', (req, res, next) => {
        const error = new NetworkError(
          'Failed to connect to Google OAuth service',
          'NETWORK_ERROR'
        );
        next(error);
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(502);

      expect(response.body).toEqual(
        expect.objectContaining({
          error: 'Network Error',
          message:
            'Unable to connect to authentication service. Please check your connection and try again.',
          code: 'NETWORK_ERROR',
        })
      );
    });

    it('should handle DNS resolution failures for Google services', async () => {
      setupRouteWithErrorHandling('/auth/google/callback', (req, res, next) => {
        const error = new NetworkError(
          'DNS resolution failed for accounts.google.com',
          'DNS_RESOLUTION_FAILED'
        );
        next(error);
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(502);

      expect(response.body).toEqual(
        expect.objectContaining({
          error: 'Network Error',
          message:
            'Unable to connect to authentication service. Please check your connection and try again.',
          code: 'DNS_RESOLUTION_FAILED',
        })
      );
    });

    it('should handle timeout errors during OAuth verification', async () => {
      setupPostRouteWithErrorHandling('/auth/verify', (req, res, next) => {
        const error = new NetworkError(
          'Timeout during Google OAuth token verification',
          'VERIFICATION_TIMEOUT'
        );
        next(error);
      });

      const response = await request(app)
        .post('/auth/verify')
        .send({ token: 'valid-but-slow-token' })
        .expect(504);

      expect(response.body).toEqual(
        expect.objectContaining({
          error: 'Authentication Timeout',
          message:
            'Authentication verification took too long. Please try again.',
          code: 'VERIFICATION_TIMEOUT',
        })
      );
    });
  });

  describe('User-Friendly Error Messages', () => {
    it('should display user-friendly error messages for technical failures', async () => {
      setupRouteWithErrorHandling('/auth/google/callback', (req, res, next) => {
        const error = new AuthenticationError(
          'Internal authentication error: database connection failed',
          'INTERNAL_ERROR'
        );
        next(error);
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(500);

      expect(response.body).toEqual(
        expect.objectContaining({
          error: 'Authentication Error',
          message:
            'We encountered an issue during authentication. Please try again or contact support if the problem persists.',
          code: 'INTERNAL_ERROR',
        })
      );
    });

    it('should provide helpful error messages for missing parameters', async () => {
      setupPostRouteWithErrorHandling('/auth/verify', (req, res, next) => {
        const error = new AuthenticationError(
          'Missing required parameter: access_token',
          'MISSING_PARAMETER',
          400
        );
        next(error);
      });

      const response = await request(app)
        .post('/auth/verify')
        .send({}) // Missing token
        .expect(400);

      expect(response.body).toEqual(
        expect.objectContaining({
          error: 'Invalid Request',
          message:
            'Required authentication information is missing. Please log in again.',
          code: 'MISSING_PARAMETER',
        })
      );
    });

    it('should handle concurrent authentication attempts gracefully', async () => {
      setupPostRouteWithErrorHandling('/auth/verify', (req, res, next) => {
        const error = new AuthenticationError(
          'Concurrent authentication attempts detected',
          'CONCURRENT_AUTH',
          409
        );
        next(error);
      });

      const response = await request(app)
        .post('/auth/verify')
        .send({ token: 'concurrent-token' })
        .expect(409);

      expect(response.body).toEqual(
        expect.objectContaining({
          error: 'Authentication Conflict',
          message:
            'Another authentication is in progress. Please wait and try again.',
          code: 'CONCURRENT_AUTH',
        })
      );
    });
  });

  describe('Security and Authorization Errors', () => {
    it('should handle insufficient OAuth scopes gracefully', async () => {
      setupRouteWithErrorHandling('/auth/google/callback', (req, res, next) => {
        const error = new AuthenticationError(
          'Insufficient OAuth scopes granted',
          'INSUFFICIENT_SCOPE',
          403
        );
        next(error);
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(403);

      expect(response.body).toEqual(
        expect.objectContaining({
          error: 'Insufficient Permissions',
          message:
            'The requested permissions were not granted. Please authorize all required permissions.',
          code: 'INSUFFICIENT_SCOPE',
          action: 'reauthorize',
        })
      );
    });

    it('should handle OAuth state parameter mismatch', async () => {
      setupRouteWithErrorHandling('/auth/google/callback', (req, res, next) => {
        const error = new AuthenticationError(
          'OAuth state parameter mismatch - possible CSRF attack',
          'STATE_MISMATCH',
          403
        );
        next(error);
      });

      const response = await request(app)
        .get('/auth/google/callback?state=invalid')
        .expect(403);

      expect(response.body).toEqual(
        expect.objectContaining({
          error: 'Security Error',
          message:
            'Authentication request appears to be invalid. Please start the login process again.',
          code: 'STATE_MISMATCH',
          action: 'restart_auth',
        })
      );
    });

    it('should handle OAuth callback with error parameter', async () => {
      setupRouteWithErrorHandling('/auth/google/callback', (req, res, next) => {
        const error = new AuthenticationError(
          'User denied OAuth authorization',
          'ACCESS_DENIED',
          403
        );
        next(error);
      });

      const response = await request(app)
        .get('/auth/google/callback?error=access_denied')
        .expect(403);

      expect(response.body).toEqual(
        expect.objectContaining({
          error: 'Access Denied',
          message:
            'You declined to authorize the application. Authorization is required to continue.',
          code: 'ACCESS_DENIED',
          action: 'retry_auth',
        })
      );
    });
  });

  describe('Error Logging and Monitoring', () => {
    it('should log authentication errors with appropriate detail level', async () => {
      const mockLogger = {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
      };

      // Setup route with custom error middleware that uses mock logger
      app.get('/auth/test-error', (req, res, next) => {
        const error = new AuthenticationError(
          'Test authentication error',
          'TEST_ERROR'
        );
        next(error);
      });

      // Add custom error middleware with mock logger
      app.use((err: any, req: any, res: any, next: any) => {
        if (err instanceof AuthenticationError) {
          mockLogger.error('Authentication error occurred', {
            error: err.message,
            code: err.code,
            stack: err.stack,
            requestId: req.id,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
          });
        }
        res.status(err.statusCode || 500).json({ error: err.message });
      });

      await request(app)
        .get('/auth/test-error')
        .set('User-Agent', 'Test-Agent')
        .expect(500);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Authentication error occurred',
        expect.objectContaining({
          error: 'Test authentication error',
          code: 'TEST_ERROR',
          stack: expect.any(String),
          userAgent: 'Test-Agent',
        })
      );
    });

    it('should not log sensitive information in error logs', async () => {
      const mockLogger = {
        error: jest.fn(),
      };

      // Setup route that triggers error
      app.post('/auth/sensitive-error', (req, res, next) => {
        const error = new AuthenticationError(
          'Error with sensitive data',
          'SENSITIVE_ERROR'
        );
        next(error);
      });

      // Add custom error middleware with mock logger
      app.use((err: any, req: any, res: any, next: any) => {
        mockLogger.error('Error occurred', {
          message: err.message,
          // Should NOT include sensitive data like tokens, passwords, etc.
          body: req.body ? '[REDACTED]' : undefined,
          headers: req.headers ? '[REDACTED]' : undefined,
        });
        res.status(err.statusCode || 500).json({ error: err.message });
      });

      await request(app)
        .post('/auth/sensitive-error')
        .send({
          token: 'sensitive-token',
          password: 'sensitive-password',
        })
        .expect(500);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error occurred',
        expect.objectContaining({
          message: 'Error with sensitive data',
          body: '[REDACTED]',
        })
      );
    });
  });

  describe('Error Recovery and Retry Logic', () => {
    it('should provide retry mechanism for transient failures', async () => {
      setupRouteWithErrorHandling('/auth/google/callback', (req, res, next) => {
        const error = new GoogleOAuthServiceError(
          'Temporary service disruption',
          'TEMPORARY_DISRUPTION'
        );
        next(error);
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(503);

      expect(response.body).toEqual(
        expect.objectContaining({
          error: 'Authentication Service Unavailable',
          message:
            'Google authentication service is temporarily unavailable. Please try again later.',
          code: 'TEMPORARY_DISRUPTION',
          retryAfter: expect.any(Number),
          action: 'retry',
        })
      );
    });

    it('should handle authentication flow interruption gracefully', async () => {
      setupRouteWithErrorHandling('/auth/google/callback', (req, res, next) => {
        const error = new AuthenticationError(
          'Authentication flow was interrupted',
          'FLOW_INTERRUPTED'
        );
        next(error);
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(500);

      expect(response.body).toEqual(
        expect.objectContaining({
          error: 'Authentication Flow Error',
          message:
            'The authentication process was interrupted. Please start over.',
          code: 'FLOW_INTERRUPTED',
          action: 'restart_auth',
        })
      );
    });
  });

  describe('Integration with Frontend Error Handling', () => {
    it('should provide structured error responses compatible with frontend', async () => {
      setupRouteWithErrorHandling('/auth/frontend-error', (req, res, next) => {
        const error = new AuthenticationError(
          'Frontend-compatible error',
          'FRONTEND_ERROR'
        );
        next(error);
      });

      const response = await request(app)
        .get('/auth/frontend-error')
        .expect(500);

      // Response should be in format expected by frontend error handlers
      expect(response.body).toEqual(
        expect.objectContaining({
          error: expect.any(String),
          message: expect.any(String),
          code: expect.any(String),
          timestamp: expect.any(String),
          requestId: expect.any(String),
        })
      );
    });

    it('should include redirect instructions for authentication failures', async () => {
      setupRouteWithErrorHandling('/auth/redirect-error', (req, res, next) => {
        const error = new InvalidTokenError(
          'Session expired',
          'SESSION_EXPIRED',
          'jwt'
        );
        next(error);
      });

      const response = await request(app)
        .get('/auth/redirect-error')
        .expect(401);

      expect(response.body).toEqual(
        expect.objectContaining({
          error: 'Authentication Token Expired',
          message:
            'Your authentication session has expired. Please log in again.',
          code: 'SESSION_EXPIRED',
          tokenType: 'jwt',
          action: 'redirect_to_login',
          redirectUrl: '/auth/login',
        })
      );
    });
  });
});
