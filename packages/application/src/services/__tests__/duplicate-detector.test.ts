/**
 * Duplicate Detector Service - Unit Tests
 * Task 12.4: Add Duplicate Detection and Conflict Resolution
 *
 * Test specifications from PRD section 4.3.2 and task description:
 * - Duplicate detection using record IDs
 * - Duplicate detection using timestamps
 * - Duplicate detection using content hashes
 * - Conflict resolution strategies (skip, overwrite, merge)
 * - Detailed conflict reporting
 */

import { RecordDTO } from '../../dtos/record-dto';
import { DuplicateDetector } from '../duplicate-detector';

describe('DuplicateDetector Service', () => {
  let detector: DuplicateDetector;

  beforeEach(() => {
    detector = new DuplicateDetector();
  });

  const createRecordDTO = (overrides: Partial<RecordDTO> = {}): RecordDTO => ({
    id: 'test-id-123',
    content: 'test content',
    tagIds: ['tag1', 'tag2'],
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
    ...overrides,
  });

  describe('Content Hash Generation', () => {
    it('should generate MD5 hash for record content', () => {
      const content = 'test content';
      const hash = detector.generateContentHash(content, 'md5');

      expect(hash).toBeDefined();
      expect(hash).toHaveLength(32); // MD5 is 32 hex chars
      expect(hash).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should generate SHA256 hash for record content', () => {
      const content = 'test content';
      const hash = detector.generateContentHash(content, 'sha256');

      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64); // SHA256 is 64 hex chars
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate same hash for identical content', () => {
      const content = 'test content';
      const hash1 = detector.generateContentHash(content);
      const hash2 = detector.generateContentHash(content);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different content', () => {
      const hash1 = detector.generateContentHash('content one');
      const hash2 = detector.generateContentHash('content two');

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty content', () => {
      const hash = detector.generateContentHash('');

      expect(hash).toBeDefined();
      expect(hash).toHaveLength(32); // MD5 default
    });

    it('should handle special characters in content', () => {
      const content = 'test with émojis 🎉 and spëcial çharacters';
      const hash = detector.generateContentHash(content);

      expect(hash).toBeDefined();
      expect(hash).toHaveLength(32);
    });
  });

  describe('ID-based Duplicate Detection', () => {
    it('should detect duplicate by matching record ID', () => {
      const incoming = createRecordDTO({ id: 'abc-123' });
      const existing = [
        createRecordDTO({ id: 'abc-123', content: 'different content' }),
      ];

      const result = detector.detect(incoming, existing, { compareBy: ['id'] });

      expect(result.isDuplicate).toBe(true);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].matchedBy).toBe('id');
    });

    it('should not detect duplicate when IDs differ', () => {
      const incoming = createRecordDTO({ id: 'abc-123' });
      const existing = [createRecordDTO({ id: 'xyz-789' })];

      const result = detector.detect(incoming, existing, { compareBy: ['id'] });

      expect(result.isDuplicate).toBe(false);
      expect(result.matches).toHaveLength(0);
    });

    it('should handle records without IDs gracefully', () => {
      const incoming = createRecordDTO({ id: undefined });
      const existing = [createRecordDTO({ id: undefined })];

      const result = detector.detect(incoming, existing, { compareBy: ['id'] });

      expect(result.isDuplicate).toBe(false);
    });
  });

  describe('Content-based Duplicate Detection', () => {
    it('should detect duplicate by matching content hash', () => {
      const content = 'meeting project alpha';
      const incoming = createRecordDTO({ content });
      const existing = [createRecordDTO({ content, id: 'different-id' })];

      const result = detector.detect(incoming, existing, {
        compareBy: ['content'],
      });

      expect(result.isDuplicate).toBe(true);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].matchedBy).toBe('content');
    });

    it('should detect duplicate ignoring whitespace differences', () => {
      const incoming = createRecordDTO({ content: 'meeting  project  alpha' });
      const existing = [createRecordDTO({ content: 'meeting project alpha' })];

      const result = detector.detect(incoming, existing, {
        compareBy: ['content'],
        normalizeWhitespace: true,
      });

      expect(result.isDuplicate).toBe(true);
    });

    it('should detect duplicate ignoring case when configured', () => {
      const incoming = createRecordDTO({ content: 'Meeting Project Alpha' });
      const existing = [createRecordDTO({ content: 'meeting project alpha' })];

      const result = detector.detect(incoming, existing, {
        compareBy: ['content'],
        caseInsensitive: true,
      });

      expect(result.isDuplicate).toBe(true);
    });

    it('should not detect duplicate when content differs', () => {
      const incoming = createRecordDTO({ content: 'meeting project alpha' });
      const existing = [createRecordDTO({ content: 'meeting project beta' })];

      const result = detector.detect(incoming, existing, {
        compareBy: ['content'],
      });

      expect(result.isDuplicate).toBe(false);
    });

    it('should handle empty content edge case', () => {
      const incoming = createRecordDTO({ content: '' });
      const existing = [createRecordDTO({ content: '' })];

      const result = detector.detect(incoming, existing, {
        compareBy: ['content'],
      });

      expect(result.isDuplicate).toBe(true);
    });
  });

  describe('Timestamp-based Duplicate Detection', () => {
    it('should detect duplicate by matching exact timestamps', () => {
      const timestamp = '2024-01-15T10:00:00Z';
      const incoming = createRecordDTO({
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      const existing = [
        createRecordDTO({ createdAt: timestamp, updatedAt: timestamp }),
      ];

      const result = detector.detect(incoming, existing, {
        compareBy: ['timestamp'],
      });

      expect(result.isDuplicate).toBe(true);
      expect(result.matches[0].matchedBy).toBe('timestamp');
    });

    it('should detect duplicate within timestamp tolerance', () => {
      const incoming = createRecordDTO({ createdAt: '2024-01-15T10:00:00Z' });
      const existing = [createRecordDTO({ createdAt: '2024-01-15T10:00:01Z' })];

      const result = detector.detect(incoming, existing, {
        compareBy: ['timestamp'],
        timestampToleranceMs: 5000,
      });

      expect(result.isDuplicate).toBe(true);
    });

    it('should not detect duplicate outside timestamp tolerance', () => {
      const incoming = createRecordDTO({
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
      });
      const existing = [
        createRecordDTO({
          createdAt: '2024-01-15T10:01:00Z',
          updatedAt: '2024-01-15T10:01:00Z',
        }),
      ];

      const result = detector.detect(incoming, existing, {
        compareBy: ['timestamp'],
        timestampToleranceMs: 5000, // 5 seconds, but diff is 60 seconds
      });

      expect(result.isDuplicate).toBe(false);
    });

    it('should handle invalid timestamp formats gracefully', () => {
      const incoming = createRecordDTO({
        createdAt: 'invalid-timestamp',
        updatedAt: 'also-invalid',
      });
      const existing = [
        createRecordDTO({
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
        }),
      ];

      const result = detector.detect(incoming, existing, {
        compareBy: ['timestamp'],
      });

      expect(result.isDuplicate).toBe(false);
    });

    it('should compare both createdAt and updatedAt timestamps', () => {
      const incoming = createRecordDTO({
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T11:00:00Z',
      });
      const existing = [
        createRecordDTO({
          createdAt: '2024-01-15T09:00:00Z',
          updatedAt: '2024-01-15T11:00:00Z',
        }),
      ];

      const result = detector.detect(incoming, existing, {
        compareBy: ['timestamp'],
        timestampToleranceMs: 1000,
      });

      expect(result.isDuplicate).toBe(true);
    });
  });

  describe('Multi-criteria Duplicate Detection', () => {
    it('should detect duplicate when multiple criteria match', () => {
      const record = createRecordDTO({
        id: 'same-id',
        content: 'same content',
        createdAt: '2024-01-15T10:00:00Z',
      });
      const incoming = record;
      const existing = [record];

      const result = detector.detect(incoming, existing, {
        compareBy: ['id', 'content', 'timestamp'],
      });

      expect(result.isDuplicate).toBe(true);
      expect(result.confidence).toBe(100);
    });

    it('should detect duplicate when subset of criteria match', () => {
      const incoming = createRecordDTO({
        id: 'different-id',
        content: 'same content',
        createdAt: '2024-01-15T10:00:00Z',
      });
      const existing = [
        createRecordDTO({
          id: 'another-id',
          content: 'same content',
          createdAt: '2024-01-15T10:00:00Z',
        }),
      ];

      const result = detector.detect(incoming, existing, {
        compareBy: ['id', 'content', 'timestamp'],
      });

      expect(result.isDuplicate).toBe(true);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThan(100);
    });

    it('should calculate confidence score based on matching criteria', () => {
      const incoming = createRecordDTO({ content: 'same content' });
      const existing = [
        createRecordDTO({ content: 'same content', id: 'different-id' }),
      ];

      const result = detector.detect(incoming, existing, {
        compareBy: ['id', 'content', 'timestamp'],
      });

      expect(result.isDuplicate).toBe(true);
      // 2 out of 3 criteria match (content + timestamp), so 66.67%
      expect(result.confidence).toBeCloseTo(66.67, 0);
    });

    it('should prioritize criteria based on configuration', () => {
      const incoming = createRecordDTO({ content: 'same content' });
      const existing = [createRecordDTO({ content: 'same content' })];

      const result = detector.detect(incoming, existing, {
        compareBy: ['content', 'timestamp'],
      });

      expect(result.isDuplicate).toBe(true);
    });
  });

  describe('Multiple Matches Handling', () => {
    it('should return all matching existing records', () => {
      const content = 'duplicate content';
      const incoming = createRecordDTO({ content });
      const existing = [
        createRecordDTO({ content, id: 'id-1' }),
        createRecordDTO({ content, id: 'id-2' }),
        createRecordDTO({ content, id: 'id-3' }),
      ];

      const result = detector.detect(incoming, existing, {
        compareBy: ['content'],
      });

      expect(result.matches).toHaveLength(3);
    });

    it('should rank matches by confidence score', () => {
      const incoming = createRecordDTO({
        id: 'test-id',
        content: 'test content',
      });
      const existing = [
        createRecordDTO({ id: 'test-id', content: 'different' }), // ID match only
        createRecordDTO({ id: 'test-id', content: 'test content' }), // Both match
      ];

      const result = detector.detect(incoming, existing, {
        compareBy: ['id', 'content'],
      });

      expect(result.matches[0].confidence).toBeGreaterThan(
        result.matches[1].confidence
      );
    });

    it('should include match reason in each result', () => {
      const incoming = createRecordDTO({ content: 'test' });
      const existing = [createRecordDTO({ content: 'test' })];

      const result = detector.detect(incoming, existing, {
        compareBy: ['content'],
      });

      expect(result.matches[0].matchedBy).toBeDefined();
      expect(['id', 'content', 'timestamp']).toContain(
        result.matches[0].matchedBy
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty existing records array', () => {
      const incoming = createRecordDTO();
      const result = detector.detect(incoming, []);

      expect(result.isDuplicate).toBe(false);
      expect(result.matches).toHaveLength(0);
      expect(result.confidence).toBe(0);
    });

    it('should handle null/undefined config gracefully', () => {
      const incoming = createRecordDTO({ content: 'test' });
      const existing = [createRecordDTO({ content: 'test' })];

      const result = detector.detect(incoming, existing);

      expect(result).toBeDefined();
      expect(result.isDuplicate).toBe(true);
    });

    it('should handle records with missing fields', () => {
      const incoming = createRecordDTO({ tagIds: [] });
      const existing = [createRecordDTO({ tagIds: [] })];

      const result = detector.detect(incoming, existing);

      expect(result).toBeDefined();
    });

    it('should handle very large content strings', () => {
      const largeContent = 'a'.repeat(10000);
      const incoming = createRecordDTO({ content: largeContent });
      const existing = [createRecordDTO({ content: largeContent })];

      const startTime = Date.now();
      const result = detector.detect(incoming, existing, {
        compareBy: ['content'],
      });
      const duration = Date.now() - startTime;

      expect(result.isDuplicate).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });
  });

  describe('Configuration Options', () => {
    it('should respect compareBy configuration', () => {
      const incoming = createRecordDTO({
        id: 'same-id',
        content: 'different content',
      });
      const existing = [
        createRecordDTO({ id: 'same-id', content: 'other content' }),
      ];

      const result = detector.detect(incoming, existing, {
        compareBy: ['content'], // Only check content
      });

      expect(result.isDuplicate).toBe(false);
    });

    it('should use configured hash algorithm', () => {
      const content = 'test content';
      const sha256Hash = detector.generateContentHash(content, 'sha256');

      expect(sha256Hash).toHaveLength(64);
    });

    it('should validate configuration parameters', () => {
      const incoming = createRecordDTO();
      const existing = [createRecordDTO()];

      // Should not crash with unusual config
      const result = detector.detect(incoming, existing, {
        compareBy: [],
      });

      expect(result).toBeDefined();
    });
  });
});
