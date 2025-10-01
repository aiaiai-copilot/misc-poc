/**
 * Error Recovery Service Integration Tests
 * Task 12.7: Test error recovery service with real database
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { ErrorRecoveryService } from '../services/error-recovery-service.js';
import { ErrorMessageBuilder } from '../utils/error-messages.js';

describe('[perf] ErrorRecoveryService Integration Tests', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let service: ErrorRecoveryService;
  const testUserId = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    container = await new PostgreSqlContainer('postgres:15-alpine')
      .withStartupTimeout(120000)
      .start();

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

    // Create schema
    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        google_id VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS import_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id VARCHAR(255) UNIQUE NOT NULL,
        status VARCHAR(50) NOT NULL,
        total_records INTEGER NOT NULL,
        processed_records INTEGER NOT NULL DEFAULT 0,
        imported_records INTEGER NOT NULL DEFAULT 0,
        failed_records INTEGER NOT NULL DEFAULT 0,
        last_processed_index INTEGER,
        error_log JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Insert test user
    await dataSource.query(
      `INSERT INTO users (id, email, google_id) VALUES ($1, $2, $3)`,
      [testUserId, 'test@example.com', 'google-123']
    );

    service = new ErrorRecoveryService(dataSource);
  });

  afterEach(async () => {
    await dataSource?.destroy();
    await container?.stop();
  });

  describe('Session Management', () => {
    it('should create new import session', async () => {
      const session = await service.createSession(testUserId, 1000);

      expect(session).toBeDefined();
      expect(session.userId).toBe(testUserId);
      expect(session.totalRecords).toBe(1000);
      expect(session.processedRecords).toBe(0);
      expect(session.status).toBe('initializing');
      expect(session.sessionId).toMatch(/^import-/);
    });

    it('should retrieve existing session by ID', async () => {
      const created = await service.createSession(testUserId, 500);
      const retrieved = await service.getSession(created.sessionId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.sessionId).toBe(created.sessionId);
      expect(retrieved?.totalRecords).toBe(500);
    });

    it('should update session progress', async () => {
      const session = await service.createSession(testUserId, 100);

      await service.updateSessionProgress(session.sessionId, 50, 45, 5, 49);

      const updated = await service.getSession(session.sessionId);
      expect(updated?.processedRecords).toBe(50);
      expect(updated?.importedRecords).toBe(45);
      expect(updated?.failedRecords).toBe(5);
      expect(updated?.lastProcessedIndex).toBe(49);
    });

    it('should update session status', async () => {
      const session = await service.createSession(testUserId, 100);

      await service.updateSessionStatus(session.sessionId, 'in-progress');
      let updated = await service.getSession(session.sessionId);
      expect(updated?.status).toBe('in-progress');

      await service.updateSessionStatus(session.sessionId, 'paused');
      updated = await service.getSession(session.sessionId);
      expect(updated?.status).toBe('paused');
    });

    it('should cancel import session', async () => {
      const session = await service.createSession(testUserId, 100);

      await service.cancelSession(session.sessionId);

      const updated = await service.getSession(session.sessionId);
      expect(updated?.status).toBe('cancelled');
    });
  });

  describe('Error Logging', () => {
    it('should log errors to session', async () => {
      const session = await service.createSession(testUserId, 100);

      const error = ErrorMessageBuilder.buildEmptyContentMessage(5);
      await service.logError(session.sessionId, error);

      const updated = await service.getSession(session.sessionId);
      expect(updated?.errorLog).toHaveLength(1);
      expect(updated?.errorLog[0].errorCode).toBe('EMPTY_CONTENT');
      expect(updated?.errorLog[0].recordIndex).toBe(5);
    });

    it('should limit error log size to prevent memory exhaustion', async () => {
      const session = await service.createSession(testUserId, 2000);

      // Add more than MAX_ERROR_LOG_SIZE errors
      for (let i = 0; i < 1100; i++) {
        const error = ErrorMessageBuilder.buildEmptyContentMessage(i);
        await service.logError(session.sessionId, error);
      }

      const updated = await service.getSession(session.sessionId);
      expect(updated?.errorLog.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('Resume Capability', () => {
    it('should allow resume for paused session', async () => {
      const session = await service.createSession(testUserId, 100);
      await service.updateSessionStatus(session.sessionId, 'paused');
      await service.updateSessionProgress(session.sessionId, 50, 45, 5, 49);

      const canResume = await service.canResume(session.sessionId);
      expect(canResume).toBe(true);
    });

    it('should allow resume for failed session', async () => {
      const session = await service.createSession(testUserId, 100);
      await service.updateSessionStatus(session.sessionId, 'failed');

      const canResume = await service.canResume(session.sessionId);
      expect(canResume).toBe(true);
    });

    it('should not allow resume for completed session', async () => {
      const session = await service.createSession(testUserId, 100);
      await service.updateSessionStatus(session.sessionId, 'completed');

      const canResume = await service.canResume(session.sessionId);
      expect(canResume).toBe(false);
    });

    it('should provide resume information', async () => {
      const session = await service.createSession(testUserId, 1000);
      await service.updateSessionStatus(session.sessionId, 'paused');
      await service.updateSessionProgress(session.sessionId, 600, 550, 50, 599);

      const resumeInfo = await service.getResumeInfo(session.sessionId);

      expect(resumeInfo).toBeDefined();
      expect(resumeInfo?.sessionId).toBe(session.sessionId);
      expect(resumeInfo?.lastProcessedIndex).toBe(599);
      expect(resumeInfo?.remainingRecords).toBe(400);
      expect(resumeInfo?.estimatedTime).toBeGreaterThan(0);
    });
  });

  describe('Error Summary and Reporting', () => {
    it('should generate error summary from session', async () => {
      const session = await service.createSession(testUserId, 100);
      await service.updateSessionProgress(session.sessionId, 100, 85, 15, 99);

      // Log various errors
      await service.logError(
        session.sessionId,
        ErrorMessageBuilder.buildEmptyContentMessage(5)
      );
      await service.logError(
        session.sessionId,
        ErrorMessageBuilder.buildEmptyContentMessage(10)
      );
      await service.logError(
        session.sessionId,
        ErrorMessageBuilder.buildDuplicateMessage('test', 15)
      );

      const summary = await service.getErrorSummary(session.sessionId);

      expect(summary.totalErrors).toBe(3);
      expect(summary.errorsByType['EMPTY_CONTENT']).toBe(2);
      expect(summary.errorsByType['DUPLICATE_RECORD']).toBe(1);
      expect(summary.successfulRecords).toBe(85);
      expect(summary.failedRecords).toBe(15);
      expect(summary.affectedRecords).toContain(5);
      expect(summary.affectedRecords).toContain(10);
      expect(summary.affectedRecords).toContain(15);
    });

    it('should generate repair suggestions based on errors', () => {
      const errors = [
        ErrorMessageBuilder.buildDuplicateMessage('test', 0),
        ErrorMessageBuilder.buildInvalidDateMessage('bad-date', 1),
        ErrorMessageBuilder.buildEmptyContentMessage(2),
      ];

      const suggestions = service.generateRepairSuggestions(errors);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((s) => s.type === 'duplicate_update')).toBe(true);
      expect(suggestions.some((s) => s.type === 'date_format')).toBe(true);
      expect(suggestions.some((s) => s.type === 'remove_empty')).toBe(true);
    });

    it('should build comprehensive error response', async () => {
      const session = await service.createSession(testUserId, 100);
      await service.updateSessionStatus(session.sessionId, 'paused');
      await service.updateSessionProgress(session.sessionId, 50, 45, 5, 49);

      await service.logError(
        session.sessionId,
        ErrorMessageBuilder.buildDuplicateMessage('test', 10)
      );

      const response = await service.buildErrorResponse(session.sessionId);

      expect(response.success).toBe(false);
      expect(response.sessionId).toBe(session.sessionId);
      expect(response.canResume).toBe(true);
      expect(response.errorSummary).toBeDefined();
      expect(response.errors).toBeDefined();
      expect(response.repairSuggestions).toBeDefined();
      expect(response.resumeInfo).toBeDefined();
    });
  });
});
