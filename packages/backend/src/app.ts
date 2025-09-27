import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import passport from 'passport';
import cookieParser from 'cookie-parser';
import { AuthService } from './auth/index.js';
import { JwtService } from './auth/jwt.js';

export interface AppConfig {
  cors?: {
    origin: string;
    credentials: boolean;
  };
}

/**
 * JWT Authentication Middleware
 */
export function jwtAuthMiddleware(jwtService: JwtService) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);

    try {
      const payload = jwtService.verifyToken(token);
      req.user = payload;
      return next();
    } catch {
      // Token is invalid, continue without user
      return next();
    }
  };
}

/**
 * Session Management Middleware Factory
 */
export function createSessionMiddleware(
  authService: AuthService
): express.RequestHandler {
  const sessionConfig =
    authService.getSessionConfig() as session.SessionOptions;

  // Ensure we have a store - use memory store for testing
  if (!sessionConfig.store) {
    sessionConfig.store = new session.MemoryStore();
  }

  return session(sessionConfig);
}

/**
 * CORS Middleware
 */
export function corsMiddleware(config: AppConfig['cors']) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (config) {
      res.header('Access-Control-Allow-Origin', config.origin);
      res.header(
        'Access-Control-Allow-Credentials',
        config.credentials.toString()
      );
    }

    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }

    next();
  };
}

/**
 * Token Blacklist for Session Revocation
 * In production, this should be stored in Redis or database
 */
const blacklistedTokens = new Set<string>();

export function blacklistToken(token: string): void {
  blacklistedTokens.add(token);
}

export function isTokenBlacklisted(token: string): boolean {
  return blacklistedTokens.has(token);
}

/**
 * Enhanced JWT Authentication Middleware with Blacklist Support
 */
export function jwtAuthMiddlewareWithBlacklist(jwtService: JwtService) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);

    // Check if token is blacklisted
    if (isTokenBlacklisted(token)) {
      return next();
    }

    try {
      const payload = jwtService.verifyToken(token);
      req.user = payload;
      // Store token for potential blacklisting
      req.token = token;
      return next();
    } catch {
      // Token is invalid, continue without user
      return next();
    }
  };
}

/**
 * Create Express Application with Session Management
 */
export function createApp(config?: AppConfig): express.Application {
  const app = express();
  const authService = new AuthService();
  const jwtService = authService.getJwtService();

  // Basic middleware
  app.use(express.json());
  app.use(cookieParser());

  // CORS middleware
  if (config?.cors) {
    app.use(corsMiddleware(config.cors));
  }

  // Session middleware
  app.use(createSessionMiddleware(authService));

  // Passport initialization
  app.use(passport.initialize());
  app.use(passport.session());

  // JWT authentication middleware
  app.use(jwtAuthMiddlewareWithBlacklist(jwtService));

  // Logout route with session revocation
  app.post('/logout', (req: Request, res: Response) => {
    if (req.token) {
      blacklistToken(req.token);
    }

    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destroy error:', err);
        }
      });
    }

    res.clearCookie('test-session');
    res.json({ message: 'Logged out successfully' });
  });

  return app;
}

// Extend Express Request interface to include token
declare global {
  namespace Express {
    interface Request {
      token?: string;
    }
  }
}
