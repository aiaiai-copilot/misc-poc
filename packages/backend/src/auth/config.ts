import { validateEnv, getEnvVar, getNumberEnvVar } from '../utils/env.js';

/**
 * Authentication configuration for OAuth and JWT
 */
export interface AuthConfig {
  jwt: {
    secret: string;
    expiresIn: string;
    issuer: string;
  };
  google: {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
  };
  session: {
    secret: string;
    name: string;
    maxAge: number;
  };
}

/**
 * Load authentication configuration from environment variables
 */
export function loadAuthConfig(): AuthConfig {
  const requiredEnvVars = [
    'JWT_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'SESSION_SECRET',
  ];

  // Validate required environment variables
  validateEnv(requiredEnvVars);

  return {
    jwt: {
      secret: getEnvVar('JWT_SECRET', undefined, true),
      expiresIn: getEnvVar('JWT_EXPIRES_IN', '24h'),
      issuer: getEnvVar('JWT_ISSUER', 'misc-poc-backend'),
    },
    google: {
      clientId: getEnvVar('GOOGLE_CLIENT_ID', undefined, true),
      clientSecret: getEnvVar('GOOGLE_CLIENT_SECRET', undefined, true),
      callbackUrl: getEnvVar('GOOGLE_CALLBACK_URL', '/auth/google/callback'),
    },
    session: {
      secret: getEnvVar('SESSION_SECRET', undefined, true),
      name: getEnvVar('SESSION_NAME', 'misc-poc-session'),
      maxAge: getNumberEnvVar('SESSION_MAX_AGE', 86400000), // 24 hours default
    },
  };
}
