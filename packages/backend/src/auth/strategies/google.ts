import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { AuthConfig } from '../config.js';

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
          const googleProfile: GoogleProfile = {
            id: profile.id,
            email: profile.emails?.[0]?.value || '',
            firstName: profile.name?.givenName || '',
            lastName: profile.name?.familyName || '',
            displayName: profile.displayName,
            photo: profile.photos?.[0]?.value,
          };

          const user = await callback(accessToken, refreshToken, googleProfile);
          done(null, user);
        } catch (error) {
          done(error, false);
        }
      }
    )
  );
}
