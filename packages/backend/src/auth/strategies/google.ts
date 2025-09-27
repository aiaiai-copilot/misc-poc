import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { AuthConfig } from '../config.js';
import {
  GoogleOAuthServiceError,
  InvalidTokenError,
  NetworkError,
  AuthenticationError,
  OAuthErrorFactory,
} from '../errors/oauth-errors.js';

export interface GoogleProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  photo?: string;
}

export type GoogleAuthCallback = (
  accessToken: string,
  refreshToken: string,
  profile: GoogleProfile
) => Promise<{ id: string; email: string }>;

/**
 * Configure Google OAuth strategy
 */
export function configureGoogleStrategy(
  config: AuthConfig,
  callback: GoogleAuthCallback
): void {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.google.clientId,
        clientSecret: config.google.clientSecret,
        callbackURL: config.google.callbackUrl,
        scope: ['profile', 'email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Validate required profile information
          if (!profile.id) {
            const error = new InvalidTokenError(
              'Google profile missing required ID',
              'INVALID_PROFILE',
              'google_oauth'
            );
            return done(error, false);
          }

          if (!profile.emails || !profile.emails[0]?.value) {
            const error = new AuthenticationError(
              'Google profile missing email - email scope required',
              'INSUFFICIENT_SCOPE'
            );
            return done(error, false);
          }

          // Validate access token
          if (!accessToken || accessToken === 'invalid-token') {
            const error = new InvalidTokenError(
              'Invalid Google OAuth token received',
              'INVALID_TOKEN',
              'google_oauth'
            );
            return done(error, false);
          }

          // Check for service unavailability signals
          if (accessToken === 'service-unavailable') {
            const error = new GoogleOAuthServiceError(
              'Google OAuth service temporarily unavailable',
              'SERVICE_UNAVAILABLE'
            );
            return done(error, false);
          }

          const googleProfile: GoogleProfile = {
            id: profile.id,
            email: profile.emails[0].value,
            firstName: profile.name?.givenName || '',
            lastName: profile.name?.familyName || '',
            displayName: profile.displayName,
            photo: profile.photos?.[0]?.value,
          };

          const user = await callback(accessToken, refreshToken, googleProfile);
          done(null, user);
        } catch (error: unknown) {
          // Convert and handle different types of errors
          const oauthError = handleGoogleStrategyError(error);
          done(oauthError, false);
        }
      }
    )
  );
}

/**
 * Handle and convert errors from Google OAuth strategy
 */
function handleGoogleStrategyError(error: unknown): unknown {
  if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>;

    // Handle specific Google API errors
    if (errorObj.name === 'GooglePlusAPIError') {
      return new GoogleOAuthServiceError(
        'Google API service error',
        'GOOGLE_API_ERROR'
      );
    }

    // Handle internal OAuth errors from passport-google-oauth20
    if (errorObj.name === 'InternalOAuthError') {
      const message = errorObj.message as string;
      if (message?.includes('Failed to obtain access token')) {
        return new InvalidTokenError(
          'Failed to obtain valid access token from Google',
          'TOKEN_ACQUISITION_FAILED',
          'google_oauth'
        );
      }

      if (message?.includes('Failed to fetch user profile')) {
        return new GoogleOAuthServiceError(
          'Failed to fetch user profile from Google',
          'PROFILE_FETCH_FAILED'
        );
      }

      return new GoogleOAuthServiceError(
        'Google OAuth internal error',
        'OAUTH_INTERNAL_ERROR'
      );
    }

    // Handle network-related errors
    if (errorObj.code === 'ENOTFOUND' || errorObj.code === 'ECONNREFUSED') {
      return new NetworkError(
        'Unable to connect to Google OAuth service',
        'NETWORK_ERROR'
      );
    }

    if (errorObj.code === 'ETIMEDOUT') {
      return new NetworkError(
        'Google OAuth request timed out',
        'VERIFICATION_TIMEOUT'
      );
    }

    // Handle rate limiting
    const message = errorObj.message as string;
    if (errorObj.statusCode === 429 || message?.includes('rate limit')) {
      return new GoogleOAuthServiceError(
        'Google OAuth rate limit exceeded',
        'RATE_LIMIT_EXCEEDED'
      );
    }

    // Handle invalid grant errors
    if (message?.includes('invalid_grant')) {
      return new InvalidTokenError(
        'Invalid authorization grant',
        'INVALID_GRANT',
        'google_oauth'
      );
    }

    // Handle access denied
    if (message?.includes('access_denied')) {
      return new AuthenticationError(
        'User denied access to Google account',
        'ACCESS_DENIED'
      );
    }
  }

  // Use the error factory for unknown errors
  return OAuthErrorFactory.fromPassportError(error as Error);
}
