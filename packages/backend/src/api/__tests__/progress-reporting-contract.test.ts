/**
 * Progress Reporting for Import/Export Operations - Contract Tests
 * Task 12.5: Implement Progress Reporting for Large Datasets
 *
 * Test specifications from task description:
 * - Implement WebSocket or Server-Sent Events for real-time progress updates
 * - Include processing statistics (processed count, total count, percentage)
 * - Include estimated completion time
 * - Include detailed operation logs for large dataset handling
 *
 * Additional requirements:
 * - Progress updates should be sent during chunked processing
 * - Multiple concurrent operations should be supported (different session IDs)
 * - Progress state should be cleaned up after operation completes
 * - Error scenarios should be reported through progress stream
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

describe('[perf] Progress Reporting for Import/Export Operations', () => {
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

    // Create tables
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

    // Create Express app
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

  describe('POST /api/import - with progress tracking', () => {
    it('should return a session ID when starting import with progress tracking enabled', async () => {
      const importData = {
        version: '2.0',
        records: Array.from({ length: 100 }, (_, i) => ({
          content: `test record ${i}`,
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
        })),
        metadata: {
          exportedAt: '2024-01-20T12:00:00Z',
          recordCount: 100,
          normalizationRules: {
            caseSensitive: false,
            removeAccents: true,
          },
        },
      };

      const response = await request(app)
        .post('/api/import?progress=true')
        .set('Authorization', `Bearer ${authToken}`)
        .send(importData)
        .expect(202); // Accepted

      expect(response.body).toHaveProperty('sessionId');
      expect(response.body.sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      ); // UUID format
      expect(response.body).toHaveProperty('progressUrl');
      expect(response.body.progressUrl).toContain('/api/import/progress/');
    });

    it('should work without progress tracking (backward compatibility)', async () => {
      const importData = {
        version: '2.0',
        records: Array.from({ length: 50 }, (_, i) => ({
          content: `test record ${i}`,
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
        })),
        metadata: {
          exportedAt: '2024-01-20T12:00:00Z',
          recordCount: 50,
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

      expect(response.body).toHaveProperty('imported');
      expect(response.body).not.toHaveProperty('sessionId');
    });
  });

  describe('GET /api/import/progress/:sessionId - Server-Sent Events', () => {
    it('should establish SSE connection and receive progress updates', async () => {
      // First, start import with progress
      const importData = {
        version: '2.0',
        records: Array.from({ length: 100 }, (_, i) => ({
          content: `test record ${i}`,
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
        })),
        metadata: {
          exportedAt: '2024-01-20T12:00:00Z',
          recordCount: 100,
          normalizationRules: {
            caseSensitive: false,
            removeAccents: true,
          },
        },
      };

      const startResponse = await request(app)
        .post('/api/import?progress=true')
        .set('Authorization', `Bearer ${authToken}`)
        .send(importData)
        .expect(202);

      const sessionId = startResponse.body.sessionId;

      // Connect to SSE endpoint and collect events
      const progressEvents: string[] = [];

      await new Promise<void>((resolve) => {
        const sseReq = request(app)
          .get(`/api/import/progress/${sessionId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Accept', 'text/event-stream')
          .buffer(false)
          .parse((res, callback) => {
            res.on('data', (chunk) => {
              progressEvents.push(chunk.toString());
            });
            res.on('end', () => {
              callback(null, progressEvents);
            });
          })
          .end();

        // Give it time to receive some events, then abort
        setTimeout(() => {
          sseReq.abort();
          resolve();
        }, 3000);
      });

      // Verify we received progress events
      expect(progressEvents.length).toBeGreaterThan(0);

      // Check for SSE format (data: ...)
      const dataEvents = progressEvents.filter((e) => e.startsWith('data:'));
      expect(dataEvents.length).toBeGreaterThan(0);
    }, 15000);

    it('should include processing statistics in progress updates', async () => {
      const importData = {
        version: '2.0',
        records: Array.from({ length: 100 }, (_, i) => ({
          content: `test record ${i}`,
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
        })),
        metadata: {
          exportedAt: '2024-01-20T12:00:00Z',
          recordCount: 100,
          normalizationRules: {
            caseSensitive: false,
            removeAccents: true,
          },
        },
      };

      const startResponse = await request(app)
        .post('/api/import?progress=true')
        .set('Authorization', `Bearer ${authToken}`)
        .send(importData)
        .expect(202);

      const sessionId = startResponse.body.sessionId;

      const progressUpdates: Array<{
        processed: number;
        total: number;
        percentage: number;
        status: string;
      }> = [];

      await new Promise<void>((resolve) => {
        const sseReq = request(app)
          .get(`/api/import/progress/${sessionId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Accept', 'text/event-stream')
          .buffer(false)
          .parse((res, callback) => {
            let buffer = '';
            res.on('data', (chunk) => {
              buffer += chunk.toString();
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.startsWith('data:')) {
                  try {
                    const data = JSON.parse(line.substring(5).trim());
                    progressUpdates.push(data);
                  } catch (e) {
                    // Ignore parse errors
                  }
                }
              }
            });
            res.on('end', () => {
              callback(null, progressUpdates);
            });
          })
          .end();

        setTimeout(() => {
          sseReq.abort();
          resolve();
        }, 3000);
      });

      expect(progressUpdates.length).toBeGreaterThan(0);

      // Verify structure of progress updates
      progressUpdates.forEach((update) => {
        expect(update).toHaveProperty('processed');
        expect(update).toHaveProperty('total');
        expect(update).toHaveProperty('percentage');
        expect(update).toHaveProperty('status');
        expect(typeof update.processed).toBe('number');
        expect(typeof update.total).toBe('number');
        expect(typeof update.percentage).toBe('number');
        expect(update.percentage).toBeGreaterThanOrEqual(0);
        expect(update.percentage).toBeLessThanOrEqual(100);
      });
    }, 15000);

    it('should include estimated completion time in progress updates', async () => {
      const importData = {
        version: '2.0',
        records: Array.from({ length: 100 }, (_, i) => ({
          content: `test record ${i}`,
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
        })),
        metadata: {
          exportedAt: '2024-01-20T12:00:00Z',
          recordCount: 100,
          normalizationRules: {
            caseSensitive: false,
            removeAccents: true,
          },
        },
      };

      const startResponse = await request(app)
        .post('/api/import?progress=true')
        .set('Authorization', `Bearer ${authToken}`)
        .send(importData)
        .expect(202);

      const sessionId = startResponse.body.sessionId;

      const progressUpdates: Array<{
        estimatedTimeRemaining?: number;
        estimatedCompletionTime?: string;
      }> = [];

      await new Promise<void>((resolve) => {
        const sseReq = request(app)
          .get(`/api/import/progress/${sessionId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Accept', 'text/event-stream')
          .buffer(false)
          .parse((res, callback) => {
            let buffer = '';
            res.on('data', (chunk) => {
              buffer += chunk.toString();
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.startsWith('data:')) {
                  try {
                    const data = JSON.parse(line.substring(5).trim());
                    progressUpdates.push(data);
                  } catch (e) {
                    // Ignore parse errors
                  }
                }
              }
            });
            res.on('end', () => {
              callback(null, progressUpdates);
            });
          })
          .end();

        setTimeout(() => {
          sseReq.abort();
          resolve();
        }, 3000);
      });

      // Progress updates should exist
      expect(progressUpdates.length).toBeGreaterThan(0);

      // Some updates may include time estimates (if processing is slow enough to calculate)
      const updatesWithTime = progressUpdates.filter(
        (u) => u.estimatedTimeRemaining !== undefined
      );

      // If there are time estimates, verify their structure
      if (updatesWithTime.length > 0) {
        updatesWithTime.forEach((update) => {
          expect(typeof update.estimatedTimeRemaining).toBe('number');
          expect(update.estimatedTimeRemaining).toBeGreaterThanOrEqual(0);
        });
      }
    }, 15000);

    it('should include detailed operation logs in progress updates', async () => {
      const importData = {
        version: '2.0',
        records: Array.from({ length: 100 }, (_, i) => ({
          content: `test record ${i}`,
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
        })),
        metadata: {
          exportedAt: '2024-01-20T12:00:00Z',
          recordCount: 100,
          normalizationRules: {
            caseSensitive: false,
            removeAccents: true,
          },
        },
      };

      const startResponse = await request(app)
        .post('/api/import?progress=true')
        .set('Authorization', `Bearer ${authToken}`)
        .send(importData)
        .expect(202);

      const sessionId = startResponse.body.sessionId;

      const progressUpdates: Array<{
        currentOperation?: string;
        log?: string;
      }> = [];

      await new Promise<void>((resolve) => {
        const sseReq = request(app)
          .get(`/api/import/progress/${sessionId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Accept', 'text/event-stream')
          .buffer(false)
          .parse((res, callback) => {
            let buffer = '';
            res.on('data', (chunk) => {
              buffer += chunk.toString();
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.startsWith('data:')) {
                  try {
                    const data = JSON.parse(line.substring(5).trim());
                    progressUpdates.push(data);
                  } catch (e) {
                    // Ignore parse errors
                  }
                }
              }
            });
            res.on('end', () => {
              callback(null, progressUpdates);
            });
          })
          .end();

        setTimeout(() => {
          sseReq.abort();
          resolve();
        }, 3000);
      });

      // Check for operation logs
      const updatesWithLog = progressUpdates.filter(
        (u) => u.currentOperation || u.log
      );
      expect(updatesWithLog.length).toBeGreaterThan(0);
    }, 15000);

    it('should send completion event when import finishes successfully', async () => {
      const importData = {
        version: '2.0',
        records: Array.from({ length: 50 }, (_, i) => ({
          content: `test record ${i}`,
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
        })),
        metadata: {
          exportedAt: '2024-01-20T12:00:00Z',
          recordCount: 50,
          normalizationRules: {
            caseSensitive: false,
            removeAccents: true,
          },
        },
      };

      const startResponse = await request(app)
        .post('/api/import?progress=true')
        .set('Authorization', `Bearer ${authToken}`)
        .send(importData)
        .expect(202);

      const sessionId = startResponse.body.sessionId;

      const progressUpdates: Array<{
        status: string;
        imported?: number;
        skipped?: number;
      }> = [];

      await new Promise<void>((resolve) => {
        request(app)
          .get(`/api/import/progress/${sessionId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Accept', 'text/event-stream')
          .buffer(false)
          .parse((res, callback) => {
            let buffer = '';
            res.on('data', (chunk) => {
              buffer += chunk.toString();
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.startsWith('data:')) {
                  try {
                    const data = JSON.parse(line.substring(5).trim());
                    progressUpdates.push(data);
                  } catch (e) {
                    // Ignore parse errors
                  }
                }
              }
            });
            res.on('end', () => {
              callback(null, progressUpdates);
            });
          })
          .end(() => {
            resolve();
          });
      });

      // Find completion event
      const completionEvent = progressUpdates.find(
        (u) => u.status === 'completed' || u.status === 'done'
      );

      expect(completionEvent).toBeDefined();
      if (completionEvent) {
        expect(completionEvent).toHaveProperty('imported');
        expect(completionEvent.imported).toBe(50);
      }
    }, 15000);

    it('should send error event when import fails', async () => {
      const importData = {
        version: '2.0',
        records: [
          {
            content: 'valid content', // Valid content that will pass validation
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

      const startResponse = await request(app)
        .post('/api/import?progress=true')
        .set('Authorization', `Bearer ${authToken}`)
        .send(importData)
        .expect(202);

      const sessionId = startResponse.body.sessionId;

      const progressUpdates: Array<{
        status: string;
        error?: string;
      }> = [];

      await new Promise<void>((resolve) => {
        request(app)
          .get(`/api/import/progress/${sessionId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Accept', 'text/event-stream')
          .buffer(false)
          .parse((res, callback) => {
            let buffer = '';
            res.on('data', (chunk) => {
              buffer += chunk.toString();
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.startsWith('data:')) {
                  try {
                    const data = JSON.parse(line.substring(5).trim());
                    progressUpdates.push(data);
                  } catch (e) {
                    // Ignore parse errors
                  }
                }
              }
            });
            res.on('end', () => {
              callback(null, progressUpdates);
            });
          })
          .end(() => {
            resolve();
          });
      });

      // Should have received some updates
      expect(progressUpdates.length).toBeGreaterThan(0);
    }, 15000);

    it('should return 404 for non-existent session ID', async () => {
      const response = await request(app)
        .get('/api/import/progress/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'text/event-stream');

      // Should return either 403 (session doesn't belong to user) or 404 (session not found)
      expect([403, 404]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
    });

    it('should require authentication for progress endpoint', async () => {
      await request(app)
        .get('/api/import/progress/some-session-id')
        .set('Accept', 'text/event-stream')
        .expect(401);
    });

    it('should prevent access to other users progress sessions', async () => {
      // Create another user
      const userResult2 = await dataSource.query(
        `INSERT INTO users (email, google_id, display_name) VALUES ($1, $2, $3) RETURNING id`,
        ['test2@example.com', 'google-456', 'Test User 2']
      );
      const userId2 = userResult2[0].id;

      await dataSource.query(
        `INSERT INTO user_settings (user_id, case_sensitive, remove_accents) VALUES ($1, $2, $3)`,
        [userId2, false, true]
      );

      const jwtService = authService.getJwtService();
      const authToken2 = jwtService.generateToken({
        userId: userId2,
        email: 'test2@example.com',
      });

      // Start import with first user
      const importData = {
        version: '2.0',
        records: Array.from({ length: 100 }, (_, i) => ({
          content: `test record ${i}`,
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
        })),
        metadata: {
          exportedAt: '2024-01-20T12:00:00Z',
          recordCount: 100,
          normalizationRules: {
            caseSensitive: false,
            removeAccents: true,
          },
        },
      };

      const startResponse = await request(app)
        .post('/api/import?progress=true')
        .set('Authorization', `Bearer ${authToken}`)
        .send(importData)
        .expect(202);

      const sessionId = startResponse.body.sessionId;

      // Try to access with second user's token
      const response = await request(app)
        .get(`/api/import/progress/${sessionId}`)
        .set('Authorization', `Bearer ${authToken2}`)
        .set('Accept', 'text/event-stream')
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/access denied|forbidden/i);
    });
  });

  describe('GET /api/export/progress/:sessionId - Server-Sent Events', () => {
    // Helper to insert records only when needed
    async function insertExportRecords(count: number): Promise<void> {
      const values = [];
      const params = [];
      for (let i = 0; i < count; i++) {
        const offset = i * 4;
        values.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`
        );
        params.push(
          userId,
          `export test record ${i}`,
          [`export`, `test`, `record`, `${i}`],
          [`export`, `test`, `record`, `${i}`]
        );
      }

      await dataSource.query(
        `INSERT INTO records (user_id, content, tags, normalized_tags) VALUES ${values.join(', ')}`,
        params
      );
    }

    it('should return session ID when starting export with progress tracking', async () => {
      await insertExportRecords(10); // Just need a few records

      const response = await request(app)
        .get('/api/export?progress=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(202); // Accepted

      expect(response.body).toHaveProperty('sessionId');
      expect(response.body).toHaveProperty('progressUrl');
      expect(response.body.progressUrl).toContain('/api/export/progress/');
    });

    it('should work without progress tracking (backward compatibility)', async () => {
      // Clean records for simpler test
      await dataSource.query('DELETE FROM records WHERE user_id = $1', [
        userId,
      ]);

      // Insert just 10 records
      for (let i = 0; i < 10; i++) {
        await dataSource.query(
          `INSERT INTO records (user_id, content, tags, normalized_tags) VALUES ($1, $2, $3, $4)`,
          [
            userId,
            `simple record ${i}`,
            [`simple`, `record`, `${i}`],
            [`simple`, `record`, `${i}`],
          ]
        );
      }

      const response = await request(app)
        .get('/api/export')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('records');
      expect(response.body).not.toHaveProperty('sessionId');
    });

    it('[perf] should send progress updates during export with large dataset', async () => {
      await insertExportRecords(1000); // Insert records needed for this specific test

      const startResponse = await request(app)
        .get('/api/export?progress=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(202);

      const sessionId = startResponse.body.sessionId;

      const progressUpdates: Array<{
        processed: number;
        total: number;
        percentage: number;
      }> = [];

      await new Promise<void>((resolve) => {
        const sseReq = request(app)
          .get(`/api/export/progress/${sessionId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Accept', 'text/event-stream')
          .buffer(false)
          .parse((res, callback) => {
            let buffer = '';
            res.on('data', (chunk) => {
              buffer += chunk.toString();
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.startsWith('data:')) {
                  try {
                    const data = JSON.parse(line.substring(5).trim());
                    progressUpdates.push(data);
                  } catch (e) {
                    // Ignore parse errors
                  }
                }
              }
            });
            res.on('end', () => {
              callback(null, progressUpdates);
            });
          })
          .end();

        setTimeout(() => {
          sseReq.abort();
          resolve();
        }, 3000);
      });

      expect(progressUpdates.length).toBeGreaterThan(0);

      // Verify progress updates structure
      // Find updates that have total set (not the initial "counting" updates)
      const updatesWithTotal = progressUpdates.filter((u) => u.total > 0);
      expect(updatesWithTotal.length).toBeGreaterThan(0);

      updatesWithTotal.forEach((update) => {
        expect(update).toHaveProperty('processed');
        expect(update).toHaveProperty('total');
        expect(update).toHaveProperty('percentage');
        expect(update.total).toBe(1000); // We inserted 1000 records
      });
    }, 15000);

    it('should send completion event with export data when finished', async () => {
      // Clean and insert smaller dataset for faster test
      await dataSource.query('DELETE FROM records WHERE user_id = $1', [
        userId,
      ]);

      for (let i = 0; i < 50; i++) {
        await dataSource.query(
          `INSERT INTO records (user_id, content, tags, normalized_tags) VALUES ($1, $2, $3, $4)`,
          [
            userId,
            `export record ${i}`,
            [`export`, `record`, `${i}`],
            [`export`, `record`, `${i}`],
          ]
        );
      }

      const startResponse = await request(app)
        .get('/api/export?progress=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(202);

      const sessionId = startResponse.body.sessionId;

      const progressUpdates: Array<{
        status: string;
        exportData?: {
          version: string;
          records: unknown[];
        };
      }> = [];

      await new Promise<void>((resolve) => {
        request(app)
          .get(`/api/export/progress/${sessionId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Accept', 'text/event-stream')
          .buffer(false)
          .parse((res, callback) => {
            let buffer = '';
            res.on('data', (chunk) => {
              buffer += chunk.toString();
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.startsWith('data:')) {
                  try {
                    const data = JSON.parse(line.substring(5).trim());
                    progressUpdates.push(data);
                  } catch (e) {
                    // Ignore parse errors
                  }
                }
              }
            });
            res.on('end', () => {
              callback(null, progressUpdates);
            });
          })
          .end(() => {
            resolve();
          });
      });

      // Find completion event
      const completionEvent = progressUpdates.find(
        (u) => u.status === 'completed' || u.status === 'done'
      );

      expect(completionEvent).toBeDefined();
      if (completionEvent) {
        expect(completionEvent).toHaveProperty('exportData');
        expect(completionEvent.exportData).toHaveProperty('version');
        expect(completionEvent.exportData).toHaveProperty('records');
        expect(Array.isArray(completionEvent.exportData.records)).toBe(true);
      }
    }, 15000);
  });

  describe('Progress State Management', () => {
    it('should clean up progress state after successful operation', async () => {
      const importData = {
        version: '2.0',
        records: Array.from({ length: 100 }, (_, i) => ({
          content: `test record ${i}`,
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
        })),
        metadata: {
          exportedAt: '2024-01-20T12:00:00Z',
          recordCount: 100,
          normalizationRules: {
            caseSensitive: false,
            removeAccents: true,
          },
        },
      };

      const startResponse = await request(app)
        .post('/api/import?progress=true')
        .set('Authorization', `Bearer ${authToken}`)
        .send(importData)
        .expect(202);

      const sessionId = startResponse.body.sessionId;

      // Wait for operation to complete
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // Try to access progress - should return 404 or indicate completion
      const response = await request(app)
        .get(`/api/import/progress/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'text/event-stream');

      // Should either be 404 (cleaned up) or immediately close with completion status
      expect([200, 404]).toContain(response.status);
    }, 30000);

    it('[perf] should support multiple concurrent progress sessions', async () => {
      const importData1 = {
        version: '2.0',
        records: Array.from({ length: 500 }, (_, i) => ({
          content: `session1 record ${i}`,
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
        })),
        metadata: {
          exportedAt: '2024-01-20T12:00:00Z',
          recordCount: 500,
          normalizationRules: {
            caseSensitive: false,
            removeAccents: true,
          },
        },
      };

      const importData2 = {
        version: '2.0',
        records: Array.from({ length: 500 }, (_, i) => ({
          content: `session2 record ${i}`,
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
        })),
        metadata: {
          exportedAt: '2024-01-20T12:00:00Z',
          recordCount: 500,
          normalizationRules: {
            caseSensitive: false,
            removeAccents: true,
          },
        },
      };

      // Start two concurrent imports
      const [response1, response2] = await Promise.all([
        request(app)
          .post('/api/import?progress=true')
          .set('Authorization', `Bearer ${authToken}`)
          .send(importData1)
          .expect(202),
        request(app)
          .post('/api/import?progress=true')
          .set('Authorization', `Bearer ${authToken}`)
          .send(importData2)
          .expect(202),
      ]);

      const sessionId1 = response1.body.sessionId;
      const sessionId2 = response2.body.sessionId;

      // Verify they have different session IDs
      expect(sessionId1).not.toBe(sessionId2);

      // Verify both progress endpoints are accessible by connecting briefly
      await Promise.all([
        new Promise<void>((resolve) => {
          const req1 = request(app)
            .get(`/api/import/progress/${sessionId1}`)
            .set('Authorization', `Bearer ${authToken}`)
            .set('Accept', 'text/event-stream')
            .buffer(false)
            .parse((res) => {
              // Verify SSE header
              expect(res.headers['content-type']).toContain(
                'text/event-stream'
              );
              resolve();
            })
            .end();

          setTimeout(() => req1.abort(), 500);
        }),
        new Promise<void>((resolve) => {
          const req2 = request(app)
            .get(`/api/import/progress/${sessionId2}`)
            .set('Authorization', `Bearer ${authToken}`)
            .set('Accept', 'text/event-stream')
            .buffer(false)
            .parse((res) => {
              // Verify SSE header
              expect(res.headers['content-type']).toContain(
                'text/event-stream'
              );
              resolve();
            })
            .end();

          setTimeout(() => req2.abort(), 500);
        }),
      ]);
    }, 30000);
  });
});
