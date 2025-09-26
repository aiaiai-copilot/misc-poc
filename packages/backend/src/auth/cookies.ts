import cookieParser from 'cookie-parser';
import { Response } from 'express';
import { AuthConfig } from './config.js';

/**
 * Cookie-parser middleware configuration for secure cookie handling
 */
export function getCookieParserMiddleware(
  config: AuthConfig
): ReturnType<typeof cookieParser> {
  // Use session secret for cookie signing to ensure integrity
  return cookieParser(config.session.secret);
}

/**
 * Cookie security configuration for signed cookies
 */
export interface CookieSecurityOptions {
  signed?: boolean;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none' | boolean;
  domain?: string;
  path?: string;
  maxAge?: number;
}

/**
 * Get secure cookie options based on environment and configuration
 */
export function getSecureCookieOptions(
  config: AuthConfig,
  overrides: Partial<CookieSecurityOptions> = {}
): CookieSecurityOptions {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    signed: true, // Enable cookie signing for integrity protection
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    domain: config.session.domain,
    path: config.session.path,
    maxAge: config.session.maxAge,
    ...overrides,
  };
}

/**
 * Helper to set a secure signed cookie
 */
export function setSecureCookie(
  res: Response,
  name: string,
  value: string,
  config: AuthConfig,
  options: Partial<CookieSecurityOptions> = {}
): void {
  const cookieOptions = getSecureCookieOptions(config, options);
  res.cookie(name, value, cookieOptions);
}

/**
 * Helper to clear a secure cookie
 */
export function clearSecureCookie(
  res: Response,
  name: string,
  config: AuthConfig,
  options: Partial<CookieSecurityOptions> = {}
): void {
  const cookieOptions = getSecureCookieOptions(config, options);
  // Remove maxAge when clearing cookies
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { maxAge, ...clearOptions } = cookieOptions;
  res.clearCookie(name, clearOptions);
}
