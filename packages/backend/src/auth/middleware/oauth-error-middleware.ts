/**
 * OAuth Error Handling Middleware
 *
 * Comprehensive error handling middleware for OAuth authentication flows.
 * Implements user-friendly error responses and proper logging as specified in PRD.
 */

import { Request, Response, NextFunction, Application } from 'express';
import {
  OAuthError,
  AuthenticationError,
  GoogleOAuthServiceError,
  InvalidTokenError,
  RateLimitError,
  NetworkError,
  isOAuthError,
  isRateLimitError,
  OAuthErrorFactory,
} from '../errors/oauth-errors.js';

/**
 * Logger interface for error logging
 */
interface Logger {
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Default console logger implementation
 */
const defaultLogger: Logger = {
  error: (message: string, meta?: Record<string, unknown>) => {
    console.error(message, meta);
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    console.warn(message, meta);
  },
  info: (message: string, meta?: Record<string, unknown>) => {
    console.info(message, meta);
  },
};

/**
 * Configuration for OAuth error middleware
 */
export interface OAuthErrorMiddlewareConfig {
  logger?: Logger;
  includeStackTrace?: boolean;
  logSensitiveData?: boolean;
  requestIdHeader?: string;
}

/**
 * Enhanced request interface with request ID
 */
interface RequestWithId extends Request {
  id?: string;
}

/**
 * OAuth error handling middleware
 */
export class OAuthErrorMiddleware {
  private logger: Logger;
  private includeStackTrace: boolean;
  private logSensitiveData: boolean;
  private requestIdHeader: string;

  constructor(config: OAuthErrorMiddlewareConfig = {}) {
    this.logger = config.logger || defaultLogger;
    this.includeStackTrace = config.includeStackTrace ?? false;
    this.logSensitiveData = config.logSensitiveData ?? false;
    this.requestIdHeader = config.requestIdHeader || 'X-Request-ID';
  }

  /**
   * Main error handling middleware function
   */
  handleError = (
    error: unknown,
    req: RequestWithId,
    res: Response,
    _next: NextFunction
  ): void => {
    // Generate or extract request ID
    const requestId = this.getRequestId(req);
    req.id = requestId;

    // Convert unknown errors to OAuth errors
    const oauthError = this.normalizeError(error);

    // Log the error with appropriate detail level
    this.logError(oauthError, req);

    // Send error response
    this.sendErrorResponse(oauthError, req, res);
  };

  /**
   * Middleware for handling Passport.js authentication failures
   */
  handlePassportError = (
    error: unknown,
    req: RequestWithId,
    res: Response,
    next: NextFunction
  ): void => {
    if (error) {
      const oauthError = OAuthErrorFactory.fromPassportError(error as Error);
      this.handleError(oauthError, req, res, next);
    } else {
      next();
    }
  };

  /**
   * Get or generate request ID
   */
  private getRequestId(req: RequestWithId): string {
    return (
      req.id ||
      req.get(this.requestIdHeader) ||
      `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    );
  }

  /**
   * Convert any error to an OAuth error
   */
  private normalizeError(error: unknown): OAuthError {
    if (isOAuthError(error)) {
      return error;
    }

    // Handle common Node.js/network errors
    if (typeof error === 'object' && error !== null) {
      const errorObj = error as Record<string, unknown>;

      if (errorObj.code === 'ENOTFOUND' || errorObj.code === 'ECONNREFUSED') {
        return new NetworkError('Network connection failed', 'NETWORK_ERROR');
      }

      if (errorObj.code === 'ETIMEDOUT') {
        return new NetworkError('Request timeout', 'VERIFICATION_TIMEOUT');
      }

      // Handle HTTP errors
      if (errorObj.status === 429 || errorObj.statusCode === 429) {
        return new RateLimitError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED');
      }

      if (errorObj.status === 401 || errorObj.statusCode === 401) {
        return new InvalidTokenError(
          'Authentication failed',
          'INVALID_TOKEN',
          'unknown'
        );
      }
    }

    // Default fallback
    const errorObj = error as Record<string, unknown>;
    return new AuthenticationError(
      (errorObj?.message as string) || 'Authentication error occurred',
      'UNKNOWN_ERROR',
      (errorObj?.status as number) || (errorObj?.statusCode as number) || 500
    );
  }

  /**
   * Log error with appropriate detail level
   */
  private logError(error: OAuthError, req: RequestWithId): void {
    const logData = this.createLogData(error, req);

    if (error.statusCode >= 500) {
      this.logger.error('OAuth authentication error', logData);
    } else if (error.statusCode >= 400) {
      this.logger.warn('OAuth client error', logData);
    } else {
      this.logger.info('OAuth information', logData);
    }
  }

  /**
   * Create log data object with security considerations
   */
  private createLogData(
    error: OAuthError,
    req: RequestWithId
  ): Record<string, unknown> {
    const baseData: Record<string, unknown> = {
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
      requestId: req.id,
      method: req.method,
      url: req.originalUrl || req.url,
      userAgent: req.get('User-Agent'),
      ip: this.getClientIp(req),
      timestamp: new Date().toISOString(),
    };

    // Include stack trace in development/debug mode
    if (this.includeStackTrace) {
      baseData.stack = error.stack;
    }

    // Conditionally include request details (be careful with sensitive data)
    if (this.logSensitiveData) {
      baseData.headers = req.headers;
      baseData.body = req.body;
      baseData.query = req.query;
    } else {
      // Redact sensitive information
      baseData.headers = '[REDACTED]';
      baseData.body = '[REDACTED]';
      baseData.query = '[REDACTED]';
    }

    return baseData;
  }

  /**
   * Get client IP address
   */
  private getClientIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Send structured error response
   */
  private sendErrorResponse(
    error: OAuthError,
    req: RequestWithId,
    res: Response
  ): void {
    // Don't send response if headers already sent
    if (res.headersSent) {
      return;
    }

    // Set appropriate headers
    res.set('Content-Type', 'application/json');

    // Set retry-after header for rate limiting
    if (isRateLimitError(error)) {
      res.set('Retry-After', error.retryAfter.toString());
    }

    // Set request ID header for tracking
    if (req.id) {
      res.set('X-Request-ID', req.id);
    }

    // Send JSON error response
    const errorResponse = {
      ...error.toJSON(),
      requestId: req.id,
    };

    res.status(error.statusCode).json(errorResponse);
  }
}

/**
 * Setup OAuth error handling for Express application
 */
export function setupOAuthErrorHandling(
  app: Application,
  config: OAuthErrorMiddlewareConfig = {}
): void {
  const middleware = new OAuthErrorMiddleware(config);

  // Add error handling middleware (should be last in middleware chain)
  app.use(middleware.handleError);
}

/**
 * Create OAuth error handling middleware instance
 */
export function createOAuthErrorMiddleware(
  config: OAuthErrorMiddlewareConfig = {}
): OAuthErrorMiddleware {
  return new OAuthErrorMiddleware(config);
}

/**
 * Utility function to wrap async route handlers with error handling
 */
export function catchOAuthErrors(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

/**
 * Middleware to add request ID to requests
 */
export function addRequestId(headerName: string = 'X-Request-ID') {
  return (req: RequestWithId, res: Response, next: NextFunction): void => {
    if (!req.id) {
      req.id =
        req.get(headerName) ||
        `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    res.set(headerName, req.id);
    next();
  };
}

/**
 * Enhanced Passport authentication middleware with OAuth error handling
 */
export function authenticateWithErrorHandling(
  strategy: string,
  options: Record<string, unknown> = {}
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const passport = require('passport');

    passport.authenticate(
      strategy,
      options,
      (error: unknown, user: unknown, info: unknown) => {
        if (error) {
          // Convert Passport error to OAuth error
          const oauthError = OAuthErrorFactory.fromPassportError(
            error as Error
          );
          return next(oauthError);
        }

        if (!user) {
          // Handle authentication failure
          const authError = new AuthenticationError(
            (info as { message?: string })?.message || 'Authentication failed',
            'AUTHENTICATION_FAILED',
            401
          );
          return next(authError);
        }

        // Success - attach user to request
        req.user = user;
        next();
      }
    )(req, res, next);
  };
}

// Export error classes for convenience
export {
  OAuthError,
  AuthenticationError,
  GoogleOAuthServiceError,
  InvalidTokenError,
  RateLimitError,
  NetworkError,
  OAuthErrorFactory,
};
