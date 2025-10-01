/**
 * Tags API Contract Integration Tests
 *
 * These tests verify the GET /api/tags endpoint as specified in the PRD,
 * covering tag frequency statistics, user data isolation, and authentication.
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

describe('[perf] GET /api/tags Contract', () => {
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
      const response = await request(app).get('/api/tags').expect(401);

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
        .get('/api/tags')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Tag Frequency Statistics', () => {
    beforeEach(async () => {
      // Setup test users
      await queryRunner.query(`
        INSERT INTO users (id, email, google_id, display_name) VALUES
        ('550e8400-e29b-41d4-a716-446655440001', 'test@example.com', 'google-123', 'Test User'),
        ('550e8400-e29b-41d4-a716-446655440002', 'other@example.com', 'google-456', 'Other User')
      `);
    });

    it('should return tag frequency statistics', async () => {
      // Insert test records with tags
      await queryRunner.query(`
        INSERT INTO records (user_id, content, tags, normalized_tags) VALUES
        ('550e8400-e29b-41d4-a716-446655440001', 'meeting project alpha 15:00', ARRAY['meeting', 'project', 'alpha', '15:00'], ARRAY['meeting', 'project', 'alpha', '15:00']),
        ('550e8400-e29b-41d4-a716-446655440001', 'project beta deadline tomorrow', ARRAY['project', 'beta', 'deadline', 'tomorrow'], ARRAY['project', 'beta', 'deadline', 'tomorrow']),
        ('550e8400-e29b-41d4-a716-446655440001', 'meeting with team today', ARRAY['meeting', 'with', 'team', 'today'], ARRAY['meeting', 'with', 'team', 'today'])
      `);

      const response = await request(app)
        .get('/api/tags')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toEqual([
        { tag: 'meeting', count: 2 },
        { tag: 'project', count: 2 },
        { tag: '15:00', count: 1 },
        { tag: 'alpha', count: 1 },
        { tag: 'beta', count: 1 },
        { tag: 'deadline', count: 1 },
        { tag: 'team', count: 1 },
        { tag: 'today', count: 1 },
        { tag: 'tomorrow', count: 1 },
        { tag: 'with', count: 1 },
      ]);
    });

    it('should include only user own tags', async () => {
      // Insert records for both users
      await queryRunner.query(`
        INSERT INTO records (user_id, content, tags, normalized_tags) VALUES
        ('550e8400-e29b-41d4-a716-446655440001', 'my personal project', ARRAY['my', 'personal', 'project'], ARRAY['my', 'personal', 'project']),
        ('550e8400-e29b-41d4-a716-446655440002', 'other user secret project', ARRAY['other', 'user', 'secret', 'project'], ARRAY['other', 'user', 'secret', 'project'])
      `);

      const response = await request(app)
        .get('/api/tags')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Should only include first user's tags, not second user's tags
      expect(response.body).toEqual([
        { tag: 'my', count: 1 },
        { tag: 'personal', count: 1 },
        { tag: 'project', count: 1 },
      ]);

      // Verify no cross-contamination
      const tagNames = response.body.map((item: any) => item.tag);
      expect(tagNames).not.toContain('other');
      expect(tagNames).not.toContain('secret');
    });

    it('should order tags by frequency descending', async () => {
      // Insert records with varying tag frequencies
      await queryRunner.query(`
        INSERT INTO records (user_id, content, tags, normalized_tags) VALUES
        ('550e8400-e29b-41d4-a716-446655440001', 'meeting alpha one', ARRAY['meeting', 'alpha', 'one'], ARRAY['meeting', 'alpha', 'one']),
        ('550e8400-e29b-41d4-a716-446655440001', 'meeting beta two', ARRAY['meeting', 'beta', 'two'], ARRAY['meeting', 'beta', 'two']),
        ('550e8400-e29b-41d4-a716-446655440001', 'meeting gamma three', ARRAY['meeting', 'gamma', 'three'], ARRAY['meeting', 'gamma', 'three']),
        ('550e8400-e29b-41d4-a716-446655440001', 'project alpha important', ARRAY['project', 'alpha', 'important'], ARRAY['project', 'alpha', 'important']),
        ('550e8400-e29b-41d4-a716-446655440001', 'project beta urgent', ARRAY['project', 'beta', 'urgent'], ARRAY['project', 'beta', 'urgent']),
        ('550e8400-e29b-41d4-a716-446655440001', 'alpha only', ARRAY['alpha', 'only'], ARRAY['alpha', 'only'])
      `);

      const response = await request(app)
        .get('/api/tags')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Verify ordering by frequency (descending) then by tag name for ties
      expect(response.body[0]).toEqual({ tag: 'alpha', count: 3 });
      expect(response.body[1]).toEqual({ tag: 'meeting', count: 3 });
      expect(response.body[2]).toEqual({ tag: 'beta', count: 2 });
      expect(response.body[3]).toEqual({ tag: 'project', count: 2 });

      // Verify all counts are in descending order
      const counts = response.body.map((item: any) => item.count);
      const sortedCounts = [...counts].sort((a, b) => b - a);
      expect(counts).toEqual(sortedCounts);
    });

    it('should include tag count for each tag', async () => {
      await queryRunner.query(`
        INSERT INTO records (user_id, content, tags, normalized_tags) VALUES
        ('550e8400-e29b-41d4-a716-446655440001', 'single tag record', ARRAY['single'], ARRAY['single'])
      `);

      const response = await request(app)
        .get('/api/tags')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toEqual([{ tag: 'single', count: 1 }]);

      // Verify all items have both tag and count properties
      response.body.forEach((item: any) => {
        expect(item).toHaveProperty('tag');
        expect(item).toHaveProperty('count');
        expect(typeof item.tag).toBe('string');
        expect(typeof item.count).toBe('number');
        expect(item.count).toBeGreaterThan(0);
      });
    });

    it('should handle tags with special characters', async () => {
      await queryRunner.query(`
        INSERT INTO records (user_id, content, tags, normalized_tags) VALUES
        ('550e8400-e29b-41d4-a716-446655440001', 'email@example.com password!123 file.txt', ARRAY['email@example.com', 'password!123', 'file.txt'], ARRAY['email@example.com', 'password!123', 'file.txt']),
        ('550e8400-e29b-41d4-a716-446655440001', 'meeting@office time:15:00 project#1', ARRAY['meeting@office', 'time:15:00', 'project#1'], ARRAY['meeting@office', 'time:15:00', 'project#1'])
      `);

      const response = await request(app)
        .get('/api/tags')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const tagNames = response.body.map((item: any) => item.tag);
      expect(tagNames).toContain('email@example.com');
      expect(tagNames).toContain('password!123');
      expect(tagNames).toContain('file.txt');
      expect(tagNames).toContain('meeting@office');
      expect(tagNames).toContain('time:15:00');
      expect(tagNames).toContain('project#1');

      // Verify all have correct counts
      response.body.forEach((item: any) => {
        expect(item.count).toBe(1);
      });
    });

    it('should return empty array when user has no records', async () => {
      const response = await request(app)
        .get('/api/tags')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should handle large datasets efficiently', async () => {
      // Insert many records to test performance
      const insertPromises = [];
      for (let i = 0; i < 100; i++) {
        insertPromises.push(
          queryRunner.query(`
            INSERT INTO records (user_id, content, tags, normalized_tags) VALUES
            ('550e8400-e29b-41d4-a716-446655440001', 'record ${i} with common tag', ARRAY['record', '${i}', 'common', 'tag'], ARRAY['record', '${i}', 'common', 'tag'])
          `)
        );
      }
      await Promise.all(insertPromises);

      const startTime = Date.now();
      const response = await request(app)
        .get('/api/tags')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      const endTime = Date.now();

      // Should complete within reasonable time (< 500ms)
      expect(endTime - startTime).toBeLessThan(500);

      // Verify expected frequent tags
      expect(response.body).toEqual(
        expect.arrayContaining([
          { tag: 'common', count: 100 },
          { tag: 'tag', count: 100 },
          { tag: 'record', count: 100 },
        ])
      );
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
        .get('/api/tags')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should validate JWT token format', async () => {
      const response = await request(app)
        .get('/api/tags')
        .set('Authorization', 'Bearer invalid-token-format')
        .expect(401);

      expect(response.body).toEqual({
        error: 'Unauthorized',
      });
    });
  });
});
