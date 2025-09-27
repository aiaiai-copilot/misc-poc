import jwt from 'jsonwebtoken';
import { AuthConfig } from './config.js';

export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
  iss?: string;
}

export class JwtService {
  constructor(private config: AuthConfig) {}

  /**
   * Generate a JWT token for a user
   */
  generateToken(
    payload: Omit<JwtPayload, 'iat' | 'exp' | 'iss'>,
    options?: Partial<jwt.SignOptions>
  ): string {
    const signOptions = {
      expiresIn: this.config.jwt.expiresIn,
      issuer: this.config.jwt.issuer,
      ...options,
    } as jwt.SignOptions;

    return jwt.sign(payload, this.config.jwt.secret, signOptions);
  }

  /**
   * Verify and decode a JWT token
   */
  verifyToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, this.config.jwt.secret, {
        issuer: this.config.jwt.issuer,
      });

      if (typeof decoded === 'string') {
        throw new Error('Invalid token format');
      }

      return decoded as JwtPayload;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired');
      }
      throw error;
    }
  }

  /**
   * Decode a JWT token without verification (for debugging)
   */
  decodeToken(token: string): JwtPayload | null {
    try {
      const decoded = jwt.decode(token);
      return decoded as JwtPayload;
    } catch {
      return null;
    }
  }

  /**
   * Check if a token is expired
   */
  isTokenExpired(token: string): boolean {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) {
      return true;
    }

    return Date.now() >= decoded.exp * 1000;
  }
}
