import passport from 'passport';
import { AuthConfig, loadAuthConfig } from './config.js';
import { JwtService } from './jwt.js';
import {
  configureGoogleStrategy,
  GoogleAuthCallback,
} from './strategies/google.js';
import { configureJwtStrategy, JwtAuthCallback } from './strategies/jwt.js';
import {
  getSessionConfig,
  requireAuth,
  optionalAuth,
  logout,
} from './session.js';
import {
  getCookieParserMiddleware,
  getSecureCookieOptions,
  setSecureCookie,
  clearSecureCookie,
} from './cookies.js';
import type { CookieSecurityOptions } from './cookies.js';

export {
  loadAuthConfig,
  JwtService,
  getSessionConfig,
  requireAuth,
  optionalAuth,
  logout,
  getCookieParserMiddleware,
  getSecureCookieOptions,
  setSecureCookie,
  clearSecureCookie,
};

export type {
  AuthConfig,
  GoogleAuthCallback,
  JwtAuthCallback,
  CookieSecurityOptions,
};

export class AuthService {
  private config: AuthConfig;
  private jwtService: JwtService;

  constructor(config?: AuthConfig) {
    this.config = config || loadAuthConfig();
    this.jwtService = new JwtService(this.config);
  }

  /**
   * Initialize Passport.js with strategies
   */
  initializePassport(
    googleCallback: GoogleAuthCallback,
    jwtCallback: JwtAuthCallback
  ): void {
    // Configure strategies
    configureGoogleStrategy(this.config, googleCallback);
    configureJwtStrategy(this.config, jwtCallback);

    // Serialize/deserialize user for session
    passport.serializeUser(
      (
        user: { id?: string; userId?: string },
        done: (err: Error | null, id?: string) => void
      ) => {
        done(null, user.id || user.userId);
      }
    );

    passport.deserializeUser(
      async (
        id: string,
        done: (err: Error | null, user?: { id: string } | false) => void
      ) => {
        try {
          // This should be implemented to fetch user from database
          // For now, we'll just pass the ID
          done(null, { id });
        } catch (error) {
          done(error as Error, false);
        }
      }
    );
  }

  /**
   * Get JWT service instance
   */
  getJwtService(): JwtService {
    return this.jwtService;
  }

  /**
   * Get auth configuration
   */
  getConfig(): AuthConfig {
    return this.config;
  }

  /**
   * Get session configuration for Express
   */
  getSessionConfig(): object {
    return getSessionConfig(this.config);
  }
}

// Export a default instance
export const authService = new AuthService();
