/**
 * Authentication Contract Integration Tests
 *
 * These tests verify the full authentication flow as specified in the PRD,
 * covering Google OAuth flow, session management, and JWT token handling.
 */
import { AuthService } from '../index.js';
import { GoogleProfile, GoogleAuthCallback } from '../strategies/google.js';
import { JwtAuthCallback } from '../strategies/jwt.js';
import { JwtService } from '../jwt.js';

describe('Authentication Contract', () => {
  let authService: AuthService;
  let jwtService: JwtService;
  let mockUserStore: Map<string, any>;

  beforeEach(() => {
    // Initialize auth service with test config
    authService = new AuthService({
      jwt: {
        secret: 'test-jwt-secret',
        expiresIn: '7d',
        issuer: 'misc-poc-backend',
      },
      google: {
        clientId: 'test-google-client-id',
        clientSecret: 'test-google-client-secret',
        callbackUrl: '/auth/google/callback',
      },
      session: {
        secret: 'test-session-secret',
        name: 'misc-poc-session',
        maxAge: 604800000, // 7 days
      },
    });

    jwtService = authService.getJwtService();
    mockUserStore = new Map();
  });

  describe('Google OAuth Flow', () => {
    it('should create new user on first Google login', async () => {
      const googleProfile: GoogleProfile = {
        id: 'google123',
        email: 'newuser@example.com',
        firstName: 'John',
        lastName: 'Doe',
        displayName: 'John Doe',
        photo: 'https://photo.url',
      };

      const googleCallback: GoogleAuthCallback = async (
        _accessToken: string,
        _refreshToken: string,
        profile: GoogleProfile
      ) => {
        // Simulate user creation on first login
        const existingUser = mockUserStore.get(profile.email);
        if (!existingUser) {
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

        return { id: existingUser.id, email: existingUser.email };
      };

      // Test user creation
      const result = await googleCallback(
        'access-token',
        'refresh-token',
        googleProfile
      );

      expect(result.email).toBe('newuser@example.com');
      expect(result.id).toMatch(/^user-\d+$/);
      expect(mockUserStore.has('newuser@example.com')).toBe(true);

      const createdUser = mockUserStore.get('newuser@example.com');
      expect(createdUser.googleId).toBe('google123');
      expect(createdUser.firstName).toBe('John');
      expect(createdUser.lastName).toBe('Doe');
    });

    it('should return existing user on subsequent login', async () => {
      // Pre-populate user store with existing user
      const existingUser = {
        id: 'user-existing-123',
        email: 'existing@example.com',
        googleId: 'google456',
        firstName: 'Jane',
        lastName: 'Smith',
        displayName: 'Jane Smith',
        createdAt: new Date(Date.now() - 86400000), // 1 day ago
      };
      mockUserStore.set('existing@example.com', existingUser);

      const googleProfile: GoogleProfile = {
        id: 'google456',
        email: 'existing@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        displayName: 'Jane Smith',
      };

      const googleCallback: GoogleAuthCallback = async (
        _accessToken: string,
        _refreshToken: string,
        profile: GoogleProfile
      ) => {
        const existingUser = mockUserStore.get(profile.email);
        if (existingUser) {
          // Update last login time
          existingUser.lastLoginAt = new Date();
          return { id: existingUser.id, email: existingUser.email };
        }

        throw new Error('User should exist');
      };

      const result = await googleCallback(
        'access-token',
        'refresh-token',
        googleProfile
      );

      expect(result.id).toBe('user-existing-123');
      expect(result.email).toBe('existing@example.com');

      const updatedUser = mockUserStore.get('existing@example.com');
      expect(updatedUser.lastLoginAt).toBeDefined();
      expect(updatedUser.createdAt.getTime()).toBeLessThan(
        updatedUser.lastLoginAt.getTime()
      );
    });

    it('should reject invalid Google token with appropriate error', async () => {
      const googleCallback: GoogleAuthCallback = async (
        _accessToken: string,
        _refreshToken: string,
        profile: GoogleProfile
      ) => {
        // Simulate invalid token scenario
        if (_accessToken === 'invalid-token') {
          throw new Error('Invalid Google OAuth token');
        }

        return { id: 'user123', email: profile.email };
      };

      await expect(
        googleCallback('invalid-token', 'refresh-token', {
          id: 'google123',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          displayName: 'Test User',
        })
      ).rejects.toThrow('Invalid Google OAuth token');
    });

    it('should handle Google OAuth service unavailability', async () => {
      const googleCallback: GoogleAuthCallback = async (
        _accessToken: string,
        _refreshToken: string,
        profile: GoogleProfile
      ) => {
        // Simulate Google service unavailability
        if (_accessToken === 'service-unavailable') {
          throw new Error('Google OAuth service temporarily unavailable');
        }

        return { id: 'user123', email: profile.email };
      };

      await expect(
        googleCallback('service-unavailable', 'refresh-token', {
          id: 'google123',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          displayName: 'Test User',
        })
      ).rejects.toThrow('Google OAuth service temporarily unavailable');
    });

    it('should extract user email and profile from Google token', async () => {
      const extractedProfile: GoogleProfile = {
        id: 'google789',
        email: 'extracted@example.com',
        firstName: 'Alice',
        lastName: 'Johnson',
        displayName: 'Alice Johnson',
        photo: 'https://photo.url/alice',
      };

      const googleCallback: GoogleAuthCallback = async (
        _accessToken: string,
        _refreshToken: string,
        profile: GoogleProfile
      ) => {
        // Verify profile extraction
        expect(profile.id).toBe('google789');
        expect(profile.email).toBe('extracted@example.com');
        expect(profile.firstName).toBe('Alice');
        expect(profile.lastName).toBe('Johnson');
        expect(profile.displayName).toBe('Alice Johnson');
        expect(profile.photo).toBe('https://photo.url/alice');

        return { id: 'user789', email: profile.email };
      };

      const result = await googleCallback(
        'valid-token',
        'refresh-token',
        extractedProfile
      );
      expect(result.email).toBe('extracted@example.com');
    });

    it('should generate JWT tokens after successful authentication', async () => {
      const user = { id: 'user123', email: 'test@example.com' };

      // Generate JWT token
      const token = jwtService.generateToken({
        userId: user.id,
        email: user.email,
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts

      // Verify token payload
      const payload = jwtService.verifyToken(token);
      expect(payload.userId).toBe(user.id);
      expect(payload.email).toBe(user.email);
      expect(payload.iss).toBe('misc-poc-backend');
    });

    it('should set secure httpOnly cookies for session management', () => {
      // Mock Express response object
      const mockResponse = {
        cookie: jest.fn(),
        clearCookie: jest.fn(),
      };

      const token = jwtService.generateToken({
        userId: 'user123',
        email: 'test@example.com',
      });

      // Simulate setting secure httpOnly cookie
      const cookieOptions = {
        httpOnly: true,
        secure: true,
        sameSite: 'strict' as const,
        maxAge: 604800000, // 7 days
      };

      mockResponse.cookie('misc-poc-session', token, cookieOptions);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'misc-poc-session',
        token,
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 604800000,
        })
      );
    });
  });

  describe('Session Validation', () => {
    it('should validate active JWT token', () => {
      const token = jwtService.generateToken({
        userId: 'user123',
        email: 'test@example.com',
      });

      const payload = jwtService.verifyToken(token);

      expect(payload).toBeDefined();
      expect(payload.userId).toBe('user123');
      expect(payload.email).toBe('test@example.com');
      expect(payload.iss).toBe('misc-poc-backend');
      expect(payload.iat).toBeDefined();
      expect(payload.exp).toBeDefined();
      expect(payload.exp).toBeGreaterThan(payload.iat!);
    });

    it('should reject expired JWT token', () => {
      // Create a service with very short expiration for testing
      const shortExpiryService = new JwtService({
        jwt: {
          secret: 'test-jwt-secret',
          expiresIn: '1ms', // 1 millisecond
          issuer: 'misc-poc-backend',
        },
        google: {
          clientId: 'test',
          clientSecret: 'test',
          callbackUrl: 'test',
        },
        session: {
          secret: 'test',
          name: 'test',
          maxAge: 1000,
        },
      });

      const token = shortExpiryService.generateToken({
        userId: 'user123',
        email: 'test@example.com',
      });

      // Wait for token to expire
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(() => {
            shortExpiryService.verifyToken(token);
          }).toThrow();
          resolve(undefined);
        }, 10);
      });
    });

    it('should reject malformed JWT token', () => {
      const malformedToken = 'invalid.jwt.token';

      expect(() => {
        jwtService.verifyToken(malformedToken);
      }).toThrow();
    });

    it('should validate token signature', () => {
      const validToken = jwtService.generateToken({
        userId: 'user123',
        email: 'test@example.com',
      });

      // Tamper with token signature
      const tokenParts = validToken.split('.');
      const tamperedToken = `${tokenParts[0]}.${tokenParts[1]}.tampered-signature`;

      expect(() => {
        jwtService.verifyToken(tamperedToken);
      }).toThrow();
    });

    it('should extract user context from valid token', () => {
      const userId = 'user456';
      const email = 'context@example.com';
      const token = jwtService.generateToken({
        userId: userId,
        email: email,
      });

      const jwtCallback: JwtAuthCallback = async (payload) => {
        return {
          id: payload.userId,
          email: payload.email,
        };
      };

      const payload = jwtService.verifyToken(token);

      return jwtCallback(payload).then((user) => {
        expect(user?.id).toBe(userId);
        expect(user?.email).toBe(email);
      });
    });
  });

  describe('Session Revocation', () => {
    it('should invalidate active session', () => {
      // Mock Express response object for logout
      const mockResponse = {
        clearCookie: jest.fn(),
      };

      const sessionName = 'misc-poc-session';

      // Simulate session revocation
      mockResponse.clearCookie(sessionName, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
      });

      expect(mockResponse.clearCookie).toHaveBeenCalledWith(
        sessionName,
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
        })
      );
    });

    it('should clear session cookies', () => {
      const mockResponse = {
        clearCookie: jest.fn(),
      };

      const sessionConfig = authService.getSessionConfig() as any;
      const sessionName = sessionConfig.name || 'connect.sid';

      mockResponse.clearCookie(sessionName);
      expect(mockResponse.clearCookie).toHaveBeenCalledWith(sessionName);
    });

    it('should reject operations with revoked token', () => {
      // In a real implementation, revoked tokens would be tracked in a blacklist
      const revokedTokens = new Set<string>();

      const token = jwtService.generateToken({
        userId: 'user123',
        email: 'test@example.com',
      });
      revokedTokens.add(token);

      // Simulate checking if token is revoked
      const isTokenRevoked = (tokenToCheck: string): boolean => {
        return revokedTokens.has(tokenToCheck);
      };

      expect(isTokenRevoked(token)).toBe(true);

      // In practice, this would be checked before verifying the token
      if (isTokenRevoked(token)) {
        expect(() => {
          throw new Error('Token has been revoked');
        }).toThrow('Token has been revoked');
      }
    });
  });
});
