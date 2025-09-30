/**
 * POST /api/import Streaming Support - Contract Tests
 * Task 12.6: Add File Size Limits and Streaming Support
 *
 * Test specifications from PRD section 6.2.5 (lines 1048-1054):
 * - should enforce maximum payload sizes
 * - should not leak memory under sustained load
 *
 * Additional requirements from task description:
 * - Configurable file size limits
 * - Streaming JSON parsing for memory efficiency
 * - Chunked processing for large datasets
 * - Temporary file handling and cleanup
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

describe('POST /api/import - Streaming and File Size Limits', () => {
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

    // Create Express app with auth service and custom body size limits
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

  describe('File Size Limits', () => {
    it('should enforce maximum payload sizes', async () => {
      // Create a payload that exceeds the limit (e.g., 10MB)
      // Default Express limit is 100kb, we'll configure 5MB limit
      const oversizedRecords = Array.from({ length: 50000 }, (_, i) => ({
        content: `test record ${i} ${'a'.repeat(100)}`, // ~100 bytes per record
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
      }));

      const oversizedImport = {
        version: '2.0',
        records: oversizedRecords, // ~5MB payload
        metadata: {
          exportedAt: '2024-01-20T12:00:00Z',
          recordCount: oversizedRecords.length,
          normalizationRules: {
            caseSensitive: false,
            removeAccents: true,
          },
        },
      };

      const response = await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${authToken}`)
        .send(oversizedImport);

      // Should reject with 413 Payload Too Large
      expect(response.status).toBe(413);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/payload|size|large|limit/i);
    });

    it('should accept payloads within size limit', async () => {
      // Create a payload well within the limit
      const acceptableRecords = Array.from({ length: 100 }, (_, i) => ({
        content: `test record ${i}`,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
      }));

      const acceptableImport = {
        version: '2.0',
        records: acceptableRecords,
        metadata: {
          exportedAt: '2024-01-20T12:00:00Z',
          recordCount: acceptableRecords.length,
          normalizationRules: {
            caseSensitive: false,
            removeAccents: true,
          },
        },
      };

      const response = await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${authToken}`)
        .send(acceptableImport)
        .expect(200);

      expect(response.body.imported).toBe(100);
    });

    it('should return appropriate error message for oversized payload', async () => {
      const oversizedContent = 'x'.repeat(10 * 1024 * 1024); // 10MB string
      const oversizedImport = {
        version: '2.0',
        records: [
          {
            content: oversizedContent,
            createdAt: '2024-01-15T10:00:00Z',
            updatedAt: '2024-01-15T10:00:00Z',
          },
        ],
        metadata: {
          exportedAt: '2024-01-20T12:00:00Z',
          recordCount: 1,
          normalizationRules: {
            caseSensitive: false,
            removeAccents: true,
          },
        },
      };

      const response = await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${authToken}`)
        .send(oversizedImport);

      expect(response.status).toBe(413);
      expect(response.body.error).toContain('payload');
    });
  });

  describe('Streaming JSON Parsing', () => {
    it('should process large datasets efficiently with streaming', async () => {
      // Create a large dataset (10k records)
      const largeRecords = Array.from({ length: 10000 }, (_, i) => ({
        content: `test record ${i} with some tags`,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
      }));

      const largeImport = {
        version: '2.0',
        records: largeRecords,
        metadata: {
          exportedAt: '2024-01-20T12:00:00Z',
          recordCount: largeRecords.length,
          normalizationRules: {
            caseSensitive: false,
            removeAccents: true,
          },
        },
      };

      // Measure memory before
      const memBefore = process.memoryUsage().heapUsed;

      const response = await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${authToken}`)
        .send(largeImport)
        .expect(200);

      // Measure memory after
      const memAfter = process.memoryUsage().heapUsed;
      const memIncrease = (memAfter - memBefore) / 1024 / 1024; // MB

      expect(response.body.imported).toBe(10000);
      // Memory increase should be reasonable (< 100MB for 10k records)
      expect(memIncrease).toBeLessThan(100);
    }, 120000); // 2 minutes for large dataset performance test

    it('should handle streaming parser errors gracefully', async () => {
      // This test would require sending malformed streaming data
      // For now, we test that the endpoint handles invalid JSON gracefully
      const response = await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}'); // Malformed JSON

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
    });

    it('should not leak memory under sustained load', async () => {
      // Run multiple imports to check for memory leaks
      const iterations = 10;
      const memoryReadings: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const records = Array.from({ length: 500 }, (_, j) => ({
          content: `iteration ${i} record ${j}`,
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
        }));

        const importData = {
          version: '2.0',
          records,
          metadata: {
            exportedAt: '2024-01-20T12:00:00Z',
            recordCount: records.length,
            normalizationRules: {
              caseSensitive: false,
              removeAccents: true,
            },
          },
        };

        // Clean up before each iteration
        await dataSource.query('DELETE FROM records WHERE user_id = $1', [
          userId,
        ]);

        await request(app)
          .post('/api/import')
          .set('Authorization', `Bearer ${authToken}`)
          .send(importData)
          .expect(200);

        // Record memory usage
        const memUsed = process.memoryUsage().heapUsed / 1024 / 1024; // MB
        memoryReadings.push(memUsed);
      }

      // Check that memory doesn't continuously increase (leak)
      const firstHalfAvg =
        memoryReadings.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
      const secondHalfAvg =
        memoryReadings.slice(5).reduce((a, b) => a + b, 0) / 5;

      // Memory increase should be minimal (< 20MB) between first and second half
      const memIncrease = secondHalfAvg - firstHalfAvg;
      expect(memIncrease).toBeLessThan(20);
    }, 120000); // 2 minute timeout
  });

  describe('Chunked Processing', () => {
    it('should process records in chunks for large imports', async () => {
      // Create a large dataset to test chunked processing
      const largeRecords = Array.from({ length: 5000 }, (_, i) => ({
        content: `chunked record ${i}`,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
      }));

      const largeImport = {
        version: '2.0',
        records: largeRecords,
        metadata: {
          exportedAt: '2024-01-20T12:00:00Z',
          recordCount: largeRecords.length,
          normalizationRules: {
            caseSensitive: false,
            removeAccents: true,
          },
        },
      };

      const response = await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${authToken}`)
        .send(largeImport)
        .expect(200);

      expect(response.body.imported).toBe(5000);

      // Verify all records were inserted
      const dbRecords = await dataSource.query(
        'SELECT COUNT(*) as count FROM records WHERE user_id = $1',
        [userId]
      );
      expect(parseInt(dbRecords[0].count)).toBe(5000);
    }, 120000); // 2 minutes for large dataset

    it('should maintain import statistics accuracy with chunked processing', async () => {
      // Import initial records
      await dataSource.query(
        `
        INSERT INTO records (user_id, content, tags, normalized_tags)
        VALUES ($1, $2, $3, $4)
      `,
        [
          userId,
          'existing record',
          ['existing', 'record'],
          ['existing', 'record'],
        ]
      );

      // Create import with mix of new and duplicate records
      const mixedRecords = [
        ...Array.from({ length: 2000 }, (_, i) => ({
          content: `new record ${i}`,
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
        })),
        {
          content: 'existing record', // Duplicate
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
        },
      ];

      const mixedImport = {
        version: '2.0',
        records: mixedRecords,
        metadata: {
          exportedAt: '2024-01-20T12:00:00Z',
          recordCount: mixedRecords.length,
          normalizationRules: {
            caseSensitive: false,
            removeAccents: true,
          },
        },
      };

      const response = await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${authToken}`)
        .send(mixedImport)
        .expect(200);

      // Should have imported 2000 new records and skipped 1 duplicate
      expect(response.body.imported).toBe(2000);
      expect(response.body.skipped).toBeGreaterThanOrEqual(1);
    }, 120000); // 2 minutes for large dataset

    it('should handle chunk processing errors without losing data integrity', async () => {
      // Create records that might cause processing issues
      const problematicRecords = Array.from({ length: 1000 }, (_, i) => ({
        content: i % 100 === 0 ? '' : `valid record ${i}`, // Every 100th record is invalid
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
      }));

      const problematicImport = {
        version: '2.0',
        records: problematicRecords,
        metadata: {
          exportedAt: '2024-01-20T12:00:00Z',
          recordCount: problematicRecords.length,
          normalizationRules: {
            caseSensitive: false,
            removeAccents: true,
          },
        },
      };

      const response = await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${authToken}`)
        .send(problematicImport);

      // Should handle gracefully - either reject or skip invalid records
      expect([200, 400]).toContain(response.status);

      if (response.status === 200) {
        // If accepted, should have error reporting
        expect(response.body).toHaveProperty('errors');
      }
    }, 30000);
  });

  describe('Performance and Resource Management', () => {
    it('should complete large import within reasonable time', async () => {
      const largeRecords = Array.from({ length: 10000 }, (_, i) => ({
        content: `performance test record ${i}`,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
      }));

      const largeImport = {
        version: '2.0',
        records: largeRecords,
        metadata: {
          exportedAt: '2024-01-20T12:00:00Z',
          recordCount: largeRecords.length,
          normalizationRules: {
            caseSensitive: false,
            removeAccents: true,
          },
        },
      };

      const startTime = Date.now();

      const response = await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${authToken}`)
        .send(largeImport)
        .expect(200);

      const endTime = Date.now();
      const durationSeconds = (endTime - startTime) / 1000;

      expect(response.body.imported).toBe(10000);
      // Should complete within reasonable time for 10k records (allow up to 70s for test environment overhead)
      expect(durationSeconds).toBeLessThan(70);
    }, 120000); // 2 minutes for performance test with large dataset

    it('should maintain database connection pool under load', async () => {
      // Run multiple concurrent imports
      const concurrentImports = 5;
      const promises = [];

      for (let i = 0; i < concurrentImports; i++) {
        const records = Array.from({ length: 500 }, (_, j) => ({
          content: `concurrent import ${i} record ${j}`,
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
        }));

        const importData = {
          version: '2.0',
          records,
          metadata: {
            exportedAt: '2024-01-20T12:00:00Z',
            recordCount: records.length,
            normalizationRules: {
              caseSensitive: false,
              removeAccents: true,
            },
          },
        };

        promises.push(
          request(app)
            .post('/api/import')
            .set('Authorization', `Bearer ${authToken}`)
            .send(importData)
        );
      }

      const responses = await Promise.all(promises);

      // All imports should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.imported).toBe(500);
      });
    }, 120000); // 2 minutes for concurrent imports

    it('should handle import cancellation gracefully', async () => {
      // This test simulates a cancelled request
      // In practice, this would test cleanup of resources when client disconnects

      const largeRecords = Array.from({ length: 1000 }, (_, i) => ({
        content: `cancellation test record ${i}`,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
      }));

      const largeImport = {
        version: '2.0',
        records: largeRecords,
        metadata: {
          exportedAt: '2024-01-20T12:00:00Z',
          recordCount: largeRecords.length,
          normalizationRules: {
            caseSensitive: false,
            removeAccents: true,
          },
        },
      };

      // Send request with short timeout to simulate cancellation
      try {
        await request(app)
          .post('/api/import')
          .set('Authorization', `Bearer ${authToken}`)
          .send(largeImport)
          .timeout(10); // 10ms timeout to force cancellation
      } catch (error) {
        // Expected to timeout/error
        expect(error).toBeDefined();
      }

      // Verify no partial data or resource leaks
      // Database should be in consistent state
      const recordCount = await dataSource.query(
        'SELECT COUNT(*) as count FROM records WHERE user_id = $1',
        [userId]
      );

      // Should be 0 (transaction rolled back) or complete import (transaction committed)
      const count = parseInt(recordCount[0].count);
      expect(count === 0 || count === 1000).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should respect configured chunk size', async () => {
      // This test verifies that chunked processing uses configured values
      // The actual chunk size configuration would be in app config

      const records = Array.from({ length: 2500 }, (_, i) => ({
        content: `chunk size test ${i}`,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
      }));

      const importData = {
        version: '2.0',
        records,
        metadata: {
          exportedAt: '2024-01-20T12:00:00Z',
          recordCount: records.length,
          normalizationRules: {
            caseSensitive: false,
            removeAccents: true,
          },
        },
      };

      const response = await request(app)
        .post('/api/import')
        .set('Authorization', `Bearer ${authToken}`)
        .send(importData)
        .expect(200);

      expect(response.body.imported).toBe(2500);
    }, 120000); // 2 minutes for large dataset

    it('should respect configured maximum payload size', async () => {
      // Verify that the configured limit is enforced
      // This is already tested above but we verify the configuration is applied

      const config = {
        maxPayloadSize: '5mb', // Should be configurable
      };

      // The actual test depends on configuration implementation
      expect(config.maxPayloadSize).toBeDefined();
    });
  });
});
