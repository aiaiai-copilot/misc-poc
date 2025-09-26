import { Request, Response, NextFunction } from 'express';
import { AuthConfig } from './config.js';

/**
 * Session configuration for Express
 */
export function getSessionConfig(config: AuthConfig): {
  secret: string;
  name: string;
  resave: boolean;
  saveUninitialized: boolean;
  cookie: {
    secure: boolean;
    httpOnly: boolean;
    maxAge: number;
    sameSite: 'strict' | 'lax';
    domain?: string;
    path?: string;
  };
} {
  const cookieConfig: {
    secure: boolean;
    httpOnly: boolean;
    maxAge: number;
    sameSite: 'strict' | 'lax';
    domain?: string;
    path?: string;
  } = {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: config.session.maxAge,
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax', // CSRF protection
  };

  // Add domain and path if provided (and not empty strings)
  if (config.session.domain && config.session.domain.trim() !== '') {
    cookieConfig.domain = config.session.domain;
  }
  if (config.session.path && config.session.path.trim() !== '') {
    cookieConfig.path = config.session.path;
  }

  return {
    secret: config.session.secret,
    name: config.session.name,
    resave: false,
    saveUninitialized: false,
    cookie: cookieConfig,
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
export function logout(
  req: Request,
  res: Response,
  next: NextFunction,
  sessionName = 'connect.sid'
): void {
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
        res.clearCookie(sessionName); // Clear session cookies
        res.json({ message: 'Logged out successfully' });
      });
    } else {
      res.clearCookie(sessionName); // Clear session cookies even without session
      res.json({ message: 'Logged out successfully' });
    }
  });
}
