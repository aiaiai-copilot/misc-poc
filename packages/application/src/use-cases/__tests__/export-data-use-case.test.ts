import { Result, Ok, Err } from '@misc-poc/shared';
import { DomainError, Record, Tag } from '@misc-poc/domain';
import { RecordRepository } from '../../ports/record-repository';
import { TagRepository } from '../../ports/tag-repository';
import { RecordDTO, RecordDTOMapper } from '../../dtos/record-dto';
import { ExportDTO } from '../../dtos/export-dto';
import {
  ExportDataUseCase,
  ExportDataRequest,
  ExportDataResponse,
} from '../export-data-use-case';

// Mock implementations
class MockRecordRepository implements RecordRepository {
  private records: Record[] = [];
  private shouldReturnError: boolean = false;
  private errorToReturn: DomainError | null = null;

  setRecords(records: Record[]): void {
    this.records = records;
  }

  setError(error: DomainError): void {
    this.shouldReturnError = true;
    this.errorToReturn = error;
  }

  clearError(): void {
    this.shouldReturnError = false;
    this.errorToReturn = null;
  }

  async findAll(): Promise<
    Result<{ records: Record[]; total: number; hasMore: boolean }, DomainError>
  > {
    if (this.shouldReturnError && this.errorToReturn) {
      return Err(this.errorToReturn);
    }

    return Ok({
      records: this.records,
      total: this.records.length,
      hasMore: false,
    });
  }

  // Other required methods (minimal implementation for testing)
  async findById(): Promise<Result<Record | null, DomainError>> {
    return Ok(null);
  }
  async search(): Promise<
    Result<{ records: Record[]; total: number; hasMore: boolean }, DomainError>
  > {
    return Ok({ records: [], total: 0, hasMore: false });
  }
  async findByTagIds(): Promise<Result<Record[], DomainError>> {
    return Ok([]);
  }
  async findByTagSet(): Promise<Result<Record[], DomainError>> {
    return Ok([]);
  }
  async save(): Promise<Result<Record, DomainError>> {
    return Ok(this.records[0]);
  }
  async update(): Promise<Result<Record, DomainError>> {
    return Ok(this.records[0]);
  }
  async delete(): Promise<Result<void, DomainError>> {
    return Ok(undefined);
  }
  async saveBatch(): Promise<Result<Record[], DomainError>> {
    return Ok([]);
  }
  async deleteAll(): Promise<Result<void, DomainError>> {
    return Ok(undefined);
  }
  async count(): Promise<Result<number, DomainError>> {
    return Ok(0);
  }
  async exists(): Promise<Result<boolean, DomainError>> {
    return Ok(false);
  }
}

class MockTagRepository implements TagRepository {
  private tags: Map<string, Tag> = new Map();
  private shouldReturnError: boolean = false;
  private errorToReturn: DomainError | null = null;

  setTags(tags: Tag[]): void {
    this.tags.clear();
    tags.forEach((tag) => {
      this.tags.set(tag.id.toString(), tag);
    });
  }

  setError(error: DomainError): void {
    this.shouldReturnError = true;
    this.errorToReturn = error;
  }

  clearError(): void {
    this.shouldReturnError = false;
    this.errorToReturn = null;
  }

  async findAll(): Promise<Result<Tag[], DomainError>> {
    if (this.shouldReturnError && this.errorToReturn) {
      return Err(this.errorToReturn);
    }

    return Ok(Array.from(this.tags.values()));
  }

  // Other required methods (minimal implementation for testing)
  async findById(): Promise<Result<Tag | null, DomainError>> {
    return Ok(null);
  }
  async findByNormalizedValue(): Promise<Result<Tag | null, DomainError>> {
    return Ok(null);
  }
  async findByNormalizedValues(): Promise<Result<Tag[], DomainError>> {
    return Ok([]);
  }
  async findByPrefix(): Promise<Result<any[], DomainError>> {
    return Ok([]);
  }
  async getUsageInfo(): Promise<Result<any[], DomainError>> {
    return Ok([]);
  }
  async findOrphaned(): Promise<Result<Tag[], DomainError>> {
    return Ok([]);
  }
  async save(): Promise<Result<Tag, DomainError>> {
    return Ok(Array.from(this.tags.values())[0]);
  }
  async update(): Promise<Result<Tag, DomainError>> {
    return Ok(Array.from(this.tags.values())[0]);
  }
  async delete(): Promise<Result<void, DomainError>> {
    return Ok(undefined);
  }
  async saveBatch(): Promise<Result<Tag[], DomainError>> {
    return Ok([]);
  }
  async deleteOrphaned(): Promise<Result<void, DomainError>> {
    return Ok(undefined);
  }
}

describe('ExportDataUseCase', () => {
  let useCase: ExportDataUseCase;
  let mockRecordRepository: MockRecordRepository;
  let mockTagRepository: MockTagRepository;

  // Test data fixtures
  let testRecords: Record[];
  let testTags: Tag[];

  beforeEach(() => {
    mockRecordRepository = new MockRecordRepository();
    mockTagRepository = new MockTagRepository();
    useCase = new ExportDataUseCase(mockRecordRepository, mockTagRepository);

    // Create test fixtures
    testTags = [
      Tag.create('javascript', 'javascript'),
      Tag.create('typescript', 'typescript'),
      Tag.create('testing', 'testing'),
    ];

    testRecords = [
      Record.create(
        'javascript testing framework',
        new Set([testTags[0].id, testTags[2].id])
      ),
      Record.create(
        'typescript configuration guide',
        new Set([testTags[1].id])
      ),
      Record.create(
        'testing best practices with javascript',
        new Set([testTags[0].id, testTags[2].id])
      ),
    ];

    mockTagRepository.setTags(testTags);
    mockRecordRepository.setRecords(testRecords);
  });

  describe('successful export scenarios', () => {
    it('should export all records without internal UUIDs', async () => {
      const request: ExportDataRequest = {
        format: 'json',
        includeMetadata: true,
      };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const response = result.value;
        const exportData = response.exportData;

        // Verify no UUIDs in the exported data
        const serialized = JSON.stringify(exportData);
        const uuidRegex =
          /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
        expect(serialized).not.toMatch(uuidRegex);

        // Verify records are exported properly
        expect(exportData.records).toHaveLength(3);
        exportData.records.forEach((record) => {
          expect(record.id).toBeDefined();
          expect(record.content).toBeDefined();
          expect(record.tagIds).toBeDefined();
          expect(record.createdAt).toBeDefined();
          expect(record.updatedAt).toBeDefined();

          // Ensure no UUID format in record data
          expect(record.id).not.toMatch(uuidRegex);
          record.tagIds.forEach((tagId) => {
            expect(tagId).not.toMatch(uuidRegex);
          });
        });
      }
    });

    it('should include version metadata in export', async () => {
      const request: ExportDataRequest = {
        format: 'json',
        includeMetadata: true,
      };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const response = result.value;
        const exportData = response.exportData;

        expect(exportData.version).toBeDefined();
        expect(exportData.version).toMatch(/^\d+\.\d+$/); // Format like "1.0", "2.1", etc.
        expect(exportData.metadata.totalRecords).toBe(3);
        expect(exportData.metadata.exportSource).toBe('full-database');
      }
    });

    it('should include export timestamp', async () => {
      const beforeExport = new Date();

      const request: ExportDataRequest = {
        format: 'json',
        includeMetadata: true,
      };

      const result = await useCase.execute(request);
      const afterExport = new Date();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const response = result.value;
        const exportData = response.exportData;

        expect(exportData.exportedAt).toBeDefined();
        const exportedAt = new Date(exportData.exportedAt);
        expect(exportedAt.getTime()).toBeGreaterThanOrEqual(
          beforeExport.getTime()
        );
        expect(exportedAt.getTime()).toBeLessThanOrEqual(afterExport.getTime());
      }
    });

    it('should include normalization settings in metadata', async () => {
      const request: ExportDataRequest = {
        format: 'json',
        includeMetadata: true,
        normalizationSettings: {
          caseSensitive: false,
          removeDiacritics: true,
          normalizeUnicode: true,
        },
      };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const response = result.value;
        const exportData = response.exportData;

        expect(exportData.metadata.normalizationSettings).toEqual({
          caseSensitive: false,
          removeDiacritics: true,
          normalizeUnicode: true,
        });
      }
    });

    it('should export with portable record count in metadata', async () => {
      const request: ExportDataRequest = {
        format: 'json',
        includeMetadata: true,
      };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const response = result.value;
        const exportData = response.exportData;

        expect(exportData.metadata.totalRecords).toBe(testRecords.length);
        expect(exportData.records.length).toBe(
          exportData.metadata.totalRecords
        );
      }
    });

    it('should handle empty database export', async () => {
      mockRecordRepository.setRecords([]);
      mockTagRepository.setTags([]);

      const request: ExportDataRequest = {
        format: 'json',
        includeMetadata: true,
      };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const response = result.value;
        const exportData = response.exportData;

        expect(exportData.records).toEqual([]);
        expect(exportData.metadata.totalRecords).toBe(0);
        expect(exportData.metadata.exportSource).toBe('empty-export');
      }
    });

    it('should export data with clean structure for portability', async () => {
      const request: ExportDataRequest = {
        format: 'json',
        includeMetadata: true,
      };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const response = result.value;
        const exportData = response.exportData;

        // Verify clean structure
        expect(exportData).toHaveProperty('records');
        expect(exportData).toHaveProperty('format');
        expect(exportData).toHaveProperty('exportedAt');
        expect(exportData).toHaveProperty('version');
        expect(exportData).toHaveProperty('metadata');

        // Verify records have clean structure
        exportData.records.forEach((record) => {
          expect(record).toHaveProperty('id');
          expect(record).toHaveProperty('content');
          expect(record).toHaveProperty('tagIds');
          expect(record).toHaveProperty('createdAt');
          expect(record).toHaveProperty('updatedAt');

          // Ensure data types are correct for portability
          expect(typeof record.id).toBe('string');
          expect(typeof record.content).toBe('string');
          expect(Array.isArray(record.tagIds)).toBe(true);
          expect(typeof record.createdAt).toBe('string');
          expect(typeof record.updatedAt).toBe('string');
        });
      }
    });

    it('should support different export formats', async () => {
      const formats: Array<'json' | 'csv' | 'xml' | 'yaml'> = [
        'json',
        'csv',
        'xml',
        'yaml',
      ];

      for (const format of formats) {
        const request: ExportDataRequest = {
          format,
          includeMetadata: true,
        };

        const result = await useCase.execute(request);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          const response = result.value;
          expect(response.exportData.format).toBe(format);
        }
      }
    });
  });

  describe('export options and configuration', () => {
    it('should export without metadata when requested', async () => {
      const request: ExportDataRequest = {
        format: 'json',
        includeMetadata: false,
      };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const response = result.value;
        const exportData = response.exportData;

        // Should still have basic metadata for version tracking
        expect(exportData.version).toBeDefined();
        expect(exportData.exportedAt).toBeDefined();
        expect(exportData.metadata.totalRecords).toBeDefined();

        // But should have minimal metadata
        expect(exportData.metadata.normalizationSettings).toBeUndefined();
      }
    });

    it('should include custom export settings in metadata', async () => {
      const request: ExportDataRequest = {
        format: 'json',
        includeMetadata: true,
        exportSettings: {
          includeTimestamps: true,
          compressOutput: false,
          formatVersion: '2.1',
        },
      };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const response = result.value;
        const exportData = response.exportData;

        expect(exportData.metadata.exportSettings).toEqual({
          includeTimestamps: true,
          compressOutput: false,
          formatVersion: '2.1',
        });
      }
    });
  });

  describe('error handling scenarios', () => {
    it('should handle record repository errors', async () => {
      const domainError = new DomainError(
        'RECORD_ACCESS_ERROR',
        'Failed to access records'
      );
      mockRecordRepository.setError(domainError);

      const request: ExportDataRequest = {
        format: 'json',
        includeMetadata: true,
      };

      const result = await useCase.execute(request);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('RECORD_ACCESS_ERROR');
        expect(result.error.message).toBe('Failed to access records');
      }
    });

    it('should handle tag repository errors', async () => {
      const domainError = new DomainError(
        'TAG_ACCESS_ERROR',
        'Failed to access tags'
      );
      mockTagRepository.setError(domainError);

      const request: ExportDataRequest = {
        format: 'json',
        includeMetadata: true,
      };

      const result = await useCase.execute(request);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('TAG_ACCESS_ERROR');
        expect(result.error.message).toBe('Failed to access tags');
      }
    });

    it('should handle invalid export format gracefully', async () => {
      const request: ExportDataRequest = {
        format: 'invalid' as any,
        includeMetadata: true,
      };

      const result = await useCase.execute(request);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('INVALID_EXPORT_FORMAT');
        expect(result.error.message).toContain('Unsupported export format');
      }
    });
  });

  describe('data consistency and integrity', () => {
    it('should maintain data consistency between records and metadata', async () => {
      const request: ExportDataRequest = {
        format: 'json',
        includeMetadata: true,
      };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const response = result.value;
        const exportData = response.exportData;

        expect(exportData.records.length).toBe(
          exportData.metadata.totalRecords
        );

        // Verify each record has valid structure
        exportData.records.forEach((record) => {
          expect(record.id.trim()).toBeTruthy();
          expect(record.content.trim()).toBeTruthy();
          expect(record.tagIds.length).toBeGreaterThanOrEqual(0);
          expect(new Date(record.createdAt).getTime()).toBeGreaterThan(0);
          expect(new Date(record.updatedAt).getTime()).toBeGreaterThan(0);
        });
      }
    });

    it('should ensure export data is JSON serializable for portability', async () => {
      const request: ExportDataRequest = {
        format: 'json',
        includeMetadata: true,
        normalizationSettings: {
          caseSensitive: false,
          removeDiacritics: true,
          normalizeUnicode: true,
        },
      };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const response = result.value;
        const exportData = response.exportData;

        // Should be fully serializable
        expect(() => JSON.stringify(exportData)).not.toThrow();

        // Should deserialize to same structure
        const serialized = JSON.stringify(exportData);
        const deserialized = JSON.parse(serialized);
        expect(deserialized).toEqual(exportData);
      }
    });

    it('should handle large datasets efficiently', async () => {
      // Create a larger dataset for performance testing
      const largeTags = Array.from({ length: 100 }, (_, i) =>
        Tag.create(`tag${i}`, `tag${i}`)
      );
      const largeRecords = Array.from({ length: 1000 }, (_, i) =>
        Record.create(
          `record ${i} with multiple tags`,
          new Set([largeTags[i % largeTags.length].id])
        )
      );

      mockTagRepository.setTags(largeTags);
      mockRecordRepository.setRecords(largeRecords);

      const request: ExportDataRequest = {
        format: 'json',
        includeMetadata: true,
      };

      const startTime = Date.now();
      const result = await useCase.execute(request);
      const endTime = Date.now();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const response = result.value;
        const exportData = response.exportData;

        expect(exportData.records).toHaveLength(1000);
        expect(exportData.metadata.totalRecords).toBe(1000);

        // Performance check - should complete in reasonable time
        expect(endTime - startTime).toBeLessThan(5000); // 5 seconds max
      }
    });
  });

  describe('TypeScript type safety', () => {
    it('should enforce correct request type structure', () => {
      const request: ExportDataRequest = {
        format: 'json',
        includeMetadata: true,
        normalizationSettings: {
          caseSensitive: false,
          removeDiacritics: true,
          normalizeUnicode: true,
        },
        exportSettings: {
          includeTimestamps: true,
          compressOutput: false,
          formatVersion: '2.1',
        },
      };

      // Should compile without errors
      expect(request.format).toBe('json');
      expect(request.includeMetadata).toBe(true);
      expect(request.normalizationSettings?.caseSensitive).toBe(false);
      expect(request.exportSettings?.includeTimestamps).toBe(true);
    });

    it('should enforce correct response type structure', async () => {
      const request: ExportDataRequest = {
        format: 'json',
        includeMetadata: true,
      };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const response: ExportDataResponse = result.value;

        // Should have correct types
        expect(typeof response.success).toBe('boolean');
        expect(typeof response.exportData).toBe('object');
        expect(response.exportData.format).toBe('json');
        expect(Array.isArray(response.exportData.records)).toBe(true);
      }
    });
  });
});
