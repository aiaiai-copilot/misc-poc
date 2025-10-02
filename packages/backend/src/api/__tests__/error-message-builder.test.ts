/**
 * Error Message Builder Unit Tests
 * Task 12.7: Test user-friendly error message generation
 */

import { describe, it, expect } from '@jest/globals';
import { ErrorMessageBuilder } from '../utils/error-messages.js';

describe('ErrorMessageBuilder', () => {
  describe('buildDuplicateMessage', () => {
    it('should create user-friendly duplicate error message', () => {
      const result = ErrorMessageBuilder.buildDuplicateMessage(
        'test record content',
        41
      );

      expect(result.errorCode).toBe('DUPLICATE_RECORD');
      expect(result.errorMessage).toContain('test record content');
      expect(result.errorMessage).toContain('line 42'); // Index 41 = line 42
      expect(result.severity).toBe('warning');
      expect(result.suggestion).toBeDefined();
      expect(result.suggestion?.type).toBe('duplicate_update');
    });

    it('should truncate long content in error message', () => {
      const longContent = 'a'.repeat(100);
      const result = ErrorMessageBuilder.buildDuplicateMessage(longContent, 0);

      expect(result.errorMessage.length).toBeLessThan(longContent.length + 50);
      expect(result.errorMessage).toContain('...');
    });
  });

  describe('buildInvalidDateMessage', () => {
    it('should create user-friendly invalid date error message', () => {
      const result = ErrorMessageBuilder.buildInvalidDateMessage(
        '2024-13-45',
        9,
        'some content'
      );

      expect(result.errorCode).toBe('INVALID_DATE_FORMAT');
      expect(result.errorMessage).toContain('2024-13-45');
      expect(result.errorMessage).toContain('line 10');
      expect(result.severity).toBe('error');
      expect(result.suggestion?.example).toBe('2024-01-15T10:30:00.000Z');
    });
  });

  describe('buildEmptyContentMessage', () => {
    it('should create user-friendly empty content error message', () => {
      const result = ErrorMessageBuilder.buildEmptyContentMessage(4);

      expect(result.errorCode).toBe('EMPTY_CONTENT');
      expect(result.errorMessage).toContain('line 5');
      expect(result.severity).toBe('error');
      expect(result.suggestion?.type).toBe('remove_empty');
    });
  });

  describe('buildSizeLimitMessage', () => {
    it('[perf] should create user-friendly size limit error message', () => {
      const result = ErrorMessageBuilder.buildSizeLimitMessage(60000, 50000);

      expect(result.errorCode).toBe('TOO_MANY_RECORDS');
      expect(result.errorMessage).toContain('60,000');
      expect(result.errorMessage).toContain('50,000');
      expect(result.severity).toBe('error');
      expect(result.suggestion?.type).toBe('split_batch');
    });
  });

  describe('buildDatabaseErrorMessage', () => {
    it('should create user-friendly connection error message', () => {
      const result = ErrorMessageBuilder.buildDatabaseErrorMessage(
        'Connection timeout occurred'
      );

      expect(result.errorCode).toBe('CONNECTION_ERROR');
      expect(result.errorMessage).toContain('temporarily unavailable');
      expect(result.severity).toBe('error');
      expect(result.suggestion?.type).toBe('retry');
    });

    it('should sanitize sensitive information from error messages', () => {
      const result = ErrorMessageBuilder.buildDatabaseErrorMessage(
        'Error: pwd=secret123; database query failed'
      );

      expect(result.errorMessage).not.toContain('secret123');
      expect(result.errorMessage).toContain('pwd=***');
    });
  });
});
