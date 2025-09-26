import { JwtService, JwtPayload } from '../jwt.js';
import { AuthConfig } from '../config.js';

describe('JwtService', () => {
  let jwtService: JwtService;
  let mockConfig: AuthConfig;

  beforeEach(() => {
    mockConfig = {
      jwt: {
        secret: 'test-secret',
        expiresIn: '1h',
        issuer: 'test-issuer',
      },
      google: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        callbackUrl: '/test/callback',
      },
      session: {
        secret: 'test-session-secret',
        name: 'test-session',
        maxAge: 3600000,
      },
    };
    jwtService = new JwtService(mockConfig);
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const payload: Omit<JwtPayload, 'iat' | 'exp' | 'iss'> = {
        userId: 'user123',
        email: 'test@example.com',
      };

      const token = jwtService.generateToken(payload);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include payload data in token', () => {
      const payload: Omit<JwtPayload, 'iat' | 'exp' | 'iss'> = {
        userId: 'user123',
        email: 'test@example.com',
      };

      const token = jwtService.generateToken(payload);
      const decoded = jwtService.verifyToken(token);

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.iss).toBe(mockConfig.jwt.issuer);
    });

    it('should create token with proper expiration handling', () => {
      const payload: Omit<JwtPayload, 'iat' | 'exp' | 'iss'> = {
        userId: 'user123',
        email: 'test@example.com',
      };

      const token = jwtService.generateToken(payload);
      const decoded = jwtService.verifyToken(token);

      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(typeof decoded.exp).toBe('number');
      expect(typeof decoded.iat).toBe('number');
      expect(decoded.exp).toBeGreaterThan(decoded.iat!);
    });
  });

  describe('verifyToken', () => {
    it('should verify and decode a valid token', () => {
      const payload: Omit<JwtPayload, 'iat' | 'exp' | 'iss'> = {
        userId: 'user123',
        email: 'test@example.com',
      };

      const token = jwtService.generateToken(payload);
      const decoded = jwtService.verifyToken(token);

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    it('should throw error for invalid token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => jwtService.verifyToken(invalidToken)).toThrow(
        'Invalid token'
      );
    });

    it('should validate token signature and reject tokens signed with wrong secret', () => {
      // Create a token with the correct service
      const payload: Omit<JwtPayload, 'iat' | 'exp' | 'iss'> = {
        userId: 'user123',
        email: 'test@example.com',
      };
      const token = jwtService.generateToken(payload);

      // Create a different service with a different secret
      const wrongConfig = { ...mockConfig };
      wrongConfig.jwt.secret = 'wrong-secret';
      const wrongSecretService = new JwtService(wrongConfig);

      // Verify that the token is rejected with the wrong secret
      expect(() => wrongSecretService.verifyToken(token)).toThrow(
        'Invalid token'
      );
    });
  });

  describe('decodeToken', () => {
    it('should decode token without verification', () => {
      const payload: Omit<JwtPayload, 'iat' | 'exp' | 'iss'> = {
        userId: 'user123',
        email: 'test@example.com',
      };

      const token = jwtService.generateToken(payload);
      const decoded = jwtService.decodeToken(token);

      expect(decoded).toBeDefined();
      expect(decoded!.userId).toBe(payload.userId);
      expect(decoded!.email).toBe(payload.email);
    });

    it('should return null for invalid token format', () => {
      const invalidToken = 'completely-invalid-token';
      const decoded = jwtService.decodeToken(invalidToken);
      expect(decoded).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for valid non-expired token', () => {
      const payload: Omit<JwtPayload, 'iat' | 'exp' | 'iss'> = {
        userId: 'user123',
        email: 'test@example.com',
      };

      const token = jwtService.generateToken(payload);
      expect(jwtService.isTokenExpired(token)).toBe(false);
    });

    it('should return true for expired token', () => {
      // Create a service with very short expiration
      const shortExpiryConfig = { ...mockConfig };
      shortExpiryConfig.jwt.expiresIn = '1ms';
      const shortExpiryService = new JwtService(shortExpiryConfig);

      const payload: Omit<JwtPayload, 'iat' | 'exp' | 'iss'> = {
        userId: 'user123',
        email: 'test@example.com',
      };

      const token = shortExpiryService.generateToken(payload);

      // Wait for token to expire
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(shortExpiryService.isTokenExpired(token)).toBe(true);
          resolve(undefined);
        }, 10);
      });
    });

    it('should return true for invalid token', () => {
      const invalidToken = 'invalid.token';
      expect(jwtService.isTokenExpired(invalidToken)).toBe(true);
    });
  });
});
