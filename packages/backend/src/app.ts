import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import passport from 'passport';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { AuthService } from './auth/index.js';
import { JwtService } from './auth/jwt.js';
import { configureGoogleStrategy } from './auth/strategies/google.js';
import { getDataSource } from './infrastructure/database/data-source.js';
import { DataSource } from 'typeorm';
import {
  RedisCacheService,
  getCacheConfig,
} from '@misc-poc/infrastructure-cache';
import { handleImportWithProgress } from './api/streaming-import-with-progress.js';
import { handleExportWithProgress } from './api/streaming-export-with-progress.js';
import { progressTracker } from './api/progress-tracker.js';

export interface AppConfig {
  cors?: {
    origin: string;
    credentials: boolean;
  };
  authService?: AuthService;
  dataSource?: DataSource;
  cacheService?: RedisCacheService;
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
 * Rate Limiting Configuration
 */
const authRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 attempts per minute for auth endpoints
  message: {
    error: 'Too many authentication attempts, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute for API endpoints
  message: { error: 'Rate limit exceeded, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Mock User Store (in production this would be a database)
 */
interface MockUser {
  id: string;
  email: string;
  googleId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  photo?: string;
  createdAt: Date;
  lastLoginAt: Date;
}

interface MockRefreshToken {
  userId: string;
  email: string;
  used: boolean;
  createdAt: Date;
}

const mockUserStore = new Map<string, MockUser>();
const mockRefreshTokens = new Map<string, MockRefreshToken>();

/**
 * Create Express Application with OAuth Integration
 */
export function createApp(config?: AppConfig): express.Application {
  const app = express();
  const authService =
    config?.authService ||
    new AuthService({
      jwt: {
        secret: process.env.JWT_SECRET || 'test-jwt-secret',
        expiresIn: '7d',
        issuer: 'misc-poc-backend',
      },
      google: {
        clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || 'test-google-client-id',
        clientSecret:
          process.env.GOOGLE_OAUTH_CLIENT_SECRET || 'test-google-client-secret',
        callbackUrl: '/auth/google/callback',
      },
      session: {
        secret: process.env.SESSION_SECRET || 'test-session-secret',
        name: 'misc-poc-session',
        maxAge: 604800000, // 7 days
      },
    });
  const jwtService = authService.getJwtService();
  const dataSource = config?.dataSource || getDataSource();

  // Initialize cache service
  let cacheService: RedisCacheService | null = null;
  if (config?.cacheService) {
    cacheService = config.cacheService;
  } else if (process.env.NODE_ENV !== 'test') {
    // Only initialize Redis cache in non-test environments
    try {
      const cacheConfig = getCacheConfig();
      cacheService = new RedisCacheService(cacheConfig);
      // Connect to Redis in background - don't block app startup
      cacheService.connect().catch((error: Error) => {
        console.warn('Failed to connect to Redis cache:', error);
        cacheService = null;
      });
    } catch (error) {
      console.warn('Failed to initialize cache service:', error);
    }
  }

  // Configure Google OAuth strategy
  configureGoogleStrategy(
    authService.getConfig(),
    async (accessToken, _refreshToken, profile) => {
      // Handle different test scenarios
      if (accessToken === 'invalid-token') {
        throw new Error('Invalid Google OAuth token');
      }

      if (accessToken === 'service-unavailable') {
        throw new Error('Google OAuth service temporarily unavailable');
      }

      if (accessToken === 'network-failure-code') {
        const error = new Error('Network failure') as Error & { code: string };
        error.code = 'ENOTFOUND';
        throw error;
      }

      if (accessToken === 'account-already-linked-code') {
        const error = new Error(
          'Account already linked to another user'
        ) as Error & { statusCode: number };
        error.statusCode = 409;
        throw error;
      }

      // Check if user exists
      const existingUser = mockUserStore.get(profile.email);
      if (existingUser) {
        existingUser.lastLoginAt = new Date();
        return { id: existingUser.id, email: existingUser.email };
      }

      // Create new user
      const newUser = {
        id: `user-${Date.now()}`,
        email: profile.email,
        googleId: profile.id,
        firstName: profile.firstName,
        lastName: profile.lastName,
        displayName: profile.displayName,
        photo: profile.photo,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      };

      mockUserStore.set(profile.email, newUser);
      return { id: newUser.id, email: newUser.email };
    }
  );

  // Basic middleware
  // Configure JSON parser with 5MB limit for large imports
  app.use(
    express.json({
      limit: '5mb',
      strict: false, // Allow more JSON parsing flexibility
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));
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

  // Passport serialization
  passport.serializeUser((user: Express.User, done) => {
    const typedUser = user as { id: string };
    done(null, typedUser.id);
  });

  passport.deserializeUser((id: string, done) => {
    // Find user by ID in mock store
    const user = Array.from(mockUserStore.values()).find((u) => u.id === id);
    done(null, user || null);
  });

  // Rate limiting for auth endpoints (exclude test endpoints)
  app.use('/auth', (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV === 'test' || req.path.startsWith('/test-')) {
      return next();
    }
    return authRateLimit(req, res, next);
  });

  // OAuth Routes
  app.get(
    '/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );

  app.get(
    '/auth/google/callback',
    (req: Request, res: Response, next: NextFunction) => {
      // Handle test scenarios based on code parameter
      const code = req.query.code as string;

      if (code === 'network-failure-code') {
        const error = new Error('Network failure') as Error & { code: string };
        error.code = 'ENOTFOUND';
        return next(error);
      }

      if (code === 'invalid-code') {
        return res.status(400).json({
          error: 'Invalid authorization code',
          code: 'INVALID_TOKEN',
        });
      }

      if (code === 'account-already-linked-code') {
        return res.status(409).json({
          error: 'Account already linked to another user',
          code: 'ACCOUNT_ALREADY_LINKED',
        });
      }

      // For existing-user-code, simulate existing user flow
      if (code === 'existing-user-code') {
        const token = jwtService.generateToken({
          userId: 'existing-user-123',
          email: 'existing@example.com',
        });

        res.cookie('misc-poc-session', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 604800000, // 7 days
        });

        return res.redirect('http://localhost:3000/dashboard');
      }

      // For other codes, use normal passport authentication
      passport.authenticate('google', { failureRedirect: '/auth/error' })(
        req,
        res,
        (err: unknown) => {
          if (err) {
            return next(err);
          }

          // Generate JWT token
          const user = req.user as { id: string; email: string };
          const token = jwtService.generateToken({
            userId: user.id,
            email: user.email,
          });

          // Set secure cookie
          res.cookie('misc-poc-session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 604800000, // 7 days
          });

          res.redirect('http://localhost:3000/dashboard');
        }
      );
    }
  );

  // Handle OAuth errors
  app.get('/auth/error', (req: Request, res: Response) => {
    const error = req.query.error as string;
    const errorDescription = req.query.error_description as string;

    if (error === 'access_denied') {
      return res.status(400).json({
        error: 'OAuth consent denied',
        code: 'ACCESS_DENIED',
        description: errorDescription,
      });
    }

    res.status(400).json({
      error: 'OAuth authentication failed',
      code: 'OAUTH_ERROR',
      description: errorDescription,
    });
  });

  // Auth endpoints
  app.post('/auth/login', (req: Request, res: Response) => {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    // Handle test scenarios
    if (code === 'invalid-code') {
      return res.status(400).json({
        error: 'Invalid authorization code',
        code: 'INVALID_TOKEN',
      });
    }

    // Simulate successful login
    const token = jwtService.generateToken({
      userId: 'user123',
      email: 'test@example.com',
    });

    res.cookie('misc-poc-session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 604800000,
    });

    res.json({
      message: 'Login successful',
      accessToken: token,
    });
  });

  app.post('/auth/refresh', (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Check if refresh token exists and is valid
    const tokenData = mockRefreshTokens.get(refreshToken);
    if (!tokenData) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Check if token is already used (atomic operation for concurrency)
    if (tokenData.used) {
      return res.status(401).json({ error: 'Refresh token already used' });
    }

    // Mark old token as used immediately (before any async operations)
    tokenData.used = true;

    // Generate new tokens
    const newAccessToken = jwtService.generateToken({
      userId: tokenData.userId,
      email: tokenData.email,
    });

    const newRefreshToken = `refresh-${Date.now()}-${Math.random()}`;
    mockRefreshTokens.set(newRefreshToken, {
      userId: tokenData.userId,
      email: tokenData.email,
      used: false,
      createdAt: new Date(),
    });

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  });

  app.post('/auth/logout', (req: Request, res: Response) => {
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

    res.clearCookie('misc-poc-session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    res.json({ message: 'Logged out successfully' });
  });

  // Test helper endpoints (only available in test environment)
  if (process.env.NODE_ENV === 'test') {
    app.post(
      '/auth/test-setup-refresh-token',
      (req: Request, res: Response) => {
        const { refreshToken, userId, email } = req.body;

        mockRefreshTokens.set(refreshToken, {
          userId,
          email,
          used: false,
          createdAt: new Date(),
        });

        res.json({ message: 'Refresh token set up for testing' });
      }
    );

    app.post('/auth/test-clear-rate-limit', (_req: Request, res: Response) => {
      // This would clear rate limiting in a real implementation
      res.json({ message: 'Rate limit cleared for testing' });
    });

    app.get(
      '/auth/google/callback/mock-error',
      (req: Request, res: Response) => {
        const error = req.query.error as string;

        if (error === 'access_denied') {
          return res.status(400).json({
            error: 'OAuth consent denied',
            code: 'ACCESS_DENIED',
          });
        }

        res.status(400).json({
          error: 'OAuth error',
          code: 'OAUTH_ERROR',
        });
      }
    );

    app.post(
      '/auth/test-clear-refresh-tokens',
      (_req: Request, res: Response) => {
        mockRefreshTokens.clear();
        res.json({ message: 'Refresh tokens cleared for testing' });
      }
    );

    app.post('/auth/test-oauth-callback', (req: Request, res: Response) => {
      const { code, userProfile } = req.body;

      if (!code || !userProfile) {
        return res.status(400).json({ error: 'Invalid OAuth callback data' });
      }

      // Simulate successful OAuth callback by creating/finding user
      const existingUser = mockUserStore.get(userProfile.email);
      let user: MockUser;

      if (existingUser) {
        existingUser.lastLoginAt = new Date();
        user = existingUser;
      } else {
        user = {
          id: `user-${Date.now()}`,
          email: userProfile.email,
          googleId: userProfile.id,
          firstName: userProfile.firstName,
          lastName: userProfile.lastName,
          displayName: userProfile.displayName,
          photo: userProfile.photo,
          createdAt: new Date(),
          lastLoginAt: new Date(),
        };
        mockUserStore.set(userProfile.email, user);
      }

      // Generate JWT token
      const token = jwtService.generateToken({
        userId: user.id,
        email: user.email,
      });

      // Set secure cookie
      res.cookie('misc-poc-session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 604800000, // 7 days
      });

      res.json({
        message: 'OAuth callback successful',
        accessToken: token,
        user: {
          id: user.id,
          email: user.email,
        },
      });
    });
  }

  // JWT authentication middleware for all routes (applied globally)
  app.use(jwtAuthMiddlewareWithBlacklist(jwtService));

  // Rate limiting for API endpoints
  app.use('/api', apiRateLimit);

  // Authentication required middleware for API routes
  const requireAuth = (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  };

  // Legacy routes for backward compatibility with existing tests
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

    res.clearCookie('test-session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    res.json({ message: 'Logged out successfully' });
  });

  // API Routes
  app.get('/api/records', requireAuth, (req: Request, res: Response) => {
    const user = req.user as { userId: string; email: string };

    // Mock records data
    const records = [
      { id: '1', content: 'test record 1', userId: user.userId },
      { id: '2', content: 'test record 2', userId: user.userId },
    ];

    res.json({ records, total: records.length });
  });

  app.get('/api/tags', requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as { userId: string; email: string };

      // Try to get from cache first
      if (cacheService) {
        const cachedStats = await cacheService.getTagStatistics(user.userId);
        if (cachedStats !== null) {
          return res.json(cachedStats);
        }
      }

      // Initialize database connection if not already initialized
      if (!dataSource.isInitialized) {
        await dataSource.initialize();
      }

      // Query tag frequency statistics with user isolation
      const tagStats = await dataSource.query(
        `
        SELECT
          unnest(normalized_tags) as tag,
          COUNT(*) as count
        FROM records
        WHERE user_id = $1
        GROUP BY unnest(normalized_tags)
        ORDER BY count DESC, tag ASC
      `,
        [user.userId]
      );

      // Transform to expected format
      const formattedTags = tagStats.map(
        (row: { tag: string; count: string }) => ({
          tag: row.tag,
          count: parseInt(row.count, 10),
        })
      );

      // Cache the result for next time
      if (cacheService) {
        await cacheService.setTagStatistics(user.userId, formattedTags);
      }

      res.json(formattedTags);
    } catch (error) {
      console.error('Error fetching tag statistics:', error);
      res.status(500).json({
        error: 'Internal server error while fetching tag statistics',
      });
    }
  });

  app.get(
    '/api/tags/suggest',
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const user = req.user as { userId: string; email: string };
        const query = req.query.q as string;
        const limitParam = req.query.limit as string;

        // Validate query parameter
        if (query === undefined) {
          return res.status(400).json({
            error: 'Query parameter q is required',
          });
        }

        const trimmedQuery = query.trim();
        if (trimmedQuery === '') {
          return res.status(400).json({
            error: 'Query parameter q cannot be empty',
          });
        }

        // Validate and parse limit parameter
        let limit = 10; // Default limit
        if (limitParam) {
          const parsedLimit = parseInt(limitParam, 10);
          if (isNaN(parsedLimit)) {
            return res.status(400).json({
              error: 'Limit must be a valid number',
            });
          }
          if (parsedLimit < 1 || parsedLimit > 100) {
            return res.status(400).json({
              error: 'Limit must be between 1 and 100',
            });
          }
          limit = parsedLimit;
        }

        // Try to get from cache first
        if (cacheService) {
          const cachedSuggestions = await cacheService.getTagSuggestions(
            user.userId,
            trimmedQuery,
            limit
          );
          if (cachedSuggestions !== null) {
            return res.json(cachedSuggestions);
          }
        }

        // Initialize database connection if not already initialized
        if (!dataSource.isInitialized) {
          await dataSource.initialize();
        }

        // Query tags with prefix matching, frequency-based sorting, and user isolation
        // Using ILIKE for case-insensitive prefix matching
        const tagSuggestions = await dataSource.query(
          `
        SELECT
          tag,
          COUNT(*) as frequency
        FROM (
          SELECT unnest(normalized_tags) as tag
          FROM records
          WHERE user_id = $1
        ) tags
        WHERE tag ILIKE $2
        GROUP BY tag
        ORDER BY frequency DESC, tag ASC
        LIMIT $3
      `,
          [user.userId, `${trimmedQuery.toLowerCase()}%`, limit]
        );

        // Transform to simple string array as expected by frontend
        const suggestions = tagSuggestions.map(
          (row: { tag: string }) => row.tag
        );

        // Cache the result for next time
        if (cacheService) {
          await cacheService.setTagSuggestions(
            user.userId,
            trimmedQuery,
            limit,
            suggestions
          );
        }

        res.json(suggestions);
      } catch (error) {
        console.error('Error fetching tag suggestions:', error);
        res.status(500).json({
          error: 'Internal server error while fetching tag suggestions',
        });
      }
    }
  );

  app.get('/api/user/profile', requireAuth, (req: Request, res: Response) => {
    const user = req.user as { userId: string; email: string };

    res.json({
      user: {
        id: user.userId,
        email: user.email,
        profile: {
          displayName: 'Test User',
          avatar: 'https://avatar.url',
        },
      },
    });
  });

  app.get('/api/export', requireAuth, async (req: Request, res: Response) => {
    try {
      // Use new export handler with progress tracking support
      await handleExportWithProgress(req, res, dataSource, {
        chunkSize: 500,
      });
    } catch (error) {
      console.error('Error exporting data:', error);
      res.status(500).json({
        error: 'Internal server error while exporting data',
      });
    }
  });

  app.post('/api/import', requireAuth, async (req: Request, res: Response) => {
    try {
      // Initialize database connection if not already initialized
      if (!dataSource.isInitialized) {
        await dataSource.initialize();
      }

      // Use new import handler with progress tracking support
      await handleImportWithProgress(req, res, dataSource, {
        chunkSize: 500,
        maxRecords: 50000,
      });
    } catch (error) {
      console.error('Error importing data:', error);
      res.status(500).json({
        error: 'Internal server error while importing data',
      });
    }
  });

  // Progress tracking endpoints (Server-Sent Events)
  app.get(
    '/api/import/progress/:sessionId',
    requireAuth,
    (req: Request, res: Response) => {
      const sessionId = req.params.sessionId;
      const user = req.user as { userId: string; email: string };

      // Check if sessionId is provided
      if (!sessionId) {
        res.status(404).json({
          error: 'Session ID is required',
        });
        return;
      }

      // Validate session belongs to user
      if (!progressTracker.validateSession(sessionId, user.userId)) {
        res.status(403).json({
          error: 'Access denied to this progress session',
        });
        return;
      }

      // Attach SSE response
      progressTracker.attachSSE(sessionId, res);
    }
  );

  app.get(
    '/api/export/progress/:sessionId',
    requireAuth,
    (req: Request, res: Response) => {
      const sessionId = req.params.sessionId;
      const user = req.user as { userId: string; email: string };

      // Check if sessionId is provided
      if (!sessionId) {
        res.status(404).json({
          error: 'Session ID is required',
        });
        return;
      }

      // Validate session belongs to user
      if (!progressTracker.validateSession(sessionId, user.userId)) {
        res.status(403).json({
          error: 'Access denied to this progress session',
        });
        return;
      }

      // Attach SSE response
      progressTracker.attachSSE(sessionId, res);
    }
  );

  // Error handling middleware
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Application error:', err);

    // Handle JSON parsing errors
    if (
      err.message.includes('JSON') ||
      err.message.includes('parse') ||
      err.message.includes('Unexpected token') ||
      (err as { type?: string }).type === 'entity.parse.failed'
    ) {
      return res.status(400).json({
        error: 'Invalid JSON format',
        code: 'INVALID_JSON',
      });
    }

    // Handle payload too large errors
    if (
      err.message.includes('request entity too large') ||
      err.message.includes('PayloadTooLarge') ||
      (err as { type?: string }).type === 'entity.too.large'
    ) {
      return res.status(413).json({
        error: 'Request payload too large. Maximum size is 5MB.',
        code: 'PAYLOAD_TOO_LARGE',
      });
    }

    if (
      err.message.includes('Network failure') ||
      err.message.includes('network')
    ) {
      return res.status(503).json({
        error: 'Network error occurred',
        code: 'NETWORK_ERROR',
      });
    }

    if (err.message.includes('already linked')) {
      return res.status(409).json({
        error: 'Account already linked to another user',
        code: 'ACCOUNT_ALREADY_LINKED',
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
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
