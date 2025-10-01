/**
 * Export Format Schema Validation Tests
 * Task 12.1: Design Import/Export Data Format Schemas
 *
 * Test Specification from PRD section 4.2.3:
 * - V1.0 format (localStorage) validation
 * - V2.0 format (PostgreSQL) validation
 * - Discriminated union for version-based parsing
 * - Field validation, type checking, and version compatibility
 */

import { describe, it, expect } from '@jest/globals';

// Import schemas that we'll create
import {
  ExportRecordV1Schema,
  ExportFormatV1Schema,
  ExportRecordV2Schema,
  NormalizationRulesSchema,
  ExportMetadataV2Schema,
  ExportFormatV2Schema,
  ExportFormatSchema,
  ImportResultSchema,
  type ExportFormatV1,
  type ExportFormatV2,
  type ExportFormat,
  type ImportResult,
} from '../export-format-schema';

describe('Export Format Schema Validation', () => {
  describe('ExportRecordV1Schema', () => {
    it('should validate valid v1.0 record', () => {
      const validRecord = {
        content: 'peter ivanov phone 89151234455',
        createdAt: '2025-01-15T10:30:00.000Z',
      };

      const result = ExportRecordV1Schema.safeParse(validRecord);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe(validRecord.content);
        expect(result.data.createdAt).toBe(validRecord.createdAt);
      }
    });

    it('should reject record with empty content', () => {
      const invalidRecord = {
        content: '',
        createdAt: '2025-01-15T10:30:00.000Z',
      };

      const result = ExportRecordV1Schema.safeParse(invalidRecord);
      expect(result.success).toBe(false);
    });

    it('should reject record with invalid timestamp', () => {
      const invalidRecord = {
        content: 'test content',
        createdAt: 'not-a-date',
      };

      const result = ExportRecordV1Schema.safeParse(invalidRecord);
      expect(result.success).toBe(false);
    });

    it('should reject record with missing fields', () => {
      const invalidRecord = {
        content: 'test content',
      };

      const result = ExportRecordV1Schema.safeParse(invalidRecord);
      expect(result.success).toBe(false);
    });

    it('should accept record with content up to max length', () => {
      const maxContent = 'a'.repeat(10000); // Assuming 10k chars max
      const validRecord = {
        content: maxContent,
        createdAt: '2025-01-15T10:30:00.000Z',
      };

      const result = ExportRecordV1Schema.safeParse(validRecord);
      expect(result.success).toBe(true);
    });

    it('should reject record with content exceeding max length', () => {
      const tooLongContent = 'a'.repeat(10001);
      const invalidRecord = {
        content: tooLongContent,
        createdAt: '2025-01-15T10:30:00.000Z',
      };

      const result = ExportRecordV1Schema.safeParse(invalidRecord);
      expect(result.success).toBe(false);
    });
  });

  describe('ExportFormatV1Schema', () => {
    it('should validate valid v1.0 export format', () => {
      const validExport: ExportFormatV1 = {
        version: '1.0',
        records: [
          {
            content: 'peter ivanov phone 89151234455',
            createdAt: '2025-01-15T10:30:00.000Z',
          },
          {
            content: 'meeting tomorrow 15:00',
            createdAt: '2025-01-15T11:00:00.000Z',
          },
        ],
        metadata: {
          exportedAt: '2025-01-15T12:00:00.000Z',
          recordCount: 2,
        },
      };

      const result = ExportFormatV1Schema.safeParse(validExport);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe('1.0');
        expect(result.data.records).toHaveLength(2);
      }
    });

    it('should validate v1.0 format without optional metadata', () => {
      const validExport = {
        version: '1.0',
        records: [
          {
            content: 'test content',
            createdAt: '2025-01-15T10:30:00.000Z',
          },
        ],
      };

      const result = ExportFormatV1Schema.safeParse(validExport);
      expect(result.success).toBe(true);
    });

    it('should validate v1.0 format with partial metadata', () => {
      const validExport = {
        version: '1.0',
        records: [],
        metadata: {
          exportedAt: '2025-01-15T12:00:00.000Z',
        },
      };

      const result = ExportFormatV1Schema.safeParse(validExport);
      expect(result.success).toBe(true);
    });

    it('should validate v1.0 format with empty records array', () => {
      const validExport = {
        version: '1.0',
        records: [],
      };

      const result = ExportFormatV1Schema.safeParse(validExport);
      expect(result.success).toBe(true);
    });

    it('should reject v1.0 format with wrong version', () => {
      const invalidExport = {
        version: '2.0',
        records: [],
      };

      const result = ExportFormatV1Schema.safeParse(invalidExport);
      expect(result.success).toBe(false);
    });

    it('should reject v1.0 format with invalid record', () => {
      const invalidExport = {
        version: '1.0',
        records: [
          {
            content: '', // Empty content is invalid
            createdAt: '2025-01-15T10:30:00.000Z',
          },
        ],
      };

      const result = ExportFormatV1Schema.safeParse(invalidExport);
      expect(result.success).toBe(false);
    });
  });

  describe('ExportRecordV2Schema', () => {
    it('should validate valid v2.0 record', () => {
      const validRecord = {
        content: 'peter ivanov phone 89151234455',
        createdAt: '2025-01-15T10:30:00.000Z',
        updatedAt: '2025-01-15T11:00:00.000Z',
      };

      const result = ExportRecordV2Schema.safeParse(validRecord);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe(validRecord.content);
        expect(result.data.createdAt).toBe(validRecord.createdAt);
        expect(result.data.updatedAt).toBe(validRecord.updatedAt);
      }
    });

    it('should reject v2.0 record without updatedAt', () => {
      const invalidRecord = {
        content: 'test content',
        createdAt: '2025-01-15T10:30:00.000Z',
      };

      const result = ExportRecordV2Schema.safeParse(invalidRecord);
      expect(result.success).toBe(false);
    });

    it('should validate v2.0 record with same created and updated times', () => {
      const validRecord = {
        content: 'test content',
        createdAt: '2025-01-15T10:30:00.000Z',
        updatedAt: '2025-01-15T10:30:00.000Z',
      };

      const result = ExportRecordV2Schema.safeParse(validRecord);
      expect(result.success).toBe(true);
    });
  });

  describe('NormalizationRulesSchema', () => {
    it('should validate valid normalization rules', () => {
      const validRules = {
        caseSensitive: false,
        removeAccents: true,
      };

      const result = NormalizationRulesSchema.safeParse(validRules);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.caseSensitive).toBe(false);
        expect(result.data.removeAccents).toBe(true);
      }
    });

    it('should reject normalization rules with missing fields', () => {
      const invalidRules = {
        caseSensitive: false,
      };

      const result = NormalizationRulesSchema.safeParse(invalidRules);
      expect(result.success).toBe(false);
    });

    it('should reject normalization rules with non-boolean values', () => {
      const invalidRules = {
        caseSensitive: 'false',
        removeAccents: 'true',
      };

      const result = NormalizationRulesSchema.safeParse(invalidRules);
      expect(result.success).toBe(false);
    });
  });

  describe('ExportMetadataV2Schema', () => {
    it('should validate valid v2.0 metadata', () => {
      const validMetadata = {
        exportedAt: '2025-01-15T12:00:00.000Z',
        recordCount: 42,
        normalizationRules: {
          caseSensitive: false,
          removeAccents: true,
        },
      };

      const result = ExportMetadataV2Schema.safeParse(validMetadata);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.recordCount).toBe(42);
      }
    });

    it('should validate metadata with zero records', () => {
      const validMetadata = {
        exportedAt: '2025-01-15T12:00:00.000Z',
        recordCount: 0,
        normalizationRules: {
          caseSensitive: false,
          removeAccents: true,
        },
      };

      const result = ExportMetadataV2Schema.safeParse(validMetadata);
      expect(result.success).toBe(true);
    });

    it('should reject metadata with negative record count', () => {
      const invalidMetadata = {
        exportedAt: '2025-01-15T12:00:00.000Z',
        recordCount: -1,
        normalizationRules: {
          caseSensitive: false,
          removeAccents: true,
        },
      };

      const result = ExportMetadataV2Schema.safeParse(invalidMetadata);
      expect(result.success).toBe(false);
    });

    it('should reject metadata with missing normalization rules', () => {
      const invalidMetadata = {
        exportedAt: '2025-01-15T12:00:00.000Z',
        recordCount: 42,
      };

      const result = ExportMetadataV2Schema.safeParse(invalidMetadata);
      expect(result.success).toBe(false);
    });
  });

  describe('ExportFormatV2Schema', () => {
    it('should validate valid v2.0 export format', () => {
      const validExport: ExportFormatV2 = {
        version: '2.0',
        records: [
          {
            content: 'peter ivanov phone 89151234455',
            createdAt: '2025-01-15T10:30:00.000Z',
            updatedAt: '2025-01-15T10:30:00.000Z',
          },
        ],
        metadata: {
          exportedAt: '2025-01-15T12:00:00.000Z',
          recordCount: 1,
          normalizationRules: {
            caseSensitive: false,
            removeAccents: true,
          },
        },
      };

      const result = ExportFormatV2Schema.safeParse(validExport);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe('2.0');
        expect(result.data.records).toHaveLength(1);
      }
    });

    it('should validate v2.0 format with empty records', () => {
      const validExport = {
        version: '2.0',
        records: [],
        metadata: {
          exportedAt: '2025-01-15T12:00:00.000Z',
          recordCount: 0,
          normalizationRules: {
            caseSensitive: false,
            removeAccents: true,
          },
        },
      };

      const result = ExportFormatV2Schema.safeParse(validExport);
      expect(result.success).toBe(true);
    });

    it('should reject v2.0 format without metadata', () => {
      const invalidExport = {
        version: '2.0',
        records: [],
      };

      const result = ExportFormatV2Schema.safeParse(invalidExport);
      expect(result.success).toBe(false);
    });

    it('should reject v2.0 format with wrong version', () => {
      const invalidExport = {
        version: '1.0',
        records: [],
        metadata: {
          exportedAt: '2025-01-15T12:00:00.000Z',
          recordCount: 0,
          normalizationRules: {
            caseSensitive: false,
            removeAccents: true,
          },
        },
      };

      const result = ExportFormatV2Schema.safeParse(invalidExport);
      expect(result.success).toBe(false);
    });
  });

  describe('ExportFormatSchema (Discriminated Union)', () => {
    it('should validate and parse v1.0 format', () => {
      const v1Export = {
        version: '1.0',
        records: [
          {
            content: 'test content',
            createdAt: '2025-01-15T10:30:00.000Z',
          },
        ],
      };

      const result = ExportFormatSchema.safeParse(v1Export);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe('1.0');
        // Type narrowing should work
        if (result.data.version === '1.0') {
          expect(result.data.records[0].createdAt).toBeDefined();
          // updatedAt should not exist in v1.0
          expect('updatedAt' in result.data.records[0]).toBe(false);
        }
      }
    });

    it('should validate and parse v2.0 format', () => {
      const v2Export: ExportFormatV2 = {
        version: '2.0',
        records: [
          {
            content: 'test content',
            createdAt: '2025-01-15T10:30:00.000Z',
            updatedAt: '2025-01-15T11:00:00.000Z',
          },
        ],
        metadata: {
          exportedAt: '2025-01-15T12:00:00.000Z',
          recordCount: 1,
          normalizationRules: {
            caseSensitive: false,
            removeAccents: true,
          },
        },
      };

      const result = ExportFormatSchema.safeParse(v2Export);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe('2.0');
        // Type narrowing should work
        if (result.data.version === '2.0') {
          expect(result.data.metadata).toBeDefined();
          expect(result.data.records[0].updatedAt).toBeDefined();
        }
      }
    });

    it('should reject format with unsupported version', () => {
      const unsupportedExport = {
        version: '3.0',
        records: [],
      };

      const result = ExportFormatSchema.safeParse(unsupportedExport);
      expect(result.success).toBe(false);
    });

    it('should reject format without version field', () => {
      const noVersionExport = {
        records: [],
      };

      const result = ExportFormatSchema.safeParse(noVersionExport);
      expect(result.success).toBe(false);
    });

    it('should handle large dataset validation', () => {
      const largeDataset = {
        version: '2.0',
        records: Array.from({ length: 10000 }, (_, i) => ({
          content: `record number ${i}`,
          createdAt: '2025-01-15T10:30:00.000Z',
          updatedAt: '2025-01-15T10:30:00.000Z',
        })),
        metadata: {
          exportedAt: '2025-01-15T12:00:00.000Z',
          recordCount: 10000,
          normalizationRules: {
            caseSensitive: false,
            removeAccents: true,
          },
        },
      };

      const result = ExportFormatSchema.safeParse(largeDataset);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.records).toHaveLength(10000);
      }
    });
  });

  describe('ImportResultSchema', () => {
    it('should validate valid import result', () => {
      const validResult: ImportResult = {
        imported: 42,
        skipped: 3,
        failed: 1,
        errors: ['Record 45: Invalid timestamp format'],
      };

      const result = ImportResultSchema.safeParse(validResult);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.imported).toBe(42);
        expect(result.data.skipped).toBe(3);
        expect(result.data.failed).toBe(1);
        expect(result.data.errors).toHaveLength(1);
      }
    });

    it('should validate import result with no errors', () => {
      const validResult = {
        imported: 100,
        skipped: 0,
        failed: 0,
        errors: [],
      };

      const result = ImportResultSchema.safeParse(validResult);
      expect(result.success).toBe(true);
    });

    it('should validate import result with all records skipped', () => {
      const validResult = {
        imported: 0,
        skipped: 50,
        failed: 0,
        errors: [],
      };

      const result = ImportResultSchema.safeParse(validResult);
      expect(result.success).toBe(true);
    });

    it('should reject import result with negative values', () => {
      const invalidResult = {
        imported: -1,
        skipped: 0,
        failed: 0,
        errors: [],
      };

      const result = ImportResultSchema.safeParse(invalidResult);
      expect(result.success).toBe(false);
    });

    it('should reject import result with non-integer values', () => {
      const invalidResult = {
        imported: 42.5,
        skipped: 3,
        failed: 1,
        errors: [],
      };

      const result = ImportResultSchema.safeParse(invalidResult);
      expect(result.success).toBe(false);
    });

    it('should reject import result with non-array errors', () => {
      const invalidResult = {
        imported: 42,
        skipped: 3,
        failed: 1,
        errors: 'not an array',
      };

      const result = ImportResultSchema.safeParse(invalidResult);
      expect(result.success).toBe(false);
    });
  });

  describe('Edge Cases and Special Characters', () => {
    it('should validate content with special characters', () => {
      const specialCharsRecord = {
        content:
          'email test@example.com password $ecr3t! url https://example.com',
        createdAt: '2025-01-15T10:30:00.000Z',
      };

      const result = ExportRecordV1Schema.safeParse(specialCharsRecord);
      expect(result.success).toBe(true);
    });

    it('should validate content with unicode characters', () => {
      const unicodeRecord = {
        content: 'имя петр фамилия иванов телефон 📞 89151234455',
        createdAt: '2025-01-15T10:30:00.000Z',
      };

      const result = ExportRecordV1Schema.safeParse(unicodeRecord);
      expect(result.success).toBe(true);
    });

    it('should validate content with newlines and tabs', () => {
      const multilineRecord = {
        content: 'line1\nline2\ttab\tspaced',
        createdAt: '2025-01-15T10:30:00.000Z',
      };

      const result = ExportRecordV1Schema.safeParse(multilineRecord);
      expect(result.success).toBe(true);
    });

    it('should validate timestamps with timezone offsets', () => {
      const timezoneRecord = {
        content: 'test content',
        createdAt: '2025-01-15T10:30:00.000+03:00',
      };

      const result = ExportRecordV1Schema.safeParse(timezoneRecord);
      expect(result.success).toBe(true);
    });

    it('should validate timestamps with millisecond precision', () => {
      const preciseTimestampRecord = {
        content: 'test content',
        createdAt: '2025-01-15T10:30:00.123Z',
        updatedAt: '2025-01-15T10:30:00.456Z',
      };

      const result = ExportRecordV2Schema.safeParse(preciseTimestampRecord);
      expect(result.success).toBe(true);
    });
  });
});
