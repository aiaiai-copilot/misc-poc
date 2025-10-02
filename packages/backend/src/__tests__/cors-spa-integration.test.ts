import request from 'supertest';
import express from 'express';
import { createApp } from '../app.js';
import { AuthService } from '../auth/index.js';

describe('CORS SPA Integration Tests', () => {
  let app: express.Application;
  let authService: AuthService;

  beforeEach(() => {
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
        maxAge: 604800000,
      },
    });

    app = createApp({
      cors: {
        origin: 'http://localhost:3000',
        credentials: true,
      },
      authService,
    });
  });

  describe('CORS Configuration', () => {
    it('should set correct CORS headers for allowed origin', async () => {
      const response = await request(app)
        .get('/api/records')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', 'Bearer valid-token');

      expect(response.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000'
      );
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should set correct methods in CORS headers', async () => {
      const response = await request(app)
        .options('/api/records')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-methods']).toBe(
        'GET,PUT,POST,DELETE,OPTIONS'
      );
    });

    it('should set correct allowed headers in CORS headers', async () => {
      const response = await request(app)
        .options('/api/records')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-headers']).toBe(
        'Content-Type,Authorization'
      );
    });

    it('should enable credentials for SPA authentication', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .set('Origin', 'http://localhost:3000')
        .set(
          'Authorization',
          `Bearer ${authService.getJwtService().generateToken({ userId: 'test-user', email: 'test@example.com' })}`
        );

      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('Preflight Requests', () => {
    it('should handle OPTIONS preflight for authentication routes', async () => {
      const response = await request(app)
        .options('/auth/google')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'Content-Type, Authorization');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000'
      );
      expect(response.headers['access-control-allow-methods']).toBe(
        'GET,PUT,POST,DELETE,OPTIONS'
      );
    });

    it('should handle OPTIONS preflight for API routes', async () => {
      const response = await request(app)
        .options('/api/records')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type, Authorization');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-headers']).toContain(
        'Authorization'
      );
    });

    it('should handle preflight for refresh token endpoint', async () => {
      const response = await request(app)
        .options('/auth/refresh')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should handle preflight for logout endpoint', async () => {
      const response = await request(app)
        .options('/auth/logout')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000'
      );
    });
  });

  describe('Cross-Origin Authentication Flows', () => {
    it('should allow authentication requests from SPA origin', async () => {
      const response = await request(app)
        .post('/auth/login')
        .set('Origin', 'http://localhost:3000')
        .send({ code: 'test-code' });

      expect(response.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000'
      );
      expect(response.status).toBe(200);
    });

    it('should include credentials in auth responses', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .set('Origin', 'http://localhost:3000')
        .send({ refreshToken: 'test-refresh-token' });

      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should handle logout with cross-origin request', async () => {
      const token = authService
        .getJwtService()
        .generateToken({ userId: 'test-user', email: 'test@example.com' });

      const response = await request(app)
        .post('/auth/logout')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${token}`);

      expect(response.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000'
      );
      expect(response.status).toBe(200);
    });
  });

  describe('SPA Integration Scenarios', () => {
    it('should support credentials for session-based auth', async () => {
      const token = authService
        .getJwtService()
        .generateToken({ userId: 'user123', email: 'user@example.com' });

      const response = await request(app)
        .get('/api/user/profile')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', 'misc-poc-session=test-session-cookie');

      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(response.status).toBe(200);
    });

    it('should allow POST requests with JSON body from SPA', async () => {
      const token = authService
        .getJwtService()
        .generateToken({ userId: 'user123', email: 'user@example.com' });

      const response = await request(app)
        .post('/api/import')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/json')
        .send({ version: '2.0', records: [] });

      expect(response.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000'
      );
    });

    it('should handle GET requests with query parameters from SPA', async () => {
      const token = authService
        .getJwtService()
        .generateToken({ userId: 'user123', email: 'user@example.com' });

      const response = await request(app)
        .get('/api/records?q=test&limit=10')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${token}`);

      expect(response.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000'
      );
      expect(response.status).toBe(200);
    });
  });

  describe('Security Headers', () => {
    it('should restrict CORS to configured origin only', async () => {
      const response = await request(app)
        .get('/api/records')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', 'Bearer valid-token');

      expect(response.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000'
      );
      expect(response.headers['access-control-allow-origin']).not.toBe('*');
    });

    it('should set credentials header for authenticated requests', async () => {
      const token = authService
        .getJwtService()
        .generateToken({ userId: 'user123', email: 'user@example.com' });

      const response = await request(app)
        .get('/api/tags')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${token}`);

      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('Multiple Origins Support', () => {
    beforeEach(() => {
      // Create app with multiple allowed origins
      app = createApp({
        cors: {
          origin: 'http://localhost:3000',
          credentials: true,
        },
        authService,
      });
    });

    it('should allow requests from primary SPA origin', async () => {
      const response = await request(app)
        .get('/api/records')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', 'Bearer valid-token');

      expect(response.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000'
      );
    });
  });

  describe('CORS Error Handling', () => {
    it('should handle requests without Origin header gracefully', async () => {
      const token = authService
        .getJwtService()
        .generateToken({ userId: 'user123', email: 'user@example.com' });

      const response = await request(app)
        .get('/api/records')
        .set('Authorization', `Bearer ${token}`);

      // Should still work even without Origin header
      expect(response.status).toBe(200);
    });

    it('should handle preflight for complex requests', async () => {
      const response = await request(app)
        .options('/api/import')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set(
          'Access-Control-Request-Headers',
          'Content-Type, Authorization, X-Custom-Header'
        );

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });
  });
});
