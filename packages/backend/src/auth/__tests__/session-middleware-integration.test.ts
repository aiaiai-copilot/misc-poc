import { Request, Response, NextFunction } from 'express';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import request from 'supertest';
import { AuthService } from '../index.js';
import { JwtService } from '../jwt.js';
import { createApp, blacklistToken, isTokenBlacklisted } from '../../app.js';

describe('Session Management Middleware Integration', () => {
  let app: express.Application;
  let authService: AuthService;
  let jwtService: JwtService;

  beforeEach(() => {
    authService = new AuthService({
      jwt: {
        secret: 'test-jwt-secret',
        expiresIn: '1h',
        issuer: 'test-issuer',
      },
      google: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        callbackUrl: '/auth/google/callback',
      },
      session: {
        secret: 'test-session-secret',
        name: 'test-session',
        maxAge: 3600000, // 1 hour
      },
    });
    jwtService = authService.getJwtService();

    // Create app with session management middleware
    app = createApp({
      cors: {
        origin: 'http://localhost:3000',
        credentials: true,
      },
      authService: authService,
    });
  });

  describe('Session Validation', () => {
    it('should validate active JWT token', async () => {
      const token = jwtService.generateToken({
        userId: 'user123',
        email: 'test@example.com',
      });

      app.get('/protected', (req: Request, res: Response) => {
        if (req.user) {
          res.json({ user: req.user });
        } else {
          res.status(401).json({ error: 'Unauthorized' });
        }
      });

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.userId).toBe('user123');
    });

    it('should reject expired JWT token', async () => {
      // Create expired token
      const expiredToken = jwtService.generateToken(
        { userId: 'user123', email: 'test@example.com' },
        { expiresIn: '-1h' }
      );

      app.get('/protected', (req: Request, res: Response) => {
        if (req.user) {
          res.json({ user: req.user });
        } else {
          res.status(401).json({ error: 'Unauthorized' });
        }
      });

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should reject malformed JWT token', async () => {
      app.get('/protected', (req: Request, res: Response) => {
        if (req.user) {
          res.json({ user: req.user });
        } else {
          res.status(401).json({ error: 'Unauthorized' });
        }
      });

      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should validate token signature', async () => {
      // Create token with wrong secret
      const wrongJwtService = new JwtService({
        jwt: {
          secret: 'wrong-secret',
          expiresIn: '1h',
          issuer: 'test-issuer',
        },
        google: {
          clientId: 'test',
          clientSecret: 'test',
          callbackUrl: '/test',
        },
        session: {
          secret: 'test',
          name: 'test',
          maxAge: 3600000,
        },
      });

      const invalidToken = wrongJwtService.generateToken({
        userId: 'user123',
        email: 'test@example.com',
      });

      app.get('/protected', (req: Request, res: Response) => {
        if (req.user) {
          res.json({ user: req.user });
        } else {
          res.status(401).json({ error: 'Unauthorized' });
        }
      });

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${invalidToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should extract user context from valid token', async () => {
      const userData = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'user',
      };
      const token = jwtService.generateToken(userData);

      app.get('/user-info', (req: Request, res: Response) => {
        if (req.user) {
          res.json({ user: req.user });
        } else {
          res.status(401).json({ error: 'Unauthorized' });
        }
      });

      const response = await request(app)
        .get('/user-info')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.user.userId).toBe('user123');
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.user.role).toBe('user');
    });
  });

  describe('Session Revocation', () => {
    it('should invalidate active session', async () => {
      const token = jwtService.generateToken({
        userId: 'user123',
        email: 'test@example.com',
      });

      app.get('/protected', (req: Request, res: Response) => {
        if (req.user) {
          res.json({ user: req.user });
        } else {
          res.status(401).json({ error: 'Unauthorized' });
        }
      });

      // First, verify token works
      let response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);

      // Logout (should invalidate session)
      response = await request(app)
        .post('/logout')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);

      // Token should now be invalid
      response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(401);
    });

    it('should clear session cookies', async () => {
      const token = jwtService.generateToken({
        userId: 'user123',
        email: 'test@example.com',
      });

      const response = await request(app)
        .post('/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      const cookies = response.get('Set-Cookie');
      expect(cookies).toBeDefined();
      expect(
        cookies?.some(
          (cookie) =>
            cookie.includes('test-session=') && cookie.includes('Expires=')
        )
      ).toBe(true);
    });

    it('should reject operations with revoked token', async () => {
      const token = jwtService.generateToken({
        userId: 'user123',
        email: 'test@example.com',
      });

      app.delete('/protected-resource', (req: Request, res: Response) => {
        if (req.user) {
          res.json({ message: 'Resource deleted' });
        } else {
          res.status(401).json({ error: 'Unauthorized' });
        }
      });

      // Logout (should blacklist token)
      await request(app)
        .post('/logout')
        .set('Authorization', `Bearer ${token}`);

      // Try to use revoked token
      const response = await request(app)
        .delete('/protected-resource')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(401);
    });
  });

  describe('Session Management Integration', () => {
    it('should set secure httpOnly cookies for session management', async () => {
      app.post('/login', (req: Request, res: Response) => {
        // Modify session data to trigger cookie setting
        req.session.user = { id: 'user123', email: 'test@example.com' };
        req.session.save((err) => {
          if (err) {
            return res.status(500).json({ error: 'Session save failed' });
          }
          res.json({ message: 'Login successful' });
        });
      });

      const response = await request(app)
        .post('/login')
        .send({ email: 'test@example.com', password: 'password' });

      expect(response.status).toBe(200);
      const cookies = response.get('Set-Cookie');
      expect(cookies).toBeDefined();
      // Should contain httpOnly attributes
      expect(cookies?.some((cookie) => cookie.includes('HttpOnly'))).toBe(true);
    });

    it('should configure CORS for SPA integration', async () => {
      const response = await request(app)
        .options('/')
        .set('Origin', 'http://localhost:3000');

      expect(response.status).toBe(200);
      expect(response.get('Access-Control-Allow-Origin')).toBe(
        'http://localhost:3000'
      );
      expect(response.get('Access-Control-Allow-Credentials')).toBe('true');
    });
  });
});
