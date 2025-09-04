import { Result } from '@misc-poc/shared';
import { DomainError } from '@misc-poc/domain';
import {
  ImportValidator,
  ImportValidationResult,
  ImportValidationError,
} from '../import-validator';
import { ExportDTO } from '../../dtos/export-dto';
import { RecordDTO } from '../../dtos/record-dto';

describe('ImportValidator', () => {
  let importValidator: ImportValidator;

  beforeEach(() => {
    importValidator = new ImportValidator();
  });

  describe('validate', () => {
    it('should validate a valid import data structure', async () => {
      // Arrange
      const validExportData: ExportDTO = {
        records: [
          {
            id: 'record_123',
            content: 'test content with tags',
            tagIds: ['test', 'content', 'tags'],
            createdAt: '2023-01-01T00:00:00.000Z',
            updatedAt: '2023-01-01T00:00:00.000Z',
          },
        ],
        format: 'json',
        exportedAt: '2023-01-01T00:00:00.000Z',
        version: '1.0',
        metadata: {
          totalRecords: 1,
          exportSource: 'full-database',
        },
      };

      // Act
      const result = await importValidator.validate(validExportData);

      // Assert
      expect(result.isOk()).toBe(true);
      const validationResult = result.unwrap();
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);
      expect(validationResult.warnings).toHaveLength(0);
      expect(validationResult.recordCount).toBe(1);
      expect(validationResult.version).toBe('1.0');
      expect(validationResult.migrationRequired).toBe(false);
    });

    it('should reject import data with missing required fields', async () => {
      // Arrange
      const invalidData = {
        format: 'json',
        exportedAt: '2023-01-01T00:00:00.000Z',
        // Missing: records, version, metadata
      };

      // Act
      const result = await importValidator.validate(invalidData as any);

      // Assert
      expect(result.isOk()).toBe(true);
      const validationResult = result.unwrap();
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors).toContainEqual(
        expect.objectContaining({
          type: 'MISSING_REQUIRED_FIELD',
          field: 'records',
          message: 'Missing required field: records',
        })
      );
      expect(validationResult.errors).toContainEqual(
        expect.objectContaining({
          type: 'MISSING_REQUIRED_FIELD',
          field: 'version',
          message: 'Missing required field: version',
        })
      );
      expect(validationResult.errors).toContainEqual(
        expect.objectContaining({
          type: 'MISSING_REQUIRED_FIELD',
          field: 'metadata',
          message: 'Missing required field: metadata',
        })
      );
    });

    it('should reject import data with invalid version', async () => {
      // Arrange
      const invalidVersionData: ExportDTO = {
        records: [],
        format: 'json',
        exportedAt: '2023-01-01T00:00:00.000Z',
        version: '2.0', // Unsupported version
        metadata: {
          totalRecords: 0,
          exportSource: 'full-database',
        },
      };

      // Act
      const result = await importValidator.validate(invalidVersionData);

      // Assert
      expect(result.isOk()).toBe(true);
      const validationResult = result.unwrap();
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors).toContainEqual(
        expect.objectContaining({
          type: 'UNSUPPORTED_VERSION',
          field: 'version',
          message: 'Unsupported version: 2.0. Supported versions: 1.0, 0.9',
          severity: 'error',
        })
      );
    });

    it('should require migration for older versions', async () => {
      // Arrange
      const oldVersionData: ExportDTO = {
        records: [],
        format: 'json',
        exportedAt: '2023-01-01T00:00:00.000Z',
        version: '0.9', // Older version
        metadata: {
          totalRecords: 0,
          exportSource: 'full-database',
        },
      };

      // Act
      const result = await importValidator.validate(oldVersionData);

      // Assert
      expect(result.isOk()).toBe(true);
      const validationResult = result.unwrap();
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.migrationRequired).toBe(true);
      expect(validationResult.warnings).toContainEqual(
        expect.objectContaining({
          type: 'MIGRATION_REQUIRED',
          field: 'version',
          message: 'Migration required from version 0.9 to 1.0',
          severity: 'warning',
        })
      );
    });

    it('should validate record format within import data', async () => {
      // Arrange
      const invalidRecordData: ExportDTO = {
        records: [
          {
            // Missing required fields: id, content, tagIds, createdAt, updatedAt
            content: 'incomplete record',
          } as any,
          {
            id: 'record_456',
            content: '',
            tagIds: ['tag1'],
            createdAt: 'invalid-date',
            updatedAt: '2023-01-01T00:00:00.000Z',
          },
        ],
        format: 'json',
        exportedAt: '2023-01-01T00:00:00.000Z',
        version: '1.0',
        metadata: {
          totalRecords: 2,
          exportSource: 'full-database',
        },
      };

      // Act
      const result = await importValidator.validate(invalidRecordData);

      // Assert
      expect(result.isOk()).toBe(true);
      const validationResult = result.unwrap();
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors).toContainEqual(
        expect.objectContaining({
          type: 'INVALID_RECORD_FORMAT',
          field: 'records[0].id',
          message: 'Record missing required field: id',
          recordIndex: 0,
        })
      );
      expect(validationResult.errors).toContainEqual(
        expect.objectContaining({
          type: 'INVALID_RECORD_CONTENT',
          field: 'records[1].content',
          message: 'Record content cannot be empty',
          recordIndex: 1,
        })
      );
      expect(validationResult.errors).toContainEqual(
        expect.objectContaining({
          type: 'INVALID_DATE_FORMAT',
          field: 'records[1].createdAt',
          message: 'Invalid date format: invalid-date',
          recordIndex: 1,
        })
      );
    });

    it('should validate record content and tag format', async () => {
      // Arrange
      const invalidContentData: ExportDTO = {
        records: [
          {
            id: 'record_789',
            content: 'a'.repeat(10001), // Content too long
            tagIds: ['valid-tag'],
            createdAt: '2023-01-01T00:00:00.000Z',
            updatedAt: '2023-01-01T00:00:00.000Z',
          },
          {
            id: 'record_abc',
            content: 'valid content',
            tagIds: ['', 'tag-with-forbidden{characters}', 'a'.repeat(101)], // Invalid tags
            createdAt: '2023-01-01T00:00:00.000Z',
            updatedAt: '2023-01-01T00:00:00.000Z',
          },
        ],
        format: 'json',
        exportedAt: '2023-01-01T00:00:00.000Z',
        version: '1.0',
        metadata: {
          totalRecords: 2,
          exportSource: 'full-database',
        },
      };

      // Act
      const result = await importValidator.validate(invalidContentData);

      // Assert
      expect(result.isOk()).toBe(true);
      const validationResult = result.unwrap();
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors).toContainEqual(
        expect.objectContaining({
          type: 'INVALID_RECORD_CONTENT',
          field: 'records[0].content',
          message: 'Record content exceeds maximum length of 10000 characters',
          recordIndex: 0,
        })
      );
      expect(validationResult.errors).toContainEqual(
        expect.objectContaining({
          type: 'INVALID_TAG_FORMAT',
          field: 'records[1].tagIds[0]',
          message: 'Tag cannot be empty',
          recordIndex: 1,
          tagIndex: 0,
        })
      );
      expect(validationResult.errors).toContainEqual(
        expect.objectContaining({
          type: 'INVALID_TAG_FORMAT',
          field: 'records[1].tagIds[1]',
          message: 'Tag contains forbidden characters: {',
          recordIndex: 1,
          tagIndex: 1,
        })
      );
      expect(validationResult.errors).toContainEqual(
        expect.objectContaining({
          type: 'INVALID_TAG_FORMAT',
          field: 'records[1].tagIds[2]',
          message: 'Tag exceeds maximum length of 100 characters',
          recordIndex: 1,
          tagIndex: 2,
        })
      );
    });

    it('should validate metadata consistency', async () => {
      // Arrange
      const inconsistentMetadata: ExportDTO = {
        records: [
          {
            id: 'record_1',
            content: 'test content',
            tagIds: ['test'],
            createdAt: '2023-01-01T00:00:00.000Z',
            updatedAt: '2023-01-01T00:00:00.000Z',
          },
          {
            id: 'record_2',
            content: 'another record',
            tagIds: ['another'],
            createdAt: '2023-01-01T00:00:00.000Z',
            updatedAt: '2023-01-01T00:00:00.000Z',
          },
        ],
        format: 'json',
        exportedAt: '2023-01-01T00:00:00.000Z',
        version: '1.0',
        metadata: {
          totalRecords: 5, // Incorrect count
          exportSource: 'full-database',
        },
      };

      // Act
      const result = await importValidator.validate(inconsistentMetadata);

      // Assert
      expect(result.isOk()).toBe(true);
      const validationResult = result.unwrap();
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors).toContainEqual(
        expect.objectContaining({
          type: 'METADATA_INCONSISTENCY',
          field: 'metadata.totalRecords',
          message:
            'Metadata totalRecords (5) does not match actual record count (2)',
        })
      );
    });

    it('should detect duplicate record IDs', async () => {
      // Arrange
      const duplicateIdData: ExportDTO = {
        records: [
          {
            id: 'record_duplicate',
            content: 'first record',
            tagIds: ['first'],
            createdAt: '2023-01-01T00:00:00.000Z',
            updatedAt: '2023-01-01T00:00:00.000Z',
          },
          {
            id: 'record_duplicate', // Duplicate ID
            content: 'second record',
            tagIds: ['second'],
            createdAt: '2023-01-01T00:00:00.000Z',
            updatedAt: '2023-01-01T00:00:00.000Z',
          },
        ],
        format: 'json',
        exportedAt: '2023-01-01T00:00:00.000Z',
        version: '1.0',
        metadata: {
          totalRecords: 2,
          exportSource: 'full-database',
        },
      };

      // Act
      const result = await importValidator.validate(duplicateIdData);

      // Assert
      expect(result.isOk()).toBe(true);
      const validationResult = result.unwrap();
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors).toContainEqual(
        expect.objectContaining({
          type: 'DUPLICATE_RECORD_ID',
          field: 'records[1].id',
          message: 'Duplicate record ID: record_duplicate',
          recordIndex: 1,
        })
      );
    });

    it('should validate date formats and chronological order', async () => {
      // Arrange
      const invalidDatesData: ExportDTO = {
        records: [
          {
            id: 'record_time',
            content: 'time test',
            tagIds: ['time'],
            createdAt: '2023-01-02T00:00:00.000Z',
            updatedAt: '2023-01-01T00:00:00.000Z', // Updated before created
          },
        ],
        format: 'json',
        exportedAt: '2023-01-01T00:00:00.000Z',
        version: '1.0',
        metadata: {
          totalRecords: 1,
          exportSource: 'full-database',
        },
      };

      // Act
      const result = await importValidator.validate(invalidDatesData);

      // Assert
      expect(result.isOk()).toBe(true);
      const validationResult = result.unwrap();
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors).toContainEqual(
        expect.objectContaining({
          type: 'INVALID_DATE_ORDER',
          field: 'records[0].updatedAt',
          message: 'Record updatedAt cannot be before createdAt',
          recordIndex: 0,
        })
      );
    });

    it('should provide detailed error reporting with recovery suggestions', async () => {
      // Arrange
      const problematicData: ExportDTO = {
        records: [
          {
            id: '',
            content: 'content without id',
            tagIds: ['tag1'],
            createdAt: '2023-01-01T00:00:00.000Z',
            updatedAt: '2023-01-01T00:00:00.000Z',
          },
        ],
        format: 'json',
        exportedAt: '2023-01-01T00:00:00.000Z',
        version: '1.0',
        metadata: {
          totalRecords: 1,
          exportSource: 'full-database',
        },
      };

      // Act
      const result = await importValidator.validate(problematicData);

      // Assert
      expect(result.isOk()).toBe(true);
      const validationResult = result.unwrap();
      expect(validationResult.isValid).toBe(false);
      const idError = validationResult.errors.find(
        (error) => error.type === 'INVALID_RECORD_FORMAT'
      );
      expect(idError).toBeDefined();
      expect(idError?.recoverySuggestion).toBe(
        'Generate a unique ID for this record or use content-based hashing'
      );
    });

    it('should handle empty import data gracefully', async () => {
      // Arrange
      const emptyData: ExportDTO = {
        records: [],
        format: 'json',
        exportedAt: '2023-01-01T00:00:00.000Z',
        version: '1.0',
        metadata: {
          totalRecords: 0,
          exportSource: 'empty-export',
        },
      };

      // Act
      const result = await importValidator.validate(emptyData);

      // Assert
      expect(result.isOk()).toBe(true);
      const validationResult = result.unwrap();
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.recordCount).toBe(0);
      expect(validationResult.warnings).toContainEqual(
        expect.objectContaining({
          type: 'EMPTY_IMPORT',
          message: 'Import data contains no records',
          severity: 'warning',
        })
      );
    });

    it('should handle malformed JSON gracefully', async () => {
      // Arrange
      const malformedData = 'invalid json string';

      // Act
      const result = await importValidator.validate(malformedData as any);

      // Assert
      expect(result.isErr()).toBe(true);
      const error = result.unwrapErr();
      expect(error).toBeInstanceOf(DomainError);
      expect(error.code).toBe('IMPORT_VALIDATION_FAILED');
      expect(error.message).toContain('Invalid import data structure');
    });

    it('should validate large import datasets efficiently', async () => {
      // Arrange
      const largeDataset: ExportDTO = {
        records: Array.from({ length: 10000 }, (_, index) => ({
          id: `record_${index}`,
          content: `content for record ${index}`,
          tagIds: [`tag${index}`, `category${index % 10}`],
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
        })),
        format: 'json',
        exportedAt: '2023-01-01T00:00:00.000Z',
        version: '1.0',
        metadata: {
          totalRecords: 10000,
          exportSource: 'full-database',
        },
      };

      const startTime = Date.now();

      // Act
      const result = await importValidator.validate(largeDataset);

      // Assert
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(result.isOk()).toBe(true);
      const validationResult = result.unwrap();
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.recordCount).toBe(10000);
      expect(executionTime).toBeLessThan(5000); // Should validate 10k records in under 5 seconds
    });

    it('should prepare schema migration information', async () => {
      // Arrange
      const oldFormatData = {
        data: [
          // Old format using 'data' instead of 'records'
          {
            id: 'record_1',
            text: 'old format content', // Old format using 'text' instead of 'content'
            tags: ['tag1', 'tag2'], // Old format using 'tags' instead of 'tagIds'
            created: '2023-01-01T00:00:00.000Z', // Old format using 'created' instead of 'createdAt'
            updated: '2023-01-01T00:00:00.000Z', // Old format using 'updated' instead of 'updatedAt'
          },
        ],
        format: 'json',
        exportedAt: '2023-01-01T00:00:00.000Z',
        version: '0.9',
        metadata: {
          totalRecords: 1,
          exportSource: 'full-database',
        },
      };

      // Act
      const result = await importValidator.validate(oldFormatData as any);

      // Assert
      expect(result.isOk()).toBe(true);
      const validationResult = result.unwrap();
      expect(validationResult.migrationRequired).toBe(true);
      expect(validationResult.migrationPlan).toBeDefined();
      expect(validationResult.migrationPlan?.fromVersion).toBe('0.9');
      expect(validationResult.migrationPlan?.toVersion).toBe('1.0');
      expect(validationResult.migrationPlan?.steps).toContainEqual(
        'Rename field "data" to "records"'
      );
      expect(validationResult.migrationPlan?.steps).toContainEqual(
        'Rename field "text" to "content"'
      );
      expect(validationResult.migrationPlan?.steps).toContainEqual(
        'Rename field "tags" to "tagIds"'
      );
    });
  });

  describe('validateRecord', () => {
    it('should validate individual record format', async () => {
      // Arrange
      const validRecord: RecordDTO = {
        id: 'record_123',
        content: 'valid record content',
        tagIds: ['tag1', 'tag2'],
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      };

      // Act
      const result = await importValidator.validateRecord(validRecord, 0);

      // Assert
      expect(result).toEqual([]);
    });

    it('should return validation errors for invalid record', async () => {
      // Arrange
      const invalidRecord = {
        id: '',
        content: '',
        tagIds: [],
        createdAt: 'invalid-date',
        updatedAt: '2023-01-01T00:00:00.000Z',
      };

      // Act
      const result = await importValidator.validateRecord(
        invalidRecord as any,
        0
      );

      // Assert
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContainEqual(
        expect.objectContaining({
          type: 'INVALID_RECORD_FORMAT',
          recordIndex: 0,
        })
      );
    });
  });

  describe('getSupportedVersions', () => {
    it('should return list of supported versions', () => {
      // Act
      const versions = importValidator.getSupportedVersions();

      // Assert
      expect(versions).toContainEqual('1.0');
      expect(versions).toContainEqual('0.9');
      expect(Array.isArray(versions)).toBe(true);
    });
  });

  describe('getVersionCompatibility', () => {
    it('should return compatibility information for versions', () => {
      // Act
      const compatibility = importValidator.getVersionCompatibility('0.9');

      // Assert
      expect(compatibility).toBeDefined();
      expect(compatibility.isSupported).toBe(true);
      expect(compatibility.migrationRequired).toBe(true);
      expect(compatibility.targetVersion).toBe('1.0');
    });

    it('should return unsupported for unknown versions', () => {
      // Act
      const compatibility = importValidator.getVersionCompatibility('999.0');

      // Assert
      expect(compatibility.isSupported).toBe(false);
      expect(compatibility.migrationRequired).toBe(false);
    });
  });
});
