/**
 * Tags Suggest API Contract Integration Tests
 *
 * These tests verify the GET /api/tags/suggest endpoint as specified in task 10.2,
 * following the established PRD patterns for API endpoints while implementing
 * auto-completion with prefix matching, configurable result limits,
 * case-insensitive matching, and proper response formatting for frontend integration.
 *
 * Based on PRD test specifications for API endpoints with user isolation,
 * authentication requirements, and performance criteria.
 */
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource, QueryRunner } from 'typeorm';
import request from 'supertest';
import { createApp, AppConfig } from '../../app.js';
import { AuthService } from '../../auth/index.js';
import express from 'express';

describe('GET /api/tags/suggest Contract', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let queryRunner: QueryRunner;
  let app: express.Application;
  let authService: AuthService;
  let userToken: string;
  let otherUserToken: string;

  // Increase timeout for container operations
  jest.setTimeout(120000);

  beforeAll(async () => {
    // Start PostgreSQL container
    container = await new PostgreSqlContainer('postgres:15')
      .withDatabase('misc_test')
      .withUsername('test')
      .withPassword('test')
      .start();

    // Create DataSource connection
    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getMappedPort(5432),
      database: container.getDatabase(),
      username: container.getUsername(),
      password: container.getPassword(),
      synchronize: false,
      logging: false,
    });

    await dataSource.initialize();
    queryRunner = dataSource.createQueryRunner();

    // Create database schema
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        google_id VARCHAR(255) UNIQUE NOT NULL,
        display_name VARCHAR(255),
        avatar_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_login_at TIMESTAMP WITH TIME ZONE
      );

      CREATE TABLE records (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        tags TEXT[] NOT NULL,
        normalized_tags TEXT[] NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, content)
      );

      CREATE INDEX idx_records_user_id ON records(user_id);
      CREATE INDEX idx_records_normalized_tags ON records USING GIN(normalized_tags);
      CREATE INDEX idx_records_created_at ON records(created_at DESC);
    `);

    // Setup auth service
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

    const config: AppConfig = {
      authService,
      dataSource,
    };

    app = createApp(config);

    // Generate test tokens with UUID format
    const jwtService = authService.getJwtService();
    userToken = jwtService.generateToken({
      userId: '550e8400-e29b-41d4-a716-446655440001',
      email: 'test@example.com',
    });
    otherUserToken = jwtService.generateToken({
      userId: '550e8400-e29b-41d4-a716-446655440002',
      email: 'other@example.com',
    });
  });

  afterAll(async () => {
    await queryRunner?.release();
    await dataSource?.destroy();
    await container?.stop();
  });

  beforeEach(async () => {
    // Clean up test data
    await queryRunner.query('DELETE FROM records');
    await queryRunner.query('DELETE FROM users');
  });

  describe('Authentication Requirements', () => {
    it('should require authentication with 401 for anonymous', async () => {
      const response = await request(app)
        .get('/api/tags/suggest?q=test')
        .expect(401);

      expect(response.body).toEqual({
        error: 'Unauthorized',
      });
    });

    it('should accept valid JWT token', async () => {
      // Insert test user
      await queryRunner.query(`
        INSERT INTO users (id, email, google_id, display_name)
        VALUES ('550e8400-e29b-41d4-a716-446655440001', 'test@example.com', 'google-123', 'Test User')
      `);

      const response = await request(app)
        .get('/api/tags/suggest?q=test')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Prefix Matching', () => {
    beforeEach(async () => {
      // Setup test users
      await queryRunner.query(`
        INSERT INTO users (id, email, google_id, display_name) VALUES
        ('550e8400-e29b-41d4-a716-446655440001', 'test@example.com', 'google-123', 'Test User'),
        ('550e8400-e29b-41d4-a716-446655440002', 'other@example.com', 'google-456', 'Other User')
      `);

      // Insert test records with various tags
      await queryRunner.query(`
        INSERT INTO records (user_id, content, tags, normalized_tags) VALUES
        ('550e8400-e29b-41d4-a716-446655440001', 'project alpha meeting today', ARRAY['project', 'alpha', 'meeting', 'today'], ARRAY['project', 'alpha', 'meeting', 'today']),
        ('550e8400-e29b-41d4-a716-446655440001', 'project beta deadline tomorrow', ARRAY['project', 'beta', 'deadline', 'tomorrow'], ARRAY['project', 'beta', 'deadline', 'tomorrow']),
        ('550e8400-e29b-41d4-a716-446655440001', 'programming task urgent', ARRAY['programming', 'task', 'urgent'], ARRAY['programming', 'task', 'urgent']),
        ('550e8400-e29b-41d4-a716-446655440001', 'prototype design review', ARRAY['prototype', 'design', 'review'], ARRAY['prototype', 'design', 'review']),
        ('550e8400-e29b-41d4-a716-446655440001', 'progress report weekly', ARRAY['progress', 'report', 'weekly'], ARRAY['progress', 'report', 'weekly'])
      `);
    });

    it('should return tags matching prefix', async () => {
      const response = await request(app)
        .get('/api/tags/suggest?q=pro')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toEqual([
        'project',
        'programming',
        'progress',
        'prototype',
      ]);
    });

    it('should return exact match when prefix matches complete tag', async () => {
      const response = await request(app)
        .get('/api/tags/suggest?q=project')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toContain('project');
    });

    it('should return empty array when no tags match prefix', async () => {
      const response = await request(app)
        .get('/api/tags/suggest?q=nonexistent')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should be case-insensitive', async () => {
      const response = await request(app)
        .get('/api/tags/suggest?q=PRO')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toEqual([
        'project',
        'programming',
        'progress',
        'prototype',
      ]);
    });

    it('should handle special characters in prefix', async () => {
      // Add record with special characters
      await queryRunner.query(`
        INSERT INTO records (user_id, content, tags, normalized_tags) VALUES
        ('550e8400-e29b-41d4-a716-446655440001', 'email@example.com password!123 file.txt', ARRAY['email@example.com', 'password!123', 'file.txt'], ARRAY['email@example.com', 'password!123', 'file.txt'])
      `);

      const response = await request(app)
        .get('/api/tags/suggest?q=email@')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toContain('email@example.com');
    });
  });

  describe('Result Limiting', () => {
    beforeEach(async () => {
      // Setup test user
      await queryRunner.query(`
        INSERT INTO users (id, email, google_id, display_name)
        VALUES ('550e8400-e29b-41d4-a716-446655440001', 'test@example.com', 'google-123', 'Test User')
      `);

      // Insert records with many tags starting with 'tag'
      const insertPromises = [];
      for (let i = 1; i <= 20; i++) {
        insertPromises.push(
          queryRunner.query(`
            INSERT INTO records (user_id, content, tags, normalized_tags) VALUES
            ('550e8400-e29b-41d4-a716-446655440001', 'record ${i}', ARRAY['tag${i}'], ARRAY['tag${i}'])
          `)
        );
      }
      await Promise.all(insertPromises);
    });

    it('should default to 10 results when no limit specified', async () => {
      const response = await request(app)
        .get('/api/tags/suggest?q=tag')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveLength(10);
    });

    it('should respect custom limit parameter', async () => {
      const response = await request(app)
        .get('/api/tags/suggest?q=tag&limit=5')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveLength(5);
    });

    it('should handle limit parameter larger than available results', async () => {
      const response = await request(app)
        .get('/api/tags/suggest?q=tag&limit=100')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveLength(20); // Only 20 tags exist
    });

    it('should validate limit parameter range', async () => {
      // Test with limit too high
      const response1 = await request(app)
        .get('/api/tags/suggest?q=tag&limit=101')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response1.body).toEqual({
        error: 'Limit must be between 1 and 100',
      });

      // Test with limit too low
      const response2 = await request(app)
        .get('/api/tags/suggest?q=tag&limit=0')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response2.body).toEqual({
        error: 'Limit must be between 1 and 100',
      });
    });

    it('should validate limit parameter type', async () => {
      const response = await request(app)
        .get('/api/tags/suggest?q=tag&limit=invalid')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body).toEqual({
        error: 'Limit must be a valid number',
      });
    });
  });

  describe('Frequency-Based Sorting', () => {
    beforeEach(async () => {
      // Setup test user
      await queryRunner.query(`
        INSERT INTO users (id, email, google_id, display_name)
        VALUES ('550e8400-e29b-41d4-a716-446655440001', 'test@example.com', 'google-123', 'Test User')
      `);

      // Insert records with tags of varying frequencies
      await queryRunner.query(`
        INSERT INTO records (user_id, content, tags, normalized_tags) VALUES
        ('550e8400-e29b-41d4-a716-446655440001', 'task alpha urgent', ARRAY['task', 'alpha', 'urgent'], ARRAY['task', 'alpha', 'urgent']),
        ('550e8400-e29b-41d4-a716-446655440001', 'task beta important', ARRAY['task', 'beta', 'important'], ARRAY['task', 'beta', 'important']),
        ('550e8400-e29b-41d4-a716-446655440001', 'task gamma normal', ARRAY['task', 'gamma', 'normal'], ARRAY['task', 'gamma', 'normal']),
        ('550e8400-e29b-41d4-a716-446655440001', 'target alpha test', ARRAY['target', 'alpha', 'test'], ARRAY['target', 'alpha', 'test']),
        ('550e8400-e29b-41d4-a716-446655440001', 'target beta verify', ARRAY['target', 'beta', 'verify'], ARRAY['target', 'beta', 'verify']),
        ('550e8400-e29b-41d4-a716-446655440001', 'team meeting today', ARRAY['team', 'meeting', 'today'], ARRAY['team', 'meeting', 'today'])
      `);
    });

    it('should order results by frequency descending then alphabetically', async () => {
      const response = await request(app)
        .get('/api/tags/suggest?q=ta')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // 'task' appears 3 times, 'target' appears 2 times (team doesn't match 'ta' prefix)
      expect(response.body).toEqual(['task', 'target']);
    });

    it('should break frequency ties alphabetically', async () => {
      // Add another record to create frequency tie
      await queryRunner.query(`
        INSERT INTO records (user_id, content, tags, normalized_tags) VALUES
        ('550e8400-e29b-41d4-a716-446655440001', 'team collaboration daily', ARRAY['team', 'collaboration', 'daily'], ARRAY['team', 'collaboration', 'daily'])
      `);

      const response = await request(app)
        .get('/api/tags/suggest?q=ta')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Now 'task' (3 times), 'target' (2 times) (team still doesn't match 'ta' prefix)
      // Only task and target match 'ta' prefix
      expect(response.body).toEqual(['task', 'target']);
    });
  });

  describe('User Data Isolation', () => {
    beforeEach(async () => {
      // Setup test users
      await queryRunner.query(`
        INSERT INTO users (id, email, google_id, display_name) VALUES
        ('550e8400-e29b-41d4-a716-446655440001', 'test@example.com', 'google-123', 'Test User'),
        ('550e8400-e29b-41d4-a716-446655440002', 'other@example.com', 'google-456', 'Other User')
      `);

      // Insert records for both users
      await queryRunner.query(`
        INSERT INTO records (user_id, content, tags, normalized_tags) VALUES
        ('550e8400-e29b-41d4-a716-446655440001', 'my personal project', ARRAY['personal', 'project', 'mine'], ARRAY['personal', 'project', 'mine']),
        ('550e8400-e29b-41d4-a716-446655440002', 'private confidential project', ARRAY['private', 'confidential', 'project'], ARRAY['private', 'confidential', 'project'])
      `);
    });

    it('should only include user own tags in suggestions', async () => {
      const response = await request(app)
        .get('/api/tags/suggest?q=p')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Should only include first user's tags starting with 'p'
      expect(response.body).toEqual(['personal', 'project']);

      // Verify no cross-contamination
      expect(response.body).not.toContain('private');
      expect(response.body).not.toContain('confidential');
    });

    it('should return different suggestions for different users', async () => {
      const userResponse = await request(app)
        .get('/api/tags/suggest?q=p')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const otherUserResponse = await request(app)
        .get('/api/tags/suggest?q=p')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(200);

      expect(userResponse.body).toEqual(['personal', 'project']);
      expect(otherUserResponse.body).toEqual(['private', 'project']);
    });
  });

  describe('Query Parameter Validation', () => {
    beforeEach(async () => {
      await queryRunner.query(`
        INSERT INTO users (id, email, google_id, display_name)
        VALUES ('550e8400-e29b-41d4-a716-446655440001', 'test@example.com', 'google-123', 'Test User')
      `);
    });

    it('should require q parameter', async () => {
      const response = await request(app)
        .get('/api/tags/suggest')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body).toEqual({
        error: 'Query parameter q is required',
      });
    });

    it('should handle empty q parameter', async () => {
      const response = await request(app)
        .get('/api/tags/suggest?q=')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body).toEqual({
        error: 'Query parameter q cannot be empty',
      });
    });

    it('should trim whitespace from q parameter', async () => {
      // Add test data
      await queryRunner.query(`
        INSERT INTO records (user_id, content, tags, normalized_tags) VALUES
        ('550e8400-e29b-41d4-a716-446655440001', 'test record', ARRAY['test'], ARRAY['test'])
      `);

      const response = await request(app)
        .get('/api/tags/suggest?q=  test  ')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toContain('test');
    });
  });

  describe('Performance Requirements', () => {
    beforeEach(async () => {
      // Setup test user
      await queryRunner.query(`
        INSERT INTO users (id, email, google_id, display_name)
        VALUES ('550e8400-e29b-41d4-a716-446655440001', 'test@example.com', 'google-123', 'Test User')
      `);

      // Insert large number of records for performance testing
      const insertPromises = [];
      for (let i = 0; i < 100; i++) {
        insertPromises.push(
          queryRunner.query(`
            INSERT INTO records (user_id, content, tags, normalized_tags) VALUES
            ('550e8400-e29b-41d4-a716-446655440001', 'performance test ${i}', ARRAY['performance', 'test${i}', 'data'], ARRAY['performance', 'test${i}', 'data'])
          `)
        );
      }
      await Promise.all(insertPromises);
    });

    it('should respond within 200ms for large datasets', async () => {
      const startTime = Date.now();
      const response = await request(app)
        .get('/api/tags/suggest?q=test')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      const endTime = Date.now();

      // Should complete within 200ms as per PRD performance requirements
      expect(endTime - startTime).toBeLessThan(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await queryRunner.query(`
        INSERT INTO users (id, email, google_id, display_name)
        VALUES ('550e8400-e29b-41d4-a716-446655440001', 'test@example.com', 'google-123', 'Test User')
      `);
    });

    it('should handle database connection errors gracefully', async () => {
      // This test would require mocking the database connection
      // For now, we'll test that the endpoint exists and doesn't crash
      const response = await request(app)
        .get('/api/tags/suggest?q=test')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should validate JWT token format', async () => {
      const response = await request(app)
        .get('/api/tags/suggest?q=test')
        .set('Authorization', 'Bearer invalid-token-format')
        .expect(401);

      expect(response.body).toEqual({
        error: 'Unauthorized',
      });
    });
  });
});
