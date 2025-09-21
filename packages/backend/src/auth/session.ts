import { Request, Response, NextFunction } from 'express';
import { AuthConfig } from './config.js';

/**
 * Session configuration for Express
 */
export function getSessionConfig(config: AuthConfig): object {
  return {
    secret: config.session.secret,
    name: config.session.name,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: config.session.maxAge,
    },
  };
}

/**
 * Middleware to check if user is authenticated
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  res.status(401).json({
    error: 'Authentication required',
    message: 'Please log in to access this resource',
  });
}

/**
 * Middleware to check if user is authenticated (but allow anonymous access)
 */
export function optionalAuth(
  _req: Request,
  _res: Response,
  next: NextFunction
): void {
  // Simply pass through, user may or may not be authenticated
  next();
}

/**
 * Logout helper
 */
export function logout(req: Request, res: Response, next: NextFunction): void {
  req.logout((err) => {
    if (err) {
      return next(err);
    }

    if (
      (
        req as Request & {
          session?: { destroy: (callback: (err?: Error) => void) => void };
        }
      ).session
    ) {
      (
        req as Request & {
          session: { destroy: (callback: (err?: Error) => void) => void };
        }
      ).session.destroy((destroyErr?: Error) => {
        if (destroyErr) {
          return next(destroyErr);
        }
        res.clearCookie('connect.sid'); // Default session cookie name
        res.json({ message: 'Logged out successfully' });
      });
    } else {
      res.json({ message: 'Logged out successfully' });
    }
  });
}
