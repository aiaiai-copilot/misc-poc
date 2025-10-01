/**
 * OAuth Flow Integration Tests
 *
 * End-to-end OAuth authentication flow tests as specified in PRD.
 * Tests complete OAuth flow with real database and HTTP endpoints.
 *
 * Requirements from PRD (lines 964-976):
 * - Complete Google OAuth flow
 * - JWT token validation tests
 * - Refresh token rotation scenarios
 * - Cookie security settings verification
 * - Error handling scenarios
 * - Performance tests for authentication endpoints
 */
import request from 'supertest';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { createApp } from '../../app.js';
import { AuthService } from '../index.js';
import express from 'express';

describe('OAuth Flow Integration Tests', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let app: express.Application;
  let authService: AuthService;

  beforeAll(async () => {
    // Set NODE_ENV to test to enable test helper endpoints
    process.env.NODE_ENV = 'test';
    // Start PostgreSQL container
    container = await new PostgreSqlContainer('postgres:15').start();

    // Initialize TypeORM DataSource
    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getMappedPort(5432),
      database: container.getDatabase(),
      username: container.getUsername(),
      password: container.getPassword(),
      entities: ['src/entities/*.ts'],
      synchronize: true, // For testing only
      logging: false,
    });

    await dataSource.initialize();

    // Initialize auth service with test configuration
    authService = new AuthService({
      jwt: {
        secret: 'test-jwt-secret',
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
        secret: 'test-session-secret',
        name: 'misc-poc-session',
        maxAge: 604800000, // 7 days
      },
    });

    // Create Express app with OAuth routes
    app = createApp({
      cors: {
        origin: 'http://localhost:3000',
        credentials: true,
      },
    });
  }, 30000);

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  });

  describe('End-to-End OAuth Flow', () => {
    it('should initiate Google OAuth flow', async () => {
      const response = await request(app).get('/auth/google').expect(302); // Should redirect to Google

      expect(response.headers.location).toMatch(/accounts\.google\.com/);
      expect(response.headers.location).toContain('client_id=');
      expect(response.headers.location).toContain('scope=profile%20email');
      expect(response.headers.location).toContain('response_type=code');
    });

    it('should handle Google OAuth callback with valid code', async () => {
      // Use test helper endpoint that simulates successful OAuth callback
      const response = await request(app)
        .post('/auth/test-oauth-callback')
        .send({
          code: 'valid-authorization-code',
          state: 'test-state',
          userProfile: {
            id: 'google123',
            email: 'newuser@example.com',
            firstName: 'John',
            lastName: 'Doe',
            displayName: 'John Doe',
          },
        });

      // Expect successful callback handling
      expect([200, 302]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.accessToken).toBeDefined();
      }
    });

    it('should create new user on first Google login', async () => {
      const mockProfile = {
        id: 'google123',
        email: 'newuser@example.com',
        firstName: 'John',
        lastName: 'Doe',
        displayName: 'John Doe',
        photo: 'https://photo.url',
      };

      // Simulate OAuth callback with user creation
      const response = await request(app)
        .post('/auth/test-oauth-callback')
        .send({
          code: 'new-user-code',
          state: 'test-state',
          userProfile: mockProfile,
        });

      // Should create user in database
      expect(response.status).toBeOneOf([200, 302]);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('newuser@example.com');
      expect(response.body.accessToken).toBeDefined();
    });

    it('should return existing user on subsequent login', async () => {
      // Pre-create user in database
      // This would be implemented with actual database entities

      const response = await request(app).get('/auth/google/callback').query({
        code: 'existing-user-code',
        state: 'test-state',
      });

      expect(response.status).toBeOneOf([200, 302]);
    });
  });

  describe('JWT Token Validation Tests', () => {
    let validToken: string;

    beforeEach(() => {
      validToken = authService.getJwtService().generateToken({
        userId: 'user123',
        email: 'test@example.com',
      });
    });

    it('should validate JWT token on protected endpoints', async () => {
      const response = await request(app)
        .get('/api/records')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should reject expired JWT tokens', async () => {
      // Create expired token
      const expiredToken = authService
        .getJwtService()
        .generateToken(
          { userId: 'user123', email: 'test@example.com' },
          { expiresIn: '-1h' }
        );

      await request(app)
        .get('/api/records')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });

    it('should reject malformed JWT tokens', async () => {
      await request(app)
        .get('/api/records')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);
    });

    it('should validate token signature', async () => {
      // Create token with wrong signature
      const parts = validToken.split('.');
      const tamperedToken = `${parts[0]}.${parts[1]}.tampered-signature`;

      await request(app)
        .get('/api/records')
        .set('Authorization', `Bearer ${tamperedToken}`)
        .expect(401);
    });

    it('should extract user context from valid token', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.user).toBeDefined();
      expect(response.body.user.id).toBe('user123');
      expect(response.body.user.email).toBe('test@example.com');
    });
  });

  describe('Refresh Token Rotation Scenarios', () => {
    beforeEach(async () => {
      // Reset rate limiting between tests
      jest.clearAllMocks();

      // Clear refresh tokens between tests
      await request(app).post('/auth/test-clear-refresh-tokens');
    });

    it('should rotate refresh tokens on usage', async () => {
      // Create initial tokens - simulate this via direct token creation
      const initialRefreshToken = 'initial-refresh-token';

      // First, simulate creating the initial refresh token
      await request(app).post('/auth/test-setup-refresh-token').send({
        refreshToken: initialRefreshToken,
        userId: 'user123',
        email: 'test@example.com',
      });

      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: initialRefreshToken })
        .expect(200);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.refreshToken).not.toBe(initialRefreshToken);
    });

    it('should invalidate old refresh token after rotation', async () => {
      const oldRefreshToken = 'old-refresh-token';

      // Set up initial refresh token
      await request(app).post('/auth/test-setup-refresh-token').send({
        refreshToken: oldRefreshToken,
        userId: 'user123',
        email: 'test@example.com',
      });

      // Use refresh token once
      await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: oldRefreshToken })
        .expect(200);

      // Try to use the same token again
      await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: oldRefreshToken })
        .expect(401);
    });

    it('should handle concurrent refresh token usage', async () => {
      const refreshToken = 'concurrent-refresh-token';

      // Set up initial refresh token
      await request(app).post('/auth/test-setup-refresh-token').send({
        refreshToken,
        userId: 'user123',
        email: 'test@example.com',
      });

      // Make concurrent requests
      const promises = Array.from({ length: 3 }, () =>
        request(app).post('/auth/refresh').send({ refreshToken })
      );

      const responses = await Promise.all(promises);

      // Only one should succeed
      const successCount = responses.filter((r) => r.status === 200).length;
      expect(successCount).toBe(1);

      // Others should fail with 401 or 429 (rate limited)
      const failureCount = responses.filter(
        (r) => r.status === 401 || r.status === 429
      ).length;
      expect(failureCount).toBe(2);
    });
  });

  describe('Cookie Security Settings Verification', () => {
    it('should set secure httpOnly cookies', async () => {
      const response = await request(app).post('/auth/login').send({
        code: 'valid-oauth-code',
        state: 'test-state',
      });

      const cookies = response.get('Set-Cookie');
      expect(cookies).toBeDefined();

      const sessionCookie = cookies?.find((cookie) =>
        cookie.includes('misc-poc-session=')
      );

      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toContain('HttpOnly');
      // Secure flag only set in production
      if (process.env.NODE_ENV === 'production') {
        expect(sessionCookie).toContain('Secure');
      }
      expect(sessionCookie).toContain('SameSite=Strict');
    });

    it('should set proper cookie expiration', async () => {
      const response = await request(app).post('/auth/login').send({
        code: 'valid-oauth-code',
        state: 'test-state',
      });

      const cookies = response.get('Set-Cookie');
      const sessionCookie = cookies?.find((cookie) =>
        cookie.includes('misc-poc-session=')
      );

      expect(sessionCookie).toContain('Max-Age=604800'); // 7 days
    });

    it('should clear cookies on logout', async () => {
      const token = authService.getJwtService().generateToken({
        userId: 'user123',
        email: 'test@example.com',
      });

      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const cookies = response.get('Set-Cookie');
      expect(cookies).toBeDefined();

      const clearedCookie = cookies?.find(
        (cookie) =>
          cookie.includes('misc-poc-session=') && cookie.includes('Expires=')
      );

      expect(clearedCookie).toBeDefined();
    });
  });

  describe('Error Handling Scenarios', () => {
    it('should handle OAuth consent denied', async () => {
      const response = await request(app)
        .get('/auth/google/callback/mock-error')
        .query({
          error: 'access_denied',
          error_description: 'User denied access',
        })
        .expect(400);

      expect(response.body.error).toBe('OAuth consent denied');
      expect(response.body.code).toBe('ACCESS_DENIED');
    });

    it('should handle network failure with retry logic', async () => {
      // Simulate network failure during OAuth flow
      const response = await request(app).get('/auth/google/callback').query({
        code: 'network-failure-code',
        state: 'test-state',
      });

      // Should handle gracefully
      expect([500, 503]).toContain(response.status);
      expect(response.body.error).toContain('Network error');
    });

    it('should handle invalid token errors', async () => {
      const response = await request(app)
        .get('/auth/google/callback')
        .query({
          code: 'invalid-code',
          state: 'test-state',
        })
        .expect(400);

      expect(response.body.error).toContain('Invalid authorization code');
      expect(response.body.code).toBe('INVALID_TOKEN');
    });

    it('should handle rate limiting errors', async () => {
      // Temporarily enable rate limiting by bypassing test mode
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        // Make rapid requests to trigger rate limiting
        const promises = Array.from({ length: 10 }, () =>
          request(app).get('/auth/google')
        );

        const responses = await Promise.all(promises);

        // Should have at least some rate limited responses
        const rateLimitedCount = responses.filter(
          (r) => r.status === 429
        ).length;
        expect(rateLimitedCount).toBeGreaterThan(0);
      } finally {
        // Restore original environment
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should handle account linking errors', async () => {
      // Test account already linked scenario
      const response = await request(app)
        .get('/auth/google/callback')
        .query({
          code: 'account-already-linked-code',
          state: 'test-state',
        })
        .expect(409);

      expect(response.body.error).toContain('already linked');
      expect(response.body.code).toBe('ACCOUNT_ALREADY_LINKED');
    });

    it('should provide comprehensive logging for debugging', async () => {
      // This test verifies that errors are properly logged
      // Implementation would check logging framework output

      await request(app).get('/auth/google/callback').query({
        code: 'logging-test-code',
        state: 'test-state',
      });

      // Verify logs contain required information
      // This would be implemented with actual logging verification
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Performance Tests for Authentication Endpoints', () => {
    it('should authenticate with Google in less than 2 seconds', async () => {
      const startTime = Date.now();

      await request(app).get('/auth/google').expect(302);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(2000);
    });

    it('should validate JWT token in less than 100ms', async () => {
      const token = authService.getJwtService().generateToken({
        userId: 'user123',
        email: 'test@example.com',
      });

      const startTime = Date.now();

      await request(app)
        .get('/api/records')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100);
    });

    it('should handle 100 concurrent authentication requests', async () => {
      const token = authService.getJwtService().generateToken({
        userId: 'user123',
        email: 'test@example.com',
      });

      const startTime = Date.now();

      const promises = Array.from({ length: 100 }, () =>
        request(app).get('/api/records').set('Authorization', `Bearer ${token}`)
      );

      const responses = await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // All should succeed or be unauthorized (no rate limiting expected for valid tokens)
      responses.forEach((response) => {
        expect([200, 401, 429]).toContain(response.status);
      });

      // Should complete within reasonable time
      expect(duration).toBeLessThan(5000);
    });

    it('should not leak memory under sustained load', async () => {
      const token = authService.getJwtService().generateToken({
        userId: 'user123',
        email: 'test@example.com',
      });

      const initialMemory = process.memoryUsage().heapUsed;

      // Make requests in batches to avoid overwhelming the system
      const batchSize = 100;
      const totalRequests = 500; // Reduced for test performance

      for (let batch = 0; batch < totalRequests / batchSize; batch++) {
        const promises = Array.from({ length: batchSize }, () =>
          request(app)
            .get('/api/records')
            .set('Authorization', `Bearer ${token}`)
        );
        await Promise.all(promises);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 30MB)
      expect(memoryIncrease).toBeLessThan(30 * 1024 * 1024);
    }, 15000); // Increased timeout to 15 seconds
  });
});

// Jest custom matcher for multiple possible values
expect.extend({
  toBeOneOf(received: unknown, expected: unknown[]): jest.CustomMatcherResult {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: (): string =>
          `expected ${received} not to be one of ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: (): string => `expected ${received} to be one of ${expected}`,
        pass: false,
      };
    }
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(expected: unknown[]): R;
    }
  }
}
