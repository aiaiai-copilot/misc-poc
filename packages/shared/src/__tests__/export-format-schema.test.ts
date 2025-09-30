/**
 * Tests for Export/Import format validation schemas
 *
 * These tests verify the Zod schemas correctly validate import/export data
 * according to PRD specifications (section 4.2.3).
 */

import {
  ExportFormatSchema,
  ExportFormatV1Schema,
  ExportFormatV2Schema,
  ExportRecordV1Schema,
  ExportRecordV2Schema,
  NormalizationRulesSchema,
  ExportMetadataV2Schema,
  ImportResultSchema,
} from '../export-format-schema';

describe('Export Format Schema Validation', () => {
  describe('ExportRecordV1Schema', () => {
    it('should validate valid v1.0 record', () => {
      const validRecord = {
        content: 'meeting project alpha 15:00',
        createdAt: '2024-01-15T10:30:00.000Z',
      };

      const result = ExportRecordV1Schema.safeParse(validRecord);
      expect(result.success).toBe(true);
    });

    it('should reject record with empty content', () => {
      const invalidRecord = {
        content: '',
        createdAt: '2024-01-15T10:30:00.000Z',
      };

      const result = ExportRecordV1Schema.safeParse(invalidRecord);
      expect(result.success).toBe(false);
    });

    it('should reject record with invalid timestamp', () => {
      const invalidRecord = {
        content: 'valid content',
        createdAt: 'not-a-date',
      };

      const result = ExportRecordV1Schema.safeParse(invalidRecord);
      expect(result.success).toBe(false);
    });

    it('should reject record with missing fields', () => {
      const invalidRecord = {
        content: 'valid content',
      };

      const result = ExportRecordV1Schema.safeParse(invalidRecord);
      expect(result.success).toBe(false);
    });

    it('should accept record with content up to max length', () => {
      const validRecord = {
        content: 'a'.repeat(5000),
        createdAt: '2024-01-15T10:30:00.000Z',
      };

      const result = ExportRecordV1Schema.safeParse(validRecord);
      expect(result.success).toBe(true);
    });

    it('should reject record with content exceeding max length', () => {
      const invalidRecord = {
        content: 'a'.repeat(5001),
        createdAt: '2024-01-15T10:30:00.000Z',
      };

      const result = ExportRecordV1Schema.safeParse(invalidRecord);
      expect(result.success).toBe(false);
    });
  });

  describe('ExportFormatV1Schema', () => {
    it('should validate valid v1.0 export format', () => {
      const validExport = {
        version: '1.0' as const,
        records: [
          {
            content: 'meeting today 15:00',
            createdAt: '2024-01-15T10:30:00.000Z',
          },
          {
            content: 'password github qwerty123',
            createdAt: '2024-01-15T11:00:00.000Z',
          },
        ],
        metadata: {
          exportedAt: '2024-01-15T12:00:00.000Z',
          recordCount: 2,
        },
      };

      const result = ExportFormatV1Schema.safeParse(validExport);
      expect(result.success).toBe(true);
    });

    it('should validate v1.0 format without optional metadata', () => {
      const validExport = {
        version: '1.0' as const,
        records: [
          {
            content: 'meeting today 15:00',
            createdAt: '2024-01-15T10:30:00.000Z',
          },
        ],
      };

      const result = ExportFormatV1Schema.safeParse(validExport);
      expect(result.success).toBe(true);
    });

    it('should validate v1.0 format with partial metadata', () => {
      const validExport = {
        version: '1.0' as const,
        records: [
          {
            content: 'test record',
            createdAt: '2024-01-15T10:30:00.000Z',
          },
        ],
        metadata: {
          exportedAt: '2024-01-15T12:00:00.000Z',
        },
      };

      const result = ExportFormatV1Schema.safeParse(validExport);
      expect(result.success).toBe(true);
    });

    it('should validate v1.0 format with empty records array', () => {
      const validExport = {
        version: '1.0' as const,
        records: [],
      };

      const result = ExportFormatV1Schema.safeParse(validExport);
      expect(result.success).toBe(true);
    });

    it('should reject v1.0 format with wrong version', () => {
      const invalidExport = {
        version: '2.0',
        records: [
          {
            content: 'test',
            createdAt: '2024-01-15T10:30:00.000Z',
          },
        ],
      };

      const result = ExportFormatV1Schema.safeParse(invalidExport);
      expect(result.success).toBe(false);
    });

    it('should reject v1.0 format with invalid record', () => {
      const invalidExport = {
        version: '1.0' as const,
        records: [
          {
            content: '',
            createdAt: '2024-01-15T10:30:00.000Z',
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
        content: 'meeting project alpha 15:00',
        createdAt: '2024-01-15T10:30:00.000Z',
        updatedAt: '2024-01-15T11:00:00.000Z',
      };

      const result = ExportRecordV2Schema.safeParse(validRecord);
      expect(result.success).toBe(true);
    });

    it('should reject v2.0 record without updatedAt', () => {
      const invalidRecord = {
        content: 'valid content',
        createdAt: '2024-01-15T10:30:00.000Z',
      };

      const result = ExportRecordV2Schema.safeParse(invalidRecord);
      expect(result.success).toBe(false);
    });

    it('should validate v2.0 record with same created and updated times', () => {
      const validRecord = {
        content: 'new record',
        createdAt: '2024-01-15T10:30:00.000Z',
        updatedAt: '2024-01-15T10:30:00.000Z',
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
        exportedAt: '2024-01-15T12:00:00.000Z',
        recordCount: 42,
        normalizationRules: {
          caseSensitive: false,
          removeAccents: true,
        },
      };

      const result = ExportMetadataV2Schema.safeParse(validMetadata);
      expect(result.success).toBe(true);
    });

    it('should validate metadata with zero records', () => {
      const validMetadata = {
        exportedAt: '2024-01-15T12:00:00.000Z',
        recordCount: 0,
        normalizationRules: {
          caseSensitive: true,
          removeAccents: false,
        },
      };

      const result = ExportMetadataV2Schema.safeParse(validMetadata);
      expect(result.success).toBe(true);
    });

    it('should reject metadata with negative record count', () => {
      const invalidMetadata = {
        exportedAt: '2024-01-15T12:00:00.000Z',
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
        exportedAt: '2024-01-15T12:00:00.000Z',
        recordCount: 10,
      };

      const result = ExportMetadataV2Schema.safeParse(invalidMetadata);
      expect(result.success).toBe(false);
    });
  });

  describe('ExportFormatV2Schema', () => {
    it('should validate valid v2.0 export format', () => {
      const validExport = {
        version: '2.0' as const,
        records: [
          {
            content: 'meeting today 15:00',
            createdAt: '2024-01-15T10:30:00.000Z',
            updatedAt: '2024-01-15T10:30:00.000Z',
          },
          {
            content: 'password github qwerty123',
            createdAt: '2024-01-15T11:00:00.000Z',
            updatedAt: '2024-01-15T11:15:00.000Z',
          },
        ],
        metadata: {
          exportedAt: '2024-01-15T12:00:00.000Z',
          recordCount: 2,
          normalizationRules: {
            caseSensitive: false,
            removeAccents: true,
          },
        },
      };

      const result = ExportFormatV2Schema.safeParse(validExport);
      expect(result.success).toBe(true);
    });

    it('should validate v2.0 format with empty records', () => {
      const validExport = {
        version: '2.0' as const,
        records: [],
        metadata: {
          exportedAt: '2024-01-15T12:00:00.000Z',
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
        version: '2.0' as const,
        records: [
          {
            content: 'test',
            createdAt: '2024-01-15T10:30:00.000Z',
            updatedAt: '2024-01-15T10:30:00.000Z',
          },
        ],
      };

      const result = ExportFormatV2Schema.safeParse(invalidExport);
      expect(result.success).toBe(false);
    });

    it('should reject v2.0 format with wrong version', () => {
      const invalidExport = {
        version: '1.0',
        records: [
          {
            content: 'test',
            createdAt: '2024-01-15T10:30:00.000Z',
            updatedAt: '2024-01-15T10:30:00.000Z',
          },
        ],
        metadata: {
          exportedAt: '2024-01-15T12:00:00.000Z',
          recordCount: 1,
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
        version: '1.0' as const,
        records: [
          {
            content: 'test record',
            createdAt: '2024-01-15T10:30:00.000Z',
          },
        ],
      };

      const result = ExportFormatSchema.safeParse(v1Export);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe('1.0');
      }
    });

    it('should validate and parse v2.0 format', () => {
      const v2Export = {
        version: '2.0' as const,
        records: [
          {
            content: 'test record',
            createdAt: '2024-01-15T10:30:00.000Z',
            updatedAt: '2024-01-15T10:30:00.000Z',
          },
        ],
        metadata: {
          exportedAt: '2024-01-15T12:00:00.000Z',
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
      }
    });

    it('should reject format with unsupported version', () => {
      const invalidExport = {
        version: '3.0',
        records: [],
      };

      const result = ExportFormatSchema.safeParse(invalidExport);
      expect(result.success).toBe(false);
    });

    it('should reject format without version field', () => {
      const invalidExport = {
        records: [],
      };

      const result = ExportFormatSchema.safeParse(invalidExport);
      expect(result.success).toBe(false);
    });

    it('should handle large dataset validation', () => {
      const largeExport = {
        version: '2.0' as const,
        records: Array.from({ length: 1000 }, (_, i) => ({
          content: `record ${i} with content`,
          createdAt: '2024-01-15T10:30:00.000Z',
          updatedAt: '2024-01-15T10:30:00.000Z',
        })),
        metadata: {
          exportedAt: '2024-01-15T12:00:00.000Z',
          recordCount: 1000,
          normalizationRules: {
            caseSensitive: false,
            removeAccents: true,
          },
        },
      };

      const result = ExportFormatSchema.safeParse(largeExport);
      expect(result.success).toBe(true);
    });
  });

  describe('ImportResultSchema', () => {
    it('should validate valid import result', () => {
      const validResult = {
        imported: 100,
        skipped: 5,
        errors: ['Error on line 10: Invalid format'],
      };

      const result = ImportResultSchema.safeParse(validResult);
      expect(result.success).toBe(true);
    });

    it('should validate import result with no errors', () => {
      const validResult = {
        imported: 100,
        skipped: 0,
        errors: [],
      };

      const result = ImportResultSchema.safeParse(validResult);
      expect(result.success).toBe(true);
    });

    it('should validate import result with all records skipped', () => {
      const validResult = {
        imported: 0,
        skipped: 50,
        errors: [],
      };

      const result = ImportResultSchema.safeParse(validResult);
      expect(result.success).toBe(true);
    });

    it('should reject import result with negative values', () => {
      const invalidResult = {
        imported: -1,
        skipped: 0,
        errors: [],
      };

      const result = ImportResultSchema.safeParse(invalidResult);
      expect(result.success).toBe(false);
    });

    it('should reject import result with non-integer values', () => {
      const invalidResult = {
        imported: 10.5,
        skipped: 2.3,
        errors: [],
      };

      const result = ImportResultSchema.safeParse(invalidResult);
      expect(result.success).toBe(false);
    });

    it('should reject import result with non-array errors', () => {
      const invalidResult = {
        imported: 10,
        skipped: 2,
        errors: 'some error',
      };

      const result = ImportResultSchema.safeParse(invalidResult);
      expect(result.success).toBe(false);
    });
  });

  describe('Edge Cases and Special Characters', () => {
    it('should validate content with special characters', () => {
      const record = {
        content: 'password $ecure!@#$%^&*() email user@example.com',
        createdAt: '2024-01-15T10:30:00.000Z',
      };

      const result = ExportRecordV1Schema.safeParse(record);
      expect(result.success).toBe(true);
    });

    it('should validate content with unicode characters', () => {
      const record = {
        content: 'café résumé 日本語 中文 Привет',
        createdAt: '2024-01-15T10:30:00.000Z',
      };

      const result = ExportRecordV1Schema.safeParse(record);
      expect(result.success).toBe(true);
    });

    it('should validate content with newlines and tabs', () => {
      const record = {
        content: 'line1\nline2\ttabbed',
        createdAt: '2024-01-15T10:30:00.000Z',
      };

      const result = ExportRecordV1Schema.safeParse(record);
      expect(result.success).toBe(true);
    });

    it('should validate timestamps with timezone offsets', () => {
      const record = {
        content: 'test content',
        createdAt: '2024-01-15T10:30:00+03:00',
      };

      const result = ExportRecordV1Schema.safeParse(record);
      expect(result.success).toBe(true);
    });

    it('should validate timestamps with millisecond precision', () => {
      const record = {
        content: 'test content',
        createdAt: '2024-01-15T10:30:00.123Z',
      };

      const result = ExportRecordV1Schema.safeParse(record);
      expect(result.success).toBe(true);
    });
  });
});
