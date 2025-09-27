/**
 * OAuth Error Classes
 *
 * Comprehensive error handling for OAuth authentication flows.
 * Based on PRD requirements for authentication error handling.
 */

/**
 * Base OAuth error class
 */
export abstract class OAuthError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean = true;

  constructor(message: string, code: string, statusCode: number = 500) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON for API responses
   */
  toJSON(): Record<string, unknown> {
    return {
      error: this.getDisplayName(),
      message: this.getUserMessage(),
      code: this.code,
      timestamp: new Date().toISOString(),
      requestId: this.generateRequestId(),
    };
  }

  /**
   * Get user-friendly display name for the error
   */
  abstract getDisplayName(): string;

  /**
   * Get user-friendly error message
   */
  abstract getUserMessage(): string;

  /**
   * Generate request ID for tracking
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Generic authentication error
 */
export class AuthenticationError extends OAuthError {
  constructor(message: string, code: string, statusCode: number = 500) {
    super(message, code, statusCode);
  }

  getDisplayName(): string {
    switch (this.code) {
      case 'INTERNAL_ERROR':
        return 'Authentication Error';
      case 'MISSING_PARAMETER':
        return 'Invalid Request';
      case 'CONCURRENT_AUTH':
        return 'Authentication Conflict';
      case 'INSUFFICIENT_SCOPE':
        return 'Insufficient Permissions';
      case 'STATE_MISMATCH':
        return 'Security Error';
      case 'ACCESS_DENIED':
        return 'Access Denied';
      case 'FLOW_INTERRUPTED':
        return 'Authentication Flow Error';
      default:
        return 'Authentication Error';
    }
  }

  getUserMessage(): string {
    switch (this.code) {
      case 'INTERNAL_ERROR':
        return 'We encountered an issue during authentication. Please try again or contact support if the problem persists.';
      case 'MISSING_PARAMETER':
        return 'Required authentication information is missing. Please log in again.';
      case 'CONCURRENT_AUTH':
        return 'Another authentication is in progress. Please wait and try again.';
      case 'INSUFFICIENT_SCOPE':
        return 'The requested permissions were not granted. Please authorize all required permissions.';
      case 'STATE_MISMATCH':
        return 'Authentication request appears to be invalid. Please start the login process again.';
      case 'ACCESS_DENIED':
        return 'You declined to authorize the application. Authorization is required to continue.';
      case 'FLOW_INTERRUPTED':
        return 'The authentication process was interrupted. Please start over.';
      default:
        return 'An authentication error occurred. Please try again.';
    }
  }

  toJSON(): Record<string, unknown> {
    const baseJson = super.toJSON();

    // Add action recommendations for specific error types
    const action = this.getRecommendedAction();
    if (action) {
      baseJson.action = action;
    }

    // Add redirect URL for login-required errors
    if (this.code === 'ACCESS_DENIED' || this.code === 'STATE_MISMATCH') {
      baseJson.redirectUrl = '/auth/login';
    }

    return baseJson;
  }

  private getRecommendedAction(): string | undefined {
    switch (this.code) {
      case 'INSUFFICIENT_SCOPE':
        return 'reauthorize';
      case 'STATE_MISMATCH':
        return 'restart_auth';
      case 'ACCESS_DENIED':
        return 'retry_auth';
      case 'FLOW_INTERRUPTED':
        return 'restart_auth';
      default:
        return undefined;
    }
  }
}

/**
 * Google OAuth service specific errors
 */
export class GoogleOAuthServiceError extends OAuthError {
  constructor(message: string, code: string) {
    const statusCode = GoogleOAuthServiceError.getStatusCodeForError(code);
    super(message, code, statusCode);
  }

  getDisplayName(): string {
    switch (this.code) {
      case 'SERVICE_UNAVAILABLE':
      case 'TEMPORARY_DISRUPTION':
        return 'Authentication Service Unavailable';
      case 'INVALID_CONFIGURATION':
        return 'Authentication Configuration Error';
      default:
        return 'Google Authentication Error';
    }
  }

  getUserMessage(): string {
    switch (this.code) {
      case 'SERVICE_UNAVAILABLE':
      case 'TEMPORARY_DISRUPTION':
        return 'Google authentication service is temporarily unavailable. Please try again later.';
      case 'INVALID_CONFIGURATION':
        return 'Authentication service is misconfigured. Please contact support.';
      default:
        return 'There was an issue with Google authentication. Please try again.';
    }
  }

  toJSON(): Record<string, unknown> {
    const baseJson = super.toJSON();

    // Add retry information for service unavailability
    if (
      this.code === 'SERVICE_UNAVAILABLE' ||
      this.code === 'TEMPORARY_DISRUPTION'
    ) {
      baseJson.retryAfter = this.getRetryAfterSeconds();
      baseJson.action = 'retry';
    }

    return baseJson;
  }

  private getRetryAfterSeconds(): number {
    switch (this.code) {
      case 'SERVICE_UNAVAILABLE':
        return 60; // 1 minute
      case 'TEMPORARY_DISRUPTION':
        return 300; // 5 minutes
      default:
        return 30; // 30 seconds
    }
  }

  private static getStatusCodeForError(code: string): number {
    switch (code) {
      case 'SERVICE_UNAVAILABLE':
      case 'TEMPORARY_DISRUPTION':
        return 503;
      case 'INVALID_CONFIGURATION':
        return 500;
      default:
        return 502;
    }
  }
}

/**
 * Invalid token errors
 */
export class InvalidTokenError extends OAuthError {
  public readonly tokenType: string;

  constructor(message: string, code: string, tokenType: string) {
    const statusCode = InvalidTokenError.getStatusCodeForError(code);
    super(message, code, statusCode);
    this.tokenType = tokenType;
  }

  getDisplayName(): string {
    switch (this.code) {
      case 'INVALID_TOKEN':
        return 'Invalid Authentication Token';
      case 'TOKEN_EXPIRED':
      case 'SESSION_EXPIRED':
        return 'Authentication Token Expired';
      case 'MALFORMED_TOKEN':
        return 'Malformed Authentication Token';
      default:
        return 'Token Error';
    }
  }

  getUserMessage(): string {
    switch (this.code) {
      case 'INVALID_TOKEN':
        return 'The provided authentication token is invalid or expired.';
      case 'TOKEN_EXPIRED':
      case 'SESSION_EXPIRED':
        return 'Your authentication session has expired. Please log in again.';
      case 'MALFORMED_TOKEN':
        return 'The authentication token format is invalid.';
      default:
        return 'There was an issue with your authentication token. Please log in again.';
    }
  }

  toJSON(): Record<string, unknown> {
    const baseJson = super.toJSON();
    baseJson.tokenType = this.tokenType;

    // Add action for expired tokens
    if (this.code === 'TOKEN_EXPIRED' || this.code === 'SESSION_EXPIRED') {
      baseJson.action = 'redirect_to_login';
      baseJson.redirectUrl = '/auth/login';
    }

    return baseJson;
  }

  private static getStatusCodeForError(code: string): number {
    switch (code) {
      case 'MALFORMED_TOKEN':
        return 400;
      case 'INVALID_TOKEN':
      case 'TOKEN_EXPIRED':
      case 'SESSION_EXPIRED':
        return 401;
      default:
        return 401;
    }
  }
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends OAuthError {
  public readonly retryAfter: number;

  constructor(message: string, code: string, retryAfter: number = 60) {
    super(message, code, 429);
    this.retryAfter = retryAfter;
  }

  getDisplayName(): string {
    return 'Rate Limit Exceeded';
  }

  getUserMessage(): string {
    return 'Too many authentication requests. Please wait before trying again.';
  }

  toJSON(): Record<string, unknown> {
    const baseJson = super.toJSON();
    baseJson.retryAfter = this.retryAfter;
    return baseJson;
  }
}

/**
 * Network and connectivity errors
 */
export class NetworkError extends OAuthError {
  constructor(message: string, code: string) {
    const statusCode = NetworkError.getStatusCodeForError(code);
    super(message, code, statusCode);
  }

  getDisplayName(): string {
    switch (this.code) {
      case 'VERIFICATION_TIMEOUT':
        return 'Authentication Timeout';
      case 'NETWORK_ERROR':
      case 'DNS_RESOLUTION_FAILED':
        return 'Network Error';
      default:
        return 'Connection Error';
    }
  }

  getUserMessage(): string {
    switch (this.code) {
      case 'VERIFICATION_TIMEOUT':
        return 'Authentication verification took too long. Please try again.';
      case 'NETWORK_ERROR':
      case 'DNS_RESOLUTION_FAILED':
        return 'Unable to connect to authentication service. Please check your connection and try again.';
      default:
        return 'A network error occurred during authentication. Please try again.';
    }
  }

  private static getStatusCodeForError(code: string): number {
    switch (code) {
      case 'VERIFICATION_TIMEOUT':
        return 504;
      case 'NETWORK_ERROR':
      case 'DNS_RESOLUTION_FAILED':
        return 502;
      default:
        return 503;
    }
  }
}

/**
 * Type guards for error identification
 */
export function isOAuthError(error: unknown): error is OAuthError {
  return error instanceof OAuthError;
}

export function isAuthenticationError(
  error: unknown
): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

export function isGoogleOAuthServiceError(
  error: unknown
): error is GoogleOAuthServiceError {
  return error instanceof GoogleOAuthServiceError;
}

export function isInvalidTokenError(
  error: unknown
): error is InvalidTokenError {
  return error instanceof InvalidTokenError;
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

/**
 * Error factory for creating appropriate error instances
 */
export class OAuthErrorFactory {
  /**
   * Create an error based on the error type and context
   */
  static createError(
    type: string,
    message: string,
    context?: Record<string, unknown>
  ): OAuthError {
    switch (type) {
      case 'google_service_error':
        return new GoogleOAuthServiceError(
          message,
          (context?.code as string) || 'UNKNOWN_ERROR'
        );

      case 'invalid_token':
        return new InvalidTokenError(
          message,
          (context?.code as string) || 'INVALID_TOKEN',
          (context?.tokenType as string) || 'unknown'
        );

      case 'rate_limit':
        return new RateLimitError(
          message,
          (context?.code as string) || 'RATE_LIMIT_EXCEEDED',
          (context?.retryAfter as number) || 60
        );

      case 'network_error':
        return new NetworkError(
          message,
          (context?.code as string) || 'NETWORK_ERROR'
        );

      default:
        return new AuthenticationError(
          message,
          (context?.code as string) || 'UNKNOWN_ERROR',
          (context?.statusCode as number) || 500
        );
    }
  }

  /**
   * Create error from Passport.js error
   */
  static fromPassportError(
    passportError: Error & { name?: string; message?: string }
  ): OAuthError {
    if (passportError.name === 'GooglePlusAPIError') {
      return new GoogleOAuthServiceError(
        passportError.message,
        'GOOGLE_API_ERROR'
      );
    }

    if (passportError.name === 'InternalOAuthError') {
      return new GoogleOAuthServiceError(
        'Google OAuth service error',
        'OAUTH_SERVICE_ERROR'
      );
    }

    if (passportError.message?.includes('timeout')) {
      return new NetworkError(
        'Authentication request timed out',
        'VERIFICATION_TIMEOUT'
      );
    }

    if (passportError.message?.includes('rate limit')) {
      return new RateLimitError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED');
    }

    // Default fallback
    return new AuthenticationError(
      passportError.message || 'Authentication failed',
      'PASSPORT_ERROR'
    );
  }
}
