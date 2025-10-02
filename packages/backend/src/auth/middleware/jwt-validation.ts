import { Request, Response, NextFunction } from 'express';
import { JwtService } from '../jwt.js';

// Note: Express Request type extension is in app.ts

/**
 * JWT Validation Middleware
 *
 * Validates JWT tokens from either:
 * 1. Authorization header (Bearer scheme) - preferred
 * 2. Cookie (accessToken)
 *
 * On successful validation:
 * - Attaches decoded user payload to req.user
 * - Calls next() to continue the middleware chain
 *
 * On validation failure:
 * - Sends 401 Unauthorized response with error details
 * - Terminates the request (does not call next())
 */
export function jwtValidationMiddleware(jwtService: JwtService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Extract token from Authorization header or cookie
      const token = extractToken(req);

      if (!token) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'No authentication token provided',
        });
        return;
      }

      // Verify and decode the token
      const payload = jwtService.verifyToken(token);

      // Attach user context to request
      req.user = payload;

      // Continue to next middleware
      next();
    } catch (error) {
      // Handle verification errors
      const message =
        error instanceof Error ? error.message : 'Authentication failed';

      res.status(401).json({
        error: 'Unauthorized',
        message,
      });
    }
  };
}

/**
 * Extract JWT token from request
 *
 * Priority order:
 * 1. Authorization header (Bearer token)
 * 2. Cookie (accessToken)
 *
 * @param req - Express request object
 * @returns Extracted token or null if not found
 */
function extractToken(req: Request): string | null {
  // Check Authorization header first (preferred)
  const authHeader = req.headers.authorization;

  if (authHeader) {
    // Validate Bearer scheme
    if (!authHeader.startsWith('Bearer ')) {
      throw new Error('Invalid authorization header format');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Validate token exists after Bearer prefix
    if (!token || token.trim() === '') {
      throw new Error('Invalid authorization header format');
    }

    return token;
  }

  // Fallback to cookie
  const cookieToken = req.cookies?.accessToken;

  if (
    cookieToken &&
    typeof cookieToken === 'string' &&
    cookieToken.trim() !== ''
  ) {
    return cookieToken;
  }

  // No token found
  return null;
}
