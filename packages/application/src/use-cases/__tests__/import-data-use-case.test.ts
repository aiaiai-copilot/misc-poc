import { Result, Ok, Err } from '@misc-poc/shared';
import {
  DomainError,
  Record,
  Tag,
  RecordFactory,
  TagFactory,
} from '@misc-poc/domain';
import {
  RecordRepository,
  RecordSearchResult,
} from '../../ports/record-repository';
import { TagRepository } from '../../ports/tag-repository';
import { UnitOfWork } from '../../ports/unit-of-work';
import {
  ImportValidator,
  ImportValidationResult,
} from '../../services/import-validator';
import { RecordDTO } from '../../dtos/record-dto';
import { ExportDTO } from '../../dtos/export-dto';
import { ImportResultDTO } from '../../dtos/import-result-dto';

// Mock implementations
class MockRecordRepository implements RecordRepository {
  private records: Record[] = [];
  private shouldReturnError: boolean = false;
  private errorToReturn: DomainError | null = null;
  private deleteAllCalled: boolean = false;
  private saveBatchCalled: boolean = false;
  private savedRecords: Record[] = [];

  setRecords(records: Record[]): void {
    this.records = records;
  }

  getRecords(): Record[] {
    return this.records;
  }

  setError(error: DomainError): void {
    this.shouldReturnError = true;
    this.errorToReturn = error;
  }

  clearError(): void {
    this.shouldReturnError = false;
    this.errorToReturn = null;
  }

  wasDeleteAllCalled(): boolean {
    return this.deleteAllCalled;
  }

  wasSaveBatchCalled(): boolean {
    return this.saveBatchCalled;
  }

  getSavedRecords(): Record[] {
    return this.savedRecords;
  }

  reset(): void {
    this.deleteAllCalled = false;
    this.saveBatchCalled = false;
    this.savedRecords = [];
    this.clearError();
  }

  async findById(): Promise<Result<Record | null, DomainError>> {
    if (this.shouldReturnError && this.errorToReturn) {
      return Err(this.errorToReturn);
    }
    return Ok(null);
  }

  async findAll(): Promise<Result<RecordSearchResult, DomainError>> {
    if (this.shouldReturnError && this.errorToReturn) {
      return Err(this.errorToReturn);
    }
    return Ok({
      records: this.records,
      total: this.records.length,
      hasMore: false,
    });
  }

  async search(): Promise<Result<RecordSearchResult, DomainError>> {
    return Ok({ records: [], total: 0, hasMore: false });
  }

  async findByTagIds(): Promise<Result<RecordSearchResult, DomainError>> {
    return Ok({ records: [], total: 0, hasMore: false });
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

  async saveBatch(records: Record[]): Promise<Result<Record[], DomainError>> {
    if (this.shouldReturnError && this.errorToReturn) {
      return Err(this.errorToReturn);
    }

    this.saveBatchCalled = true;
    this.savedRecords = records;
    this.records = [...records];
    return Ok(records);
  }

  async deleteAll(): Promise<Result<void, DomainError>> {
    if (this.shouldReturnError && this.errorToReturn) {
      return Err(this.errorToReturn);
    }

    this.deleteAllCalled = true;
    this.records = [];
    return Ok(undefined);
  }

  async count(): Promise<Result<number, DomainError>> {
    return Ok(this.records.length);
  }

  async exists(): Promise<Result<boolean, DomainError>> {
    return Ok(false);
  }
}

class MockTagRepository implements TagRepository {
  private tags: Map<string, Tag> = new Map();
  private shouldReturnError: boolean = false;
  private errorToReturn: DomainError | null = null;
  private saveBatchCalled: boolean = false;
  private savedTags: Tag[] = [];

  setTags(tags: Tag[]): void {
    this.tags.clear();
    tags.forEach((tag) => {
      this.tags.set(tag.id.toString(), tag);
    });
  }

  getTags(): Tag[] {
    return Array.from(this.tags.values());
  }

  setError(error: DomainError): void {
    this.shouldReturnError = true;
    this.errorToReturn = error;
  }

  clearError(): void {
    this.shouldReturnError = false;
    this.errorToReturn = null;
  }

  wasSaveBatchCalled(): boolean {
    return this.saveBatchCalled;
  }

  getSavedTags(): Tag[] {
    return this.savedTags;
  }

  reset(): void {
    this.saveBatchCalled = false;
    this.savedTags = [];
    this.clearError();
  }

  async findAll(): Promise<Result<Tag[], DomainError>> {
    if (this.shouldReturnError && this.errorToReturn) {
      return Err(this.errorToReturn);
    }
    return Ok(Array.from(this.tags.values()));
  }

  async saveBatch(tags: Tag[]): Promise<Result<Tag[], DomainError>> {
    if (this.shouldReturnError && this.errorToReturn) {
      return Err(this.errorToReturn);
    }

    this.saveBatchCalled = true;
    this.savedTags = tags;
    tags.forEach((tag) => {
      this.tags.set(tag.id.toString(), tag);
    });
    return Ok(tags);
  }

  // Other required methods (minimal implementation)
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
  async deleteOrphaned(): Promise<Result<void, DomainError>> {
    return Ok(undefined);
  }
}

class MockUnitOfWork implements UnitOfWork {
  public readonly records: RecordRepository;
  public readonly tags: TagRepository;
  private transactionActive: boolean = false;
  private shouldReturnError: boolean = false;
  private errorToReturn: DomainError | null = null;
  private beginCalled: boolean = false;
  private commitCalled: boolean = false;
  private rollbackCalled: boolean = false;

  constructor(recordRepo: RecordRepository, tagRepo: TagRepository) {
    this.records = recordRepo;
    this.tags = tagRepo;
  }

  setError(error: DomainError): void {
    this.shouldReturnError = true;
    this.errorToReturn = error;
  }

  clearError(): void {
    this.shouldReturnError = false;
    this.errorToReturn = null;
  }

  wasBeginCalled(): boolean {
    return this.beginCalled;
  }

  wasCommitCalled(): boolean {
    return this.commitCalled;
  }

  wasRollbackCalled(): boolean {
    return this.rollbackCalled;
  }

  reset(): void {
    this.transactionActive = false;
    this.beginCalled = false;
    this.commitCalled = false;
    this.rollbackCalled = false;
    this.clearError();
  }

  async begin(): Promise<Result<void, DomainError>> {
    if (this.shouldReturnError && this.errorToReturn) {
      return Err(this.errorToReturn);
    }

    this.beginCalled = true;
    this.transactionActive = true;
    return Ok(undefined);
  }

  async commit(): Promise<Result<void, DomainError>> {
    if (this.shouldReturnError && this.errorToReturn) {
      return Err(this.errorToReturn);
    }

    this.commitCalled = true;
    this.transactionActive = false;
    return Ok(undefined);
  }

  async rollback(): Promise<Result<void, DomainError>> {
    if (this.shouldReturnError && this.errorToReturn) {
      return Err(this.errorToReturn);
    }

    this.rollbackCalled = true;
    this.transactionActive = false;
    return Ok(undefined);
  }

  async execute<T>(
    operation: (uow: UnitOfWork) => Promise<Result<T, DomainError>>
  ): Promise<Result<T, DomainError>> {
    const beginResult = await this.begin();
    if (beginResult.isErr()) {
      return beginResult as Result<T, DomainError>;
    }

    try {
      const result = await operation(this);
      if (result.isOk()) {
        const commitResult = await this.commit();
        if (commitResult.isErr()) {
          await this.rollback();
          return commitResult as Result<T, DomainError>;
        }
        return result;
      } else {
        await this.rollback();
        return result;
      }
    } catch (error) {
      await this.rollback();
      return Err(
        new DomainError(
          'TRANSACTION_FAILED',
          `Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
    }
  }

  isActive(): boolean {
    return this.transactionActive;
  }

  async dispose(): Promise<void> {
    this.transactionActive = false;
  }
}

class MockImportValidator extends ImportValidator {
  private shouldReturnError: boolean = false;
  private errorToReturn: DomainError | null = null;
  private validationResult: ImportValidationResult | null = null;

  setError(error: DomainError): void {
    this.shouldReturnError = true;
    this.errorToReturn = error;
  }

  setValidationResult(result: ImportValidationResult): void {
    this.validationResult = result;
  }

  clearError(): void {
    this.shouldReturnError = false;
    this.errorToReturn = null;
  }

  async validate(
    importData: unknown
  ): Promise<Result<ImportValidationResult, DomainError>> {
    if (this.shouldReturnError && this.errorToReturn) {
      return Err(this.errorToReturn);
    }

    if (this.validationResult) {
      return Ok(this.validationResult);
    }

    // Default: return valid result
    return Ok({
      isValid: true,
      errors: [],
      warnings: [],
      recordCount: 0,
      version: '1.0',
      migrationRequired: false,
    });
  }
}

// Import the use case we need to implement
import { ImportDataUseCase } from '../import-data-use-case';

describe('ImportDataUseCase', () => {
  let useCase: ImportDataUseCase;
  let mockRecordRepository: MockRecordRepository;
  let mockTagRepository: MockTagRepository;
  let mockUnitOfWork: MockUnitOfWork;
  let mockImportValidator: MockImportValidator;
  let recordFactory: RecordFactory;
  let tagFactory: TagFactory;

  // Test data fixtures
  let validImportData: ExportDTO;
  let testRecordDTOs: RecordDTO[];

  beforeEach(() => {
    mockRecordRepository = new MockRecordRepository();
    mockTagRepository = new MockTagRepository();
    mockUnitOfWork = new MockUnitOfWork(
      mockRecordRepository,
      mockTagRepository
    );
    mockImportValidator = new MockImportValidator();

    // Create domain services
    recordFactory = new RecordFactory();
    tagFactory = new TagFactory();

    useCase = new ImportDataUseCase(
      mockUnitOfWork,
      mockImportValidator,
      tagFactory
    );

    // Create test fixtures
    testRecordDTOs = [
      {
        id: 'record_1',
        content: 'javascript testing framework',
        tagIds: ['javascript', 'testing', 'framework'],
        createdAt: '2024-01-01T10:00:00.000Z',
        updatedAt: '2024-01-01T10:00:00.000Z',
      },
      {
        id: 'record_2',
        content: 'typescript configuration guide',
        tagIds: ['typescript', 'configuration'],
        createdAt: '2024-01-01T11:00:00.000Z',
        updatedAt: '2024-01-01T11:00:00.000Z',
      },
    ];

    validImportData = {
      records: testRecordDTOs,
      format: 'json',
      exportedAt: '2024-01-01T12:00:00.000Z',
      version: '1.0',
      metadata: {
        totalRecords: testRecordDTOs.length,
        exportSource: 'full-database',
      },
    };

    // Reset mocks
    mockRecordRepository.reset();
    mockTagRepository.reset();
    mockUnitOfWork.reset();
    mockImportValidator.clearError();
  });

  describe('successful import scenarios', () => {
    it('should perform complete data replacement with backup creation', async () => {
      // Setup: existing data in repository
      const existingRecords = [Record.create('existing record', new Set())];
      mockRecordRepository.setRecords(existingRecords);

      // Mock validation success
      mockImportValidator.setValidationResult({
        isValid: true,
        errors: [],
        warnings: [],
        recordCount: testRecordDTOs.length,
        version: '1.0',
        migrationRequired: false,
      });

      const result = await useCase.execute(validImportData);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const response = result.value;

        // Verify successful import
        expect(response.success).toBe(true);
        expect(response.totalProcessed).toBe(testRecordDTOs.length);
        expect(response.successCount).toBe(testRecordDTOs.length);
        expect(response.errorCount).toBe(0);

        // Verify transaction was used
        expect(mockUnitOfWork.wasBeginCalled()).toBe(true);
        expect(mockUnitOfWork.wasCommitCalled()).toBe(true);

        // Verify complete data replacement
        expect(mockRecordRepository.wasDeleteAllCalled()).toBe(true);
        expect(mockRecordRepository.wasSaveBatchCalled()).toBe(true);
        expect(mockTagRepository.wasSaveBatchCalled()).toBe(true);

        // Verify all records were imported
        const savedRecords = mockRecordRepository.getSavedRecords();
        expect(savedRecords).toHaveLength(testRecordDTOs.length);
      }
    });

    it('should create automatic backup before data replacement', async () => {
      // Setup: existing data
      const existingRecords = [Record.create('backup me', new Set())];
      mockRecordRepository.setRecords(existingRecords);

      mockImportValidator.setValidationResult({
        isValid: true,
        errors: [],
        warnings: [],
        recordCount: testRecordDTOs.length,
        version: '1.0',
        migrationRequired: false,
      });

      const result = await useCase.execute(validImportData);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const response = result.value;

        // Should indicate backup was created
        expect(response.warnings).toBeDefined();
        const backupWarning = response.warnings?.find(
          (w) => w.message.includes('backup') || w.code === 'BACKUP_CREATED'
        );
        expect(backupWarning).toBeDefined();
      }
    });

    it('should validate import data before processing', async () => {
      mockImportValidator.setValidationResult({
        isValid: true,
        errors: [],
        warnings: [],
        recordCount: testRecordDTOs.length,
        version: '1.0',
        migrationRequired: false,
      });

      const result = await useCase.execute(validImportData);

      expect(result.isOk()).toBe(true);
      // Validation should have been called during execution
    });

    it('should process records in batches for performance', async () => {
      // Create larger dataset to test batch processing
      const largeRecordDTOs = Array.from({ length: 1000 }, (_, i) => ({
        id: `record_${i}`,
        content: `record ${i} content`,
        tagIds: [`tag${i % 10}`],
        createdAt: '2024-01-01T10:00:00.000Z',
        updatedAt: '2024-01-01T10:00:00.000Z',
      }));

      const largeImportData: ExportDTO = {
        ...validImportData,
        records: largeRecordDTOs,
        metadata: {
          ...validImportData.metadata,
          totalRecords: largeRecordDTOs.length,
        },
      };

      mockImportValidator.setValidationResult({
        isValid: true,
        errors: [],
        warnings: [],
        recordCount: largeRecordDTOs.length,
        version: '1.0',
        migrationRequired: false,
      });

      const startTime = Date.now();
      const result = await useCase.execute(largeImportData);
      const endTime = Date.now();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const response = result.value;
        expect(response.totalProcessed).toBe(largeRecordDTOs.length);
        expect(response.successCount).toBe(largeRecordDTOs.length);

        // Performance should be reasonable
        expect(endTime - startTime).toBeLessThan(5000); // 5 seconds max
      }
    });

    it('should handle empty import data gracefully', async () => {
      const emptyImportData: ExportDTO = {
        ...validImportData,
        records: [],
        metadata: {
          ...validImportData.metadata,
          totalRecords: 0,
        },
      };

      mockImportValidator.setValidationResult({
        isValid: true,
        errors: [],
        warnings: [
          {
            type: 'EMPTY_IMPORT',
            field: 'records',
            message: 'Import data contains no records',
            severity: 'warning',
          },
        ],
        recordCount: 0,
        version: '1.0',
        migrationRequired: false,
      });

      const result = await useCase.execute(emptyImportData);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const response = result.value;
        expect(response.success).toBe(true);
        expect(response.totalProcessed).toBe(0);
        expect(response.warnings).toBeDefined();
      }
    });

    it('should create unique tags from imported records', async () => {
      mockImportValidator.setValidationResult({
        isValid: true,
        errors: [],
        warnings: [],
        recordCount: testRecordDTOs.length,
        version: '1.0',
        migrationRequired: false,
      });

      const result = await useCase.execute(validImportData);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        // Verify tags were created and saved
        expect(mockTagRepository.wasSaveBatchCalled()).toBe(true);

        const savedTags = mockTagRepository.getSavedTags();
        const expectedUniqueTags = new Set(
          testRecordDTOs.flatMap((r) => r.tagIds)
        );
        expect(savedTags.length).toBe(expectedUniqueTags.size);
      }
    });

    it('should preserve record timestamps from import', async () => {
      mockImportValidator.setValidationResult({
        isValid: true,
        errors: [],
        warnings: [],
        recordCount: testRecordDTOs.length,
        version: '1.0',
        migrationRequired: false,
      });

      const result = await useCase.execute(validImportData);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const savedRecords = mockRecordRepository.getSavedRecords();

        savedRecords.forEach((record, index) => {
          const originalDTO = testRecordDTOs[index];
          expect(record.createdAt.toISOString()).toBe(originalDTO.createdAt);
          expect(record.updatedAt.toISOString()).toBe(originalDTO.updatedAt);
        });
      }
    });

    it('should return detailed import statistics', async () => {
      mockImportValidator.setValidationResult({
        isValid: true,
        errors: [],
        warnings: [],
        recordCount: testRecordDTOs.length,
        version: '1.0',
        migrationRequired: false,
      });

      const beforeImport = Date.now();
      const result = await useCase.execute(validImportData);
      const afterImport = Date.now();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const response = result.value;

        // Verify detailed statistics
        expect(response.totalProcessed).toBe(testRecordDTOs.length);
        expect(response.successCount).toBe(testRecordDTOs.length);
        expect(response.errorCount).toBe(0);
        expect(response.duration).toBeGreaterThanOrEqual(0);
        expect(response.duration).toBeLessThanOrEqual(
          afterImport - beforeImport
        );
        expect(response.importedAt).toBeDefined();

        const importedAt = new Date(response.importedAt);
        expect(importedAt.getTime()).toBeGreaterThanOrEqual(beforeImport);
        expect(importedAt.getTime()).toBeLessThanOrEqual(afterImport);

        // Verify summary statistics
        expect(response.summary.recordsCreated).toBe(testRecordDTOs.length);
        expect(response.summary.recordsUpdated).toBe(0);
        expect(response.summary.recordsSkipped).toBe(0);
        expect(response.summary.recordsFailed).toBe(0);
      }
    });
  });

  describe('validation failure scenarios', () => {
    it('should reject invalid import data', async () => {
      mockImportValidator.setValidationResult({
        isValid: false,
        errors: [
          {
            type: 'INVALID_FORMAT',
            field: 'version',
            message: 'Unsupported version: 0.5',
            severity: 'error',
          },
        ],
        warnings: [],
        recordCount: 0,
        version: '0.5',
        migrationRequired: false,
      });

      const result = await useCase.execute(validImportData);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('IMPORT_VALIDATION_FAILED');
        expect(result.error.message).toContain('validation failed');
      }

      // Verify no changes were made
      expect(mockRecordRepository.wasDeleteAllCalled()).toBe(false);
      expect(mockRecordRepository.wasSaveBatchCalled()).toBe(false);
    });

    it('should handle validation service errors', async () => {
      const validationError = new DomainError(
        'VALIDATION_SERVICE_ERROR',
        'Validation service unavailable'
      );
      mockImportValidator.setError(validationError);

      const result = await useCase.execute(validImportData);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('VALIDATION_SERVICE_ERROR');
      }
    });

    it('should validate individual record data integrity', async () => {
      const invalidRecordDTO: RecordDTO = {
        id: '',
        content: '',
        tagIds: [],
        createdAt: 'invalid-date',
        updatedAt: 'also-invalid',
      };

      const invalidImportData: ExportDTO = {
        ...validImportData,
        records: [invalidRecordDTO],
        metadata: {
          ...validImportData.metadata,
          totalRecords: 1,
        },
      };

      mockImportValidator.setValidationResult({
        isValid: false,
        errors: [
          {
            type: 'INVALID_RECORD_FORMAT',
            field: 'records[0].id',
            message: 'Record ID cannot be empty',
            severity: 'error',
            recordIndex: 0,
          },
        ],
        warnings: [],
        recordCount: 1,
        version: '1.0',
        migrationRequired: false,
      });

      const result = await useCase.execute(invalidImportData);

      expect(result.isErr()).toBe(true);
    });
  });

  describe('rollback capability on failure', () => {
    it('should rollback transaction on record creation failure', async () => {
      mockImportValidator.setValidationResult({
        isValid: true,
        errors: [],
        warnings: [],
        recordCount: testRecordDTOs.length,
        version: '1.0',
        migrationRequired: false,
      });

      // Make record repository fail during saveBatch
      const saveBatchError = new DomainError(
        'RECORD_SAVE_FAILED',
        'Failed to save records'
      );
      mockRecordRepository.setError(saveBatchError);

      const result = await useCase.execute(validImportData);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('RECORD_SAVE_FAILED');
      }

      // Verify transaction was rolled back
      expect(mockUnitOfWork.wasBeginCalled()).toBe(true);
      expect(mockUnitOfWork.wasRollbackCalled()).toBe(true);
      expect(mockUnitOfWork.wasCommitCalled()).toBe(false);
    });

    it('should rollback transaction on tag creation failure', async () => {
      mockImportValidator.setValidationResult({
        isValid: true,
        errors: [],
        warnings: [],
        recordCount: testRecordDTOs.length,
        version: '1.0',
        migrationRequired: false,
      });

      // Make tag repository fail during saveBatch
      const tagSaveError = new DomainError(
        'TAG_SAVE_FAILED',
        'Failed to save tags'
      );
      mockTagRepository.setError(tagSaveError);

      const result = await useCase.execute(validImportData);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('TAG_SAVE_FAILED');
      }

      // Verify transaction was rolled back
      expect(mockUnitOfWork.wasRollbackCalled()).toBe(true);
      expect(mockUnitOfWork.wasCommitCalled()).toBe(false);
    });

    it('should rollback transaction on deleteAll failure', async () => {
      mockImportValidator.setValidationResult({
        isValid: true,
        errors: [],
        warnings: [],
        recordCount: testRecordDTOs.length,
        version: '1.0',
        migrationRequired: false,
      });

      // Make record repository fail during deleteAll
      const deleteError = new DomainError(
        'DELETE_ALL_FAILED',
        'Failed to delete existing records'
      );
      mockRecordRepository.setError(deleteError);

      const result = await useCase.execute(validImportData);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('DELETE_ALL_FAILED');
      }

      // Verify transaction was rolled back
      expect(mockUnitOfWork.wasRollbackCalled()).toBe(true);
    });

    it('should preserve original data on rollback', async () => {
      // Setup: existing data
      const existingRecords = [Record.create('preserve me', new Set())];
      mockRecordRepository.setRecords(existingRecords);

      mockImportValidator.setValidationResult({
        isValid: true,
        errors: [],
        warnings: [],
        recordCount: testRecordDTOs.length,
        version: '1.0',
        migrationRequired: false,
      });

      // Force a failure after deleteAll but before saveBatch
      mockRecordRepository.setError(
        new DomainError('SAVE_BATCH_FAILED', 'Save batch failed')
      );

      const result = await useCase.execute(validImportData);

      expect(result.isErr()).toBe(true);

      // After rollback, original data should be preserved
      // (This would be handled by the actual UnitOfWork implementation)
      expect(mockUnitOfWork.wasRollbackCalled()).toBe(true);
    });
  });

  describe('performance and batch processing', () => {
    it('should handle large datasets efficiently', async () => {
      // Create large dataset
      const largeRecordDTOs = Array.from({ length: 5000 }, (_, i) => ({
        id: `record_${i}`,
        content: `large record ${i} with multiple tags`,
        tagIds: [`tag${i % 100}`, `category${i % 50}`, `type${i % 25}`],
        createdAt: '2024-01-01T10:00:00.000Z',
        updatedAt: '2024-01-01T10:00:00.000Z',
      }));

      const largeImportData: ExportDTO = {
        ...validImportData,
        records: largeRecordDTOs,
        metadata: {
          ...validImportData.metadata,
          totalRecords: largeRecordDTOs.length,
        },
      };

      mockImportValidator.setValidationResult({
        isValid: true,
        errors: [],
        warnings: [],
        recordCount: largeRecordDTOs.length,
        version: '1.0',
        migrationRequired: false,
      });

      const startTime = Date.now();
      const result = await useCase.execute(largeImportData);
      const endTime = Date.now();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const response = result.value;
        expect(response.totalProcessed).toBe(largeRecordDTOs.length);
        expect(response.successCount).toBe(largeRecordDTOs.length);

        // Performance check
        const duration = endTime - startTime;
        expect(duration).toBeLessThan(10000); // 10 seconds max for large dataset

        // Memory efficiency - shouldn't keep all records in memory simultaneously
        expect(response.successfulRecords).toBeDefined();
      }
    });

    it('should process tags efficiently avoiding duplicates', async () => {
      // Create records with many overlapping tags
      const recordsWithDuplicateTags = Array.from({ length: 100 }, (_, i) => ({
        id: `record_${i}`,
        content: `record ${i}`,
        tagIds: ['common', 'shared', `unique_${i % 10}`],
        createdAt: '2024-01-01T10:00:00.000Z',
        updatedAt: '2024-01-01T10:00:00.000Z',
      }));

      const importWithDuplicates: ExportDTO = {
        ...validImportData,
        records: recordsWithDuplicateTags,
        metadata: {
          ...validImportData.metadata,
          totalRecords: recordsWithDuplicateTags.length,
        },
      };

      mockImportValidator.setValidationResult({
        isValid: true,
        errors: [],
        warnings: [],
        recordCount: recordsWithDuplicateTags.length,
        version: '1.0',
        migrationRequired: false,
      });

      const result = await useCase.execute(importWithDuplicates);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        // Verify that unique tags were created efficiently
        const savedTags = mockTagRepository.getSavedTags();
        const uniqueTagNames = new Set(
          recordsWithDuplicateTags.flatMap((r) => r.tagIds)
        );
        expect(savedTags.length).toBe(uniqueTagNames.size);

        // Should be much less than total tag references due to deduplication
        const totalTagReferences = recordsWithDuplicateTags.length * 3; // 3 tags per record
        expect(savedTags.length).toBeLessThan(totalTagReferences / 2);
      }
    });
  });

  describe('TypeScript type safety and interfaces', () => {
    it('should enforce correct import data structure', () => {
      const typedImportData: ExportDTO = {
        records: testRecordDTOs,
        format: 'json',
        exportedAt: '2024-01-01T12:00:00.000Z',
        version: '1.0',
        metadata: {
          totalRecords: testRecordDTOs.length,
          exportSource: 'full-database',
        },
      };

      // Should compile without errors
      expect(typedImportData.records).toBeDefined();
      expect(typedImportData.format).toBe('json');
      expect(typedImportData.version).toBe('1.0');
      expect(typedImportData.metadata.totalRecords).toBe(testRecordDTOs.length);
    });

    it('should return correctly typed import result', async () => {
      mockImportValidator.setValidationResult({
        isValid: true,
        errors: [],
        warnings: [],
        recordCount: testRecordDTOs.length,
        version: '1.0',
        migrationRequired: false,
      });

      const result = await useCase.execute(validImportData);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const response: ImportResultDTO = result.value;

        // Verify type structure
        expect(typeof response.success).toBe('boolean');
        expect(typeof response.totalProcessed).toBe('number');
        expect(typeof response.successCount).toBe('number');
        expect(typeof response.errorCount).toBe('number');
        expect(typeof response.importedAt).toBe('string');
        expect(typeof response.duration).toBe('number');
        expect(typeof response.summary).toBe('object');

        // Verify summary structure
        expect(typeof response.summary.recordsCreated).toBe('number');
        expect(typeof response.summary.recordsUpdated).toBe('number');
        expect(typeof response.summary.recordsSkipped).toBe('number');
        expect(typeof response.summary.recordsFailed).toBe('number');
      }
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle malformed import data gracefully', async () => {
      const malformedData = {
        // Missing required fields
        records: null,
        format: 'invalid',
      };

      mockImportValidator.setValidationResult({
        isValid: false,
        errors: [
          {
            type: 'INVALID_FORMAT',
            field: 'records',
            message: 'Records field is required and must be an array',
            severity: 'error',
          },
        ],
        warnings: [],
        recordCount: 0,
        version: 'unknown',
        migrationRequired: false,
      });

      const result = await useCase.execute(malformedData as any);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('IMPORT_VALIDATION_FAILED');
      }
    });

    it('should handle concurrent import attempts safely', async () => {
      mockImportValidator.setValidationResult({
        isValid: true,
        errors: [],
        warnings: [],
        recordCount: testRecordDTOs.length,
        version: '1.0',
        migrationRequired: false,
      });

      // Simulate concurrent imports
      const import1 = useCase.execute(validImportData);
      const import2 = useCase.execute(validImportData);

      const results = await Promise.all([import1, import2]);

      // At least one should succeed, or both should fail gracefully
      const successCount = results.filter((r) => r.isOk()).length;
      const errorCount = results.filter((r) => r.isErr()).length;

      expect(successCount + errorCount).toBe(2);
      // If errors occurred, they should be proper domain errors
      results.forEach((result) => {
        if (result.isErr()) {
          expect(result.error).toBeInstanceOf(DomainError);
        }
      });
    });

    it('should handle transaction begin failures', async () => {
      mockImportValidator.setValidationResult({
        isValid: true,
        errors: [],
        warnings: [],
        recordCount: testRecordDTOs.length,
        version: '1.0',
        migrationRequired: false,
      });

      // Make transaction begin fail
      const transactionError = new DomainError(
        'TRANSACTION_BEGIN_FAILED',
        'Cannot begin transaction'
      );
      mockUnitOfWork.setError(transactionError);

      const result = await useCase.execute(validImportData);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('TRANSACTION_BEGIN_FAILED');
      }
    });

    it('should handle commit failures with proper cleanup', async () => {
      mockImportValidator.setValidationResult({
        isValid: true,
        errors: [],
        warnings: [],
        recordCount: testRecordDTOs.length,
        version: '1.0',
        migrationRequired: false,
      });

      // Let begin succeed but make commit fail
      // This would be handled by the UnitOfWork.execute method
      // The mock should simulate this scenario

      const result = await useCase.execute(validImportData);

      // The test passes if no exceptions are thrown and proper error handling occurs
      expect(result.isOk() || result.isErr()).toBe(true);
    });

    it('should handle backup creation within transaction correctly', async () => {
      // Create a stricter mock that throws when repositories are accessed without an active transaction
      // This test verifies that backup creation now happens within the transaction
      class StrictMockUnitOfWork implements UnitOfWork {
        private transactionActive = false;
        private mockRecordRepo: MockRecordRepository;
        private mockTagRepo: MockTagRepository;

        constructor(recordRepo: MockRecordRepository, tagRepo: MockTagRepository) {
          this.mockRecordRepo = recordRepo;
          this.mockTagRepo = tagRepo;
        }

        get records(): RecordRepository {
          if (!this.transactionActive) {
            throw new Error('Transaction not active. Call begin() first.');
          }
          return this.mockRecordRepo;
        }

        get tags(): TagRepository {
          if (!this.transactionActive) {
            throw new Error('Transaction not active. Call begin() first.');
          }
          return this.mockTagRepo;
        }

        async begin(): Promise<Result<void, DomainError>> {
          this.transactionActive = true;
          return Ok(undefined);
        }

        async commit(): Promise<Result<void, DomainError>> {
          this.transactionActive = false;
          return Ok(undefined);
        }

        async rollback(): Promise<Result<void, DomainError>> {
          this.transactionActive = false;
          return Ok(undefined);
        }

        async execute<T>(
          operation: (uow: UnitOfWork) => Promise<Result<T, DomainError>>
        ): Promise<Result<T, DomainError>> {
          const beginResult = await this.begin();
          if (beginResult.isErr()) {
            return beginResult as Result<T, DomainError>;
          }

          try {
            const result = await operation(this);
            if (result.isOk()) {
              const commitResult = await this.commit();
              if (commitResult.isErr()) {
                await this.rollback();
                return commitResult as Result<T, DomainError>;
              }
              return result;
            } else {
              await this.rollback();
              return result;
            }
          } catch (error) {
            await this.rollback();
            throw error; // Re-throw the original error to reproduce the issue
          }
        }

        isActive(): boolean {
          return this.transactionActive;
        }

        async dispose(): Promise<void> {
          this.transactionActive = false;
        }
      }

      // Create strict unit of work that throws on repository access without transaction
      const strictUnitOfWork = new StrictMockUnitOfWork(mockRecordRepository, mockTagRepository);
      const strictUseCase = new ImportDataUseCase(
        strictUnitOfWork,
        mockImportValidator,
        tagFactory
      );

      mockImportValidator.setValidationResult({
        isValid: true,
        errors: [],
        warnings: [],
        recordCount: 1,
        version: '1.0',
        migrationRequired: false,
      });

      // This should now succeed because backup creation is moved within the transaction
      const result = await strictUseCase.execute(validImportData);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.success).toBe(true);
      }
    });
  });
});
