/**
 * GET /api/export Endpoint - Contract Tests
 * Task 12.2: Create GET /api/export Endpoint with Format Selection
 *
 * Test specifications from PRD section 4.3.2 (lines 666-674):
 * - should export all user records in JSON format
 * - should include version identifier in export
 * - should include export metadata
 * - should preserve record timestamps
 * - should maintain tag order in exports
 * - should include normalization settings
 * - should require authentication with 401 for anonymous
 */

import request from 'supertest';
import { Express } from 'express';
import { createApp, AppConfig } from '../../app.js';
import { DataSource } from 'typeorm';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { AuthService } from '../../auth/index.js';

describe('[perf] GET /api/export - Contract Tests', () => {
  let app: Express;
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let authService: AuthService;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Start PostgreSQL container
    container = await new PostgreSqlContainer('postgres:15-alpine')
      .withDatabase('misc_test')
      .withUsername('test_user')
      .withPassword('test_password')
      .start();

    // Create DataSource
    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getPort(),
      database: container.getDatabase(),
      username: container.getUsername(),
      password: container.getPassword(),
      synchronize: false,
      logging: false,
      entities: [],
      migrations: [],
    });

    await dataSource.initialize();

    // Create tables manually for testing
    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        google_id VARCHAR(255) UNIQUE NOT NULL,
        display_name VARCHAR(255),
        avatar_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_login_at TIMESTAMP WITH TIME ZONE
      );
    `);

    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        tags TEXT[] NOT NULL,
        normalized_tags TEXT[] NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        case_sensitive BOOLEAN DEFAULT FALSE,
        remove_accents BOOLEAN DEFAULT TRUE,
        max_tag_length INTEGER DEFAULT 100,
        max_tags_per_record INTEGER DEFAULT 50,
        ui_language VARCHAR(10) DEFAULT 'en',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create test user
    const userResult = await dataSource.query(
      `
      INSERT INTO users (email, google_id, display_name)
      VALUES ($1, $2, $3)
      RETURNING id
    `,
      ['test@example.com', 'google-123', 'Test User']
    );
    userId = userResult[0].id;

    // Create user settings
    await dataSource.query(
      `
      INSERT INTO user_settings (user_id, case_sensitive, remove_accents)
      VALUES ($1, $2, $3)
    `,
      [userId, false, true]
    );

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

    // Generate auth token
    const jwtService = authService.getJwtService();
    authToken = jwtService.generateToken({
      userId,
      email: 'test@example.com',
    });

    // Create Express app with auth service
    const config: AppConfig = {
      authService,
      dataSource,
    };
    app = createApp(config);
  }, 120000);

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  }, 30000);

  beforeEach(async () => {
    // Clean up records before each test
    await dataSource.query('DELETE FROM records WHERE user_id = $1', [userId]);
  });

  describe('Authentication', () => {
    it('should require authentication with 401 for anonymous', async () => {
      const response = await request(app).get('/api/export').expect(401);

      expect(response.body).toEqual({
        error: 'Unauthorized',
      });
    });
  });

  describe('Export Format', () => {
    it('should export all user records in JSON format', async () => {
      // Insert test records
      await dataSource.query(
        `
        INSERT INTO records (user_id, content, tags, normalized_tags, created_at, updated_at)
        VALUES
          ($1, $2, $3, $4, $5, $6),
          ($1, $7, $8, $9, $10, $11),
          ($1, $12, $13, $14, $15, $16)
      `,
        [
          userId,
          'meeting project alpha 15:00',
          ['meeting', 'project', 'alpha', '15:00'],
          ['meeting', 'project', 'alpha', '15:00'],
          '2024-01-15T10:00:00Z',
          '2024-01-15T10:00:00Z',
          'peter ivanov phone 89151234455',
          ['peter', 'ivanov', 'phone', '89151234455'],
          ['peter', 'ivanov', 'phone', '89151234455'],
          '2024-01-16T11:00:00Z',
          '2024-01-16T11:00:00Z',
          'password github qwerty123',
          ['password', 'github', 'qwerty123'],
          ['password', 'github', 'qwerty123'],
          '2024-01-17T12:00:00Z',
          '2024-01-17T12:00:00Z',
        ]
      );

      const response = await request(app)
        .get('/api/export')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect('Content-Type', /json/);

      // Validate response structure
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('records');
      expect(response.body).toHaveProperty('metadata');

      // Validate records array
      expect(Array.isArray(response.body.records)).toBe(true);
      expect(response.body.records).toHaveLength(3);

      // Validate each record has required fields
      response.body.records.forEach((record: unknown) => {
        expect(record).toHaveProperty('content');
        expect(record).toHaveProperty('createdAt');
        expect(record).toHaveProperty('updatedAt');
      });
    });

    it('should include version identifier in export', async () => {
      const response = await request(app)
        .get('/api/export')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.version).toBe('2.0');
    });

    it('should include export metadata', async () => {
      const response = await request(app)
        .get('/api/export')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.metadata).toBeDefined();
      expect(response.body.metadata).toHaveProperty('exportedAt');
      expect(response.body.metadata).toHaveProperty('recordCount');
      expect(response.body.metadata).toHaveProperty('normalizationRules');

      // Validate metadata types
      expect(typeof response.body.metadata.exportedAt).toBe('string');
      expect(typeof response.body.metadata.recordCount).toBe('number');
      expect(typeof response.body.metadata.normalizationRules).toBe('object');
    });

    it('should preserve record timestamps', async () => {
      const createdAt = '2024-01-15T10:30:00Z';
      const updatedAt = '2024-01-15T11:45:00Z';

      await dataSource.query(
        `
        INSERT INTO records (user_id, content, tags, normalized_tags, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
        [
          userId,
          'test record with timestamps',
          ['test', 'record', 'with', 'timestamps'],
          ['test', 'record', 'with', 'timestamps'],
          createdAt,
          updatedAt,
        ]
      );

      const response = await request(app)
        .get('/api/export')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.records).toHaveLength(1);
      // PostgreSQL returns timestamps with milliseconds, so we normalize for comparison
      expect(new Date(response.body.records[0].createdAt).toISOString()).toBe(
        new Date(createdAt).toISOString()
      );
      expect(new Date(response.body.records[0].updatedAt).toISOString()).toBe(
        new Date(updatedAt).toISOString()
      );
    });

    it('should maintain tag order in exports', async () => {
      // Insert record with specific tag order
      await dataSource.query(
        `
        INSERT INTO records (user_id, content, tags, normalized_tags)
        VALUES ($1, $2, $3, $4)
      `,
        [
          userId,
          'zebra apple banana',
          ['zebra', 'apple', 'banana'],
          ['zebra', 'apple', 'banana'],
        ]
      );

      const response = await request(app)
        .get('/api/export')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.records).toHaveLength(1);
      // The content should preserve the original order: "zebra apple banana"
      expect(response.body.records[0].content).toBe('zebra apple banana');
    });

    it('should include normalization settings', async () => {
      const response = await request(app)
        .get('/api/export')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.metadata.normalizationRules).toBeDefined();
      expect(response.body.metadata.normalizationRules).toHaveProperty(
        'caseSensitive'
      );
      expect(response.body.metadata.normalizationRules).toHaveProperty(
        'removeAccents'
      );

      // Validate types
      expect(
        typeof response.body.metadata.normalizationRules.caseSensitive
      ).toBe('boolean');
      expect(
        typeof response.body.metadata.normalizationRules.removeAccents
      ).toBe('boolean');
    });
  });

  describe('Data Isolation', () => {
    it('should only export records owned by authenticated user', async () => {
      // Create another user
      const otherUserResult = await dataSource.query(
        `
        INSERT INTO users (email, google_id, display_name)
        VALUES ($1, $2, $3)
        RETURNING id
      `,
        ['other@example.com', 'google-456', 'Other User']
      );
      const otherUserId = otherUserResult[0].id;

      // Insert records for both users
      await dataSource.query(
        `
        INSERT INTO records (user_id, content, tags, normalized_tags)
        VALUES
          ($1, $2, $3, $4),
          ($5, $6, $7, $8)
      `,
        [
          userId,
          'my record',
          ['my', 'record'],
          ['my', 'record'],
          otherUserId,
          'other user record',
          ['other', 'user', 'record'],
          ['other', 'user', 'record'],
        ]
      );

      const response = await request(app)
        .get('/api/export')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should only export records for authenticated user
      expect(response.body.records).toHaveLength(1);
      expect(response.body.records[0].content).toBe('my record');
      expect(response.body.metadata.recordCount).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle export with no records', async () => {
      const response = await request(app)
        .get('/api/export')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.version).toBe('2.0');
      expect(response.body.records).toEqual([]);
      expect(response.body.metadata.recordCount).toBe(0);
    });

    it('should handle large datasets efficiently', async () => {
      // Insert 100 records
      const records = Array.from({ length: 100 }, (_, i) => [
        userId,
        `test record ${i}`,
        [`test`, `record`, `${i}`],
        [`test`, `record`, `${i}`],
      ]);

      for (const record of records) {
        await dataSource.query(
          `
          INSERT INTO records (user_id, content, tags, normalized_tags)
          VALUES ($1, $2, $3, $4)
        `,
          record
        );
      }

      const startTime = Date.now();
      const response = await request(app)
        .get('/api/export')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      const duration = Date.now() - startTime;

      expect(response.body.records).toHaveLength(100);
      expect(response.body.metadata.recordCount).toBe(100);
      // Should complete within 5 seconds as per PRD requirement
      expect(duration).toBeLessThan(5000);
    }, 10000);
  });

  describe('Schema Validation', () => {
    it('should produce export that passes v2.0 schema validation', async () => {
      // Insert test record
      await dataSource.query(
        `
        INSERT INTO records (user_id, content, tags, normalized_tags)
        VALUES ($1, $2, $3, $4)
      `,
        [userId, 'test content', ['test', 'content'], ['test', 'content']]
      );

      const response = await request(app)
        .get('/api/export')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Validate export structure matches v2.0 schema
      expect(response.body).toHaveProperty('version', '2.0');
      expect(response.body).toHaveProperty('records');
      expect(response.body).toHaveProperty('metadata');

      // Validate records array structure
      expect(Array.isArray(response.body.records)).toBe(true);
      expect(response.body.records.length).toBeGreaterThan(0);

      const record = response.body.records[0];
      expect(record).toHaveProperty('content');
      expect(record).toHaveProperty('createdAt');
      expect(record).toHaveProperty('updatedAt');
      expect(typeof record.content).toBe('string');
      expect(typeof record.createdAt).toBe('string');
      expect(typeof record.updatedAt).toBe('string');

      // Validate metadata structure
      expect(response.body.metadata).toHaveProperty('exportedAt');
      expect(response.body.metadata).toHaveProperty('recordCount');
      expect(response.body.metadata).toHaveProperty('normalizationRules');
      expect(typeof response.body.metadata.exportedAt).toBe('string');
      expect(typeof response.body.metadata.recordCount).toBe('number');
      expect(typeof response.body.metadata.normalizationRules).toBe('object');
      expect(response.body.metadata.normalizationRules).toHaveProperty(
        'caseSensitive'
      );
      expect(response.body.metadata.normalizationRules).toHaveProperty(
        'removeAccents'
      );
    });

    it('should generate valid ISO-8601 timestamps', async () => {
      const response = await request(app)
        .get('/api/export')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Validate exportedAt timestamp format
      const exportedAt = response.body.metadata.exportedAt;
      expect(exportedAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/
      );

      // Validate it's a valid date
      const date = new Date(exportedAt);
      expect(date.toISOString()).toBe(exportedAt);
    });
  });

  describe('User Settings Integration', () => {
    it('should include user specific normalization settings from database', async () => {
      // Update user settings
      await dataSource.query(
        `
        UPDATE user_settings
        SET case_sensitive = $1, remove_accents = $2
        WHERE user_id = $3
      `,
        [true, false, userId]
      );

      const response = await request(app)
        .get('/api/export')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.metadata.normalizationRules.caseSensitive).toBe(
        true
      );
      expect(response.body.metadata.normalizationRules.removeAccents).toBe(
        false
      );
    });

    it('should use default normalization settings if user_settings not found', async () => {
      // Create user without settings
      const newUserResult = await dataSource.query(
        `
        INSERT INTO users (email, google_id, display_name)
        VALUES ($1, $2, $3)
        RETURNING id
      `,
        ['newuser@example.com', 'google-789', 'New User']
      );
      const newUserId = newUserResult[0].id;

      const jwtService = authService.getJwtService();
      const newUserToken = jwtService.generateToken({
        userId: newUserId,
        email: 'newuser@example.com',
      });

      const response = await request(app)
        .get('/api/export')
        .set('Authorization', `Bearer ${newUserToken}`)
        .expect(200);

      // Should use default settings: caseSensitive=false, removeAccents=true
      expect(response.body.metadata.normalizationRules.caseSensitive).toBe(
        false
      );
      expect(response.body.metadata.normalizationRules.removeAccents).toBe(
        true
      );
    });
  });
});
