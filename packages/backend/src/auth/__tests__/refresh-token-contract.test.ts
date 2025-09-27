/**
 * Refresh Token Rotation Contract Integration Tests
 *
 * These tests verify the refresh token rotation mechanism as specified in the PRD,
 * covering token generation, storage, rotation, blacklisting, and cleanup.
 *
 * Test specifications based on PRD section 4.1.2 Session Management:
 * - JWT tokens with 7-day expiration
 * - Refresh token rotation
 * - Secure httpOnly cookies
 * - Token blacklisting for security
 */

import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { RefreshTokenService } from '../refresh-token.js';
import { JwtService } from '../jwt.js';
import { RefreshToken } from '../entities/refresh-token.js';
import { AuthConfig } from '../config.js';
import crypto from 'crypto';

// Helper function to generate valid UUIDs for testing
const generateUUID = (): string => crypto.randomUUID();

describe('Refresh Token Rotation Contract', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let refreshTokenService: RefreshTokenService;
  let jwtService: JwtService;
  let authConfig: AuthConfig;

  beforeAll(async () => {
    // Start PostgreSQL container for integration tests
    container = await new PostgreSqlContainer('postgres:15').start();

    // Setup test auth config
    authConfig = {
      jwt: {
        secret: 'test-jwt-secret-for-refresh-tokens',
        expiresIn: '15m', // Short expiry for access tokens
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
    };

    // Setup DataSource with real database
    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getMappedPort(5432),
      database: container.getDatabase(),
      username: container.getUsername(),
      password: container.getPassword(),
      entities: [RefreshToken],
      synchronize: true, // Auto-create schema for tests
      logging: false,
    });

    await dataSource.initialize();

    // Initialize services
    jwtService = new JwtService(authConfig);
    refreshTokenService = new RefreshTokenService(dataSource, authConfig);
  }, 60000); // 60 second timeout for container startup

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  }, 60000); // 60 second timeout for container cleanup

  beforeEach(async () => {
    // Clean up refresh tokens before each test
    await dataSource.getRepository(RefreshToken).clear();
  });

  describe('Refresh Token Generation', () => {
    it('should generate cryptographically secure refresh token', async () => {
      const userId = generateUUID();
      const deviceId = 'device456';

      const refreshToken = await refreshTokenService.generateRefreshToken(
        userId,
        deviceId
      );

      expect(refreshToken).toBeDefined();
      expect(typeof refreshToken.token).toBe('string');
      expect(refreshToken.token.length).toBeGreaterThanOrEqual(32); // At least 32 chars for security
      expect(refreshToken.userId).toBe(userId);
      expect(refreshToken.deviceId).toBe(deviceId);
      expect(refreshToken.expiresAt).toBeInstanceOf(Date);
      expect(refreshToken.createdAt).toBeInstanceOf(Date);
      expect(refreshToken.isRevoked).toBe(false);
    });

    it('should generate unique tokens for each request', async () => {
      const userId = generateUUID();
      const deviceId = 'device456';

      const token1 = await refreshTokenService.generateRefreshToken(
        userId,
        deviceId
      );
      const token2 = await refreshTokenService.generateRefreshToken(
        userId,
        deviceId
      );

      expect(token1.token).not.toBe(token2.token);
      expect(token1.id).not.toBe(token2.id);
    });

    it('should set refresh token expiration to 30 days from creation', async () => {
      const userId = generateUUID();
      const deviceId = 'device456';
      const beforeGeneration = new Date();

      const refreshToken = await refreshTokenService.generateRefreshToken(
        userId,
        deviceId
      );

      const expectedExpiry = new Date(
        beforeGeneration.getTime() + 30 * 24 * 60 * 60 * 1000
      );
      const actualExpiry = refreshToken.expiresAt;

      // Allow 1 second tolerance for execution time
      expect(
        Math.abs(actualExpiry.getTime() - expectedExpiry.getTime())
      ).toBeLessThan(1000);
    });

    it('should store refresh token in database with proper fields', async () => {
      const userId = generateUUID();
      const deviceId = 'device456';

      const generatedToken = await refreshTokenService.generateRefreshToken(
        userId,
        deviceId
      );

      // Verify token was stored in database
      const storedToken = await dataSource
        .getRepository(RefreshToken)
        .findOne({ where: { token: generatedToken.token } });

      expect(storedToken).toBeDefined();
      expect(storedToken!.userId).toBe(userId);
      expect(storedToken!.deviceId).toBe(deviceId);
      expect(storedToken!.isRevoked).toBe(false);
      expect(storedToken!.createdAt).toBeInstanceOf(Date);
      expect(storedToken!.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('Token Rotation on Refresh', () => {
    it('should generate new access token and refresh token pair', async () => {
      const userId = generateUUID();
      const deviceId = 'device456';
      const email = 'test@example.com';

      // Generate initial refresh token
      const initialRefreshToken =
        await refreshTokenService.generateRefreshToken(userId, deviceId);

      // Perform token rotation
      const rotationResult = await refreshTokenService.rotateTokens(
        initialRefreshToken.token,
        { userId, email }
      );

      expect(rotationResult.accessToken).toBeDefined();
      expect(rotationResult.refreshToken).toBeDefined();
      expect(rotationResult.refreshToken).not.toBe(initialRefreshToken.token);

      // Verify new access token is valid
      const payload = jwtService.verifyToken(rotationResult.accessToken);
      expect(payload.userId).toBe(userId);
      expect(payload.email).toBe(email);
    });

    it('should revoke old refresh token when rotating', async () => {
      const userId = generateUUID();
      const deviceId = 'device456';
      const email = 'test@example.com';

      const initialRefreshToken =
        await refreshTokenService.generateRefreshToken(userId, deviceId);

      await refreshTokenService.rotateTokens(initialRefreshToken.token, {
        userId,
        email,
      });

      // Verify old token is revoked in database
      const oldToken = await dataSource
        .getRepository(RefreshToken)
        .findOne({ where: { token: initialRefreshToken.token } });

      expect(oldToken!.isRevoked).toBe(true);
      expect(oldToken!.revokedAt).toBeInstanceOf(Date);
    });

    it('should reject rotation with invalid refresh token', async () => {
      const invalidToken = 'invalid-refresh-token';

      await expect(
        refreshTokenService.rotateTokens(invalidToken, {
          userId: generateUUID(),
          email: 'test@example.com',
        })
      ).rejects.toThrow('Invalid refresh token');
    });

    it('should reject rotation with expired refresh token', async () => {
      const userId = generateUUID();
      const deviceId = 'device456';

      // Create an expired refresh token directly in database
      const expiredToken = await dataSource.getRepository(RefreshToken).save({
        token: crypto.randomBytes(32).toString('hex'),
        userId,
        deviceId,
        expiresAt: new Date(Date.now() - 86400000), // 1 day ago
        createdAt: new Date(Date.now() - 86400000),
        isRevoked: false,
      });

      await expect(
        refreshTokenService.rotateTokens(expiredToken.token, {
          userId,
          email: 'test@example.com',
        })
      ).rejects.toThrow('Refresh token expired');
    });

    it('should reject rotation with revoked refresh token', async () => {
      const userId = generateUUID();
      const deviceId = 'device456';

      const refreshToken = await refreshTokenService.generateRefreshToken(
        userId,
        deviceId
      );

      // Revoke the token
      await refreshTokenService.revokeRefreshToken(refreshToken.token);

      await expect(
        refreshTokenService.rotateTokens(refreshToken.token, {
          userId,
          email: 'test@example.com',
        })
      ).rejects.toThrow('Refresh token revoked');
    });
  });

  describe('Token Blacklisting for Security', () => {
    it('should revoke refresh token and mark as revoked', async () => {
      const userId = generateUUID();
      const deviceId = 'device456';

      const refreshToken = await refreshTokenService.generateRefreshToken(
        userId,
        deviceId
      );

      await refreshTokenService.revokeRefreshToken(refreshToken.token);

      // Verify token is marked as revoked
      const revokedToken = await dataSource
        .getRepository(RefreshToken)
        .findOne({ where: { token: refreshToken.token } });

      expect(revokedToken!.isRevoked).toBe(true);
      expect(revokedToken!.revokedAt).toBeInstanceOf(Date);
    });

    it('should revoke all refresh tokens for a user', async () => {
      const userId = generateUUID();

      // Generate multiple tokens for the user
      const token1 = await refreshTokenService.generateRefreshToken(
        userId,
        'device1'
      );
      const token2 = await refreshTokenService.generateRefreshToken(
        userId,
        'device2'
      );
      const token3 = await refreshTokenService.generateRefreshToken(
        userId,
        'device3'
      );

      await refreshTokenService.revokeAllUserRefreshTokens(userId);

      // Verify all tokens are revoked
      const userTokens = await dataSource
        .getRepository(RefreshToken)
        .find({ where: { userId } });

      expect(userTokens).toHaveLength(3);
      userTokens.forEach((token) => {
        expect(token.isRevoked).toBe(true);
        expect(token.revokedAt).toBeInstanceOf(Date);
      });
    });

    it('should revoke all refresh tokens for a specific device', async () => {
      const userId = generateUUID();
      const targetDeviceId = 'device456';

      await refreshTokenService.generateRefreshToken(userId, targetDeviceId);
      await refreshTokenService.generateRefreshToken(userId, targetDeviceId);
      await refreshTokenService.generateRefreshToken(userId, 'other-device');

      await refreshTokenService.revokeDeviceRefreshTokens(
        userId,
        targetDeviceId
      );

      // Verify only target device tokens are revoked
      const deviceTokens = await dataSource
        .getRepository(RefreshToken)
        .find({ where: { userId, deviceId: targetDeviceId } });

      const otherDeviceTokens = await dataSource
        .getRepository(RefreshToken)
        .find({ where: { userId, deviceId: 'other-device' } });

      deviceTokens.forEach((token) => {
        expect(token.isRevoked).toBe(true);
      });

      otherDeviceTokens.forEach((token) => {
        expect(token.isRevoked).toBe(false);
      });
    });

    it('should detect and revoke tokens on potential security breach', async () => {
      const userId = generateUUID();
      const deviceId = 'device456';

      const refreshToken = await refreshTokenService.generateRefreshToken(
        userId,
        deviceId
      );

      // Simulate security breach detection (e.g., token used from different IP)
      await refreshTokenService.handleSecurityBreach(
        userId,
        'suspicious_activity'
      );

      // Verify all user tokens are revoked
      const userTokens = await dataSource
        .getRepository(RefreshToken)
        .find({ where: { userId } });

      userTokens.forEach((token) => {
        expect(token.isRevoked).toBe(true);
        expect(token.revokedAt).toBeInstanceOf(Date);
      });
    });
  });

  describe('Automatic Cleanup of Expired Tokens', () => {
    it('should clean up expired refresh tokens', async () => {
      const userId = generateUUID();

      // Create expired tokens directly in database
      const expiredToken1 = await dataSource.getRepository(RefreshToken).save({
        token: crypto.randomBytes(32).toString('hex'),
        userId,
        deviceId: 'device1',
        expiresAt: new Date(Date.now() - 86400000), // 1 day ago
        createdAt: new Date(Date.now() - 86400000),
        isRevoked: false,
      });

      const expiredToken2 = await dataSource.getRepository(RefreshToken).save({
        token: crypto.randomBytes(32).toString('hex'),
        userId,
        deviceId: 'device2',
        expiresAt: new Date(Date.now() - 172800000), // 2 days ago
        createdAt: new Date(Date.now() - 172800000),
        isRevoked: false,
      });

      // Create a valid token that should not be cleaned up
      const validToken = await refreshTokenService.generateRefreshToken(
        userId,
        'device3'
      );

      // Run cleanup
      const cleanedCount = await refreshTokenService.cleanupExpiredTokens();

      expect(cleanedCount).toBe(2);

      // Verify expired tokens are deleted
      const remainingTokens = await dataSource
        .getRepository(RefreshToken)
        .find();

      expect(remainingTokens).toHaveLength(1);
      expect(remainingTokens[0].token).toBe(validToken.token);
    });

    it('should clean up revoked tokens older than retention period', async () => {
      const userId = generateUUID();
      const retentionDays = 30;

      // Create old revoked token
      const oldRevokedToken = await dataSource
        .getRepository(RefreshToken)
        .save({
          token: crypto.randomBytes(32).toString('hex'),
          userId,
          deviceId: 'device1',
          expiresAt: new Date(Date.now() + 86400000), // Still valid expiry
          createdAt: new Date(Date.now() - (retentionDays + 1) * 86400000),
          isRevoked: true,
          revokedAt: new Date(Date.now() - (retentionDays + 1) * 86400000),
        });

      // Create recent revoked token that should be kept
      const recentRevokedToken = await dataSource
        .getRepository(RefreshToken)
        .save({
          token: crypto.randomBytes(32).toString('hex'),
          userId,
          deviceId: 'device2',
          expiresAt: new Date(Date.now() + 86400000),
          createdAt: new Date(Date.now() - 86400000), // 1 day ago
          isRevoked: true,
          revokedAt: new Date(Date.now() - 86400000),
        });

      const cleanedCount =
        await refreshTokenService.cleanupRevokedTokens(retentionDays);

      expect(cleanedCount).toBe(1);

      // Verify only old revoked token was deleted
      const remainingTokens = await dataSource
        .getRepository(RefreshToken)
        .find();

      expect(remainingTokens).toHaveLength(1);
      expect(remainingTokens[0].token).toBe(recentRevokedToken.token);
    });

    it('should run periodic cleanup and return statistics', async () => {
      const userId = generateUUID();

      // Create various token states for cleanup testing
      await dataSource.getRepository(RefreshToken).save([
        {
          token: crypto.randomBytes(32).toString('hex'),
          userId,
          deviceId: 'device1',
          expiresAt: new Date(Date.now() - 86400000), // Expired
          createdAt: new Date(Date.now() - 86400000),
          isRevoked: false,
        },
        {
          token: crypto.randomBytes(32).toString('hex'),
          userId,
          deviceId: 'device2',
          expiresAt: new Date(Date.now() + 86400000), // Valid
          createdAt: new Date(Date.now() - 32 * 86400000), // Old revoked
          isRevoked: true,
          revokedAt: new Date(Date.now() - 32 * 86400000),
        },
      ]);

      const stats = await refreshTokenService.performPeriodicCleanup();

      expect(stats.expiredTokensRemoved).toBe(1);
      expect(stats.oldRevokedTokensRemoved).toBe(1);
      expect(stats.totalTokensRemoved).toBe(2);
      expect(stats.cleanupDate).toBeInstanceOf(Date);
    });
  });

  describe('Integration with JWT Token Flow', () => {
    it('should work with complete authentication flow', async () => {
      const userId = generateUUID();
      const email = 'test@example.com';
      const deviceId = 'device456';

      // Step 1: Generate initial token pair after OAuth login
      const initialRefreshToken =
        await refreshTokenService.generateRefreshToken(userId, deviceId);
      const initialAccessToken = jwtService.generateToken({ userId, email });

      // Step 2: Access token expires, use refresh token to get new pair
      const rotationResult = await refreshTokenService.rotateTokens(
        initialRefreshToken.token,
        { userId, email }
      );

      // Step 3: Verify new tokens work
      const newPayload = jwtService.verifyToken(rotationResult.accessToken);
      expect(newPayload.userId).toBe(userId);
      expect(newPayload.email).toBe(email);

      // Step 4: Old refresh token should be revoked
      await expect(
        refreshTokenService.rotateTokens(initialRefreshToken.token, {
          userId,
          email,
        })
      ).rejects.toThrow('Refresh token revoked');

      // Step 5: New refresh token should work
      const secondRotation = await refreshTokenService.rotateTokens(
        rotationResult.refreshToken,
        { userId, email }
      );

      expect(secondRotation.accessToken).toBeDefined();
      expect(secondRotation.refreshToken).not.toBe(rotationResult.refreshToken);
    });

    it('should handle logout by revoking all user refresh tokens', async () => {
      const userId = generateUUID();
      const deviceId = 'device456';

      // Generate multiple refresh tokens for different devices
      await refreshTokenService.generateRefreshToken(userId, 'device1');
      await refreshTokenService.generateRefreshToken(userId, 'device2');
      await refreshTokenService.generateRefreshToken(userId, 'device3');

      // Logout - revoke all user tokens
      await refreshTokenService.revokeAllUserRefreshTokens(userId);

      // Verify no valid tokens remain for the user
      const userTokens = await dataSource
        .getRepository(RefreshToken)
        .find({ where: { userId, isRevoked: false } });

      expect(userTokens).toHaveLength(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle concurrent token rotation attempts', async () => {
      const userId = generateUUID();
      const deviceId = 'device456';
      const email = 'test@example.com';

      const refreshToken = await refreshTokenService.generateRefreshToken(
        userId,
        deviceId
      );

      // Attempt concurrent rotations
      const rotationPromises = Array(3)
        .fill(null)
        .map(() =>
          refreshTokenService.rotateTokens(refreshToken.token, {
            userId,
            email,
          })
        );

      // Only one should succeed, others should fail
      const results = await Promise.allSettled(rotationPromises);

      const successful = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');

      expect(successful).toHaveLength(1);
      expect(failed).toHaveLength(2);
    });

    it('should handle database connection failures gracefully', async () => {
      // Close the database connection to simulate failure
      await dataSource.destroy();

      const userId = generateUUID();
      const deviceId = 'device456';

      await expect(
        refreshTokenService.generateRefreshToken(userId, deviceId)
      ).rejects.toThrow();

      // Reinitialize for other tests
      await dataSource.initialize();
    });

    it('should validate refresh token format', async () => {
      const invalidTokens = [
        '', // Empty string
        'short', // Too short
        'not-hex-characters!@#', // Invalid characters
        null, // Null
        undefined, // Undefined
      ];

      for (const invalidToken of invalidTokens) {
        await expect(
          refreshTokenService.rotateTokens(invalidToken as any, {
            userId: generateUUID(),
            email: 'test@example.com',
          })
        ).rejects.toThrow();
      }
    });
  });
});
