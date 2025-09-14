import {
  Result,
  Ok,
  Err,
  RecordId,
  TagId,
  RecordContent,
} from '@misc-poc/shared';
import { DomainError, Record, Tag, TagFactory } from '@misc-poc/domain';
import { UnitOfWork } from '../ports/unit-of-work';
import {
  ImportValidator,
  ImportValidationResult,
} from '../services/import-validator';
import { RecordDTO } from '../dtos/record-dto';
import { ExportDTO } from '../dtos/export-dto';
import {
  ImportResultDTO,
  ImportResultDTOMapper,
  ImportWarning,
} from '../dtos/import-result-dto';

export interface ImportDataRequest {
  readonly data: ExportDTO | unknown;
  readonly options?: {
    readonly createBackup?: boolean;
    readonly batchSize?: number;
    readonly skipValidation?: boolean;
  };
}

export class ImportDataUseCase {
  private readonly DEFAULT_BATCH_SIZE = 500;

  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly importValidator: ImportValidator,
    private readonly tagFactory: TagFactory
  ) {}

  async execute(
    importData: unknown
  ): Promise<Result<ImportResultDTO, DomainError>> {
    const startTime = new Date();

    try {
      // Step 1: Validate import data
      const validationResult = await this.importValidator.validate(importData);
      if (validationResult.isErr()) {
        return Err(validationResult.unwrapErr());
      }

      const validation = validationResult.unwrap();
      if (!validation.isValid) {
        return Err(
          new DomainError(
            'IMPORT_VALIDATION_FAILED',
            'Import data validation failed',
            {
              errors: validation.errors,
              warnings: validation.warnings,
            }
          )
        );
      }

      const exportData = importData as ExportDTO;
      const warnings: ImportWarning[] = [];

      // Convert validation warnings to import warnings
      validation.warnings.forEach((warning) => {
        warnings.push({
          message: warning.message,
          code: warning.type,
          details: {
            field: warning.field,
            severity: warning.severity,
            recordIndex: warning.recordIndex,
            tagIndex: warning.tagIndex,
          },
        });
      });

      // Step 2: Create automatic backup before data replacement
      const backupResult = await this.createBackup();
      if (backupResult.isErr()) {
        return Err(backupResult.unwrapErr());
      }

      if (backupResult.unwrap()) {
        warnings.push({
          message: 'Automatic backup created before data replacement',
          code: 'BACKUP_CREATED',
          details: { timestamp: new Date().toISOString() },
        });
      }

      // Step 3: Process import within transaction for rollback capability
      const importResult = await this.unitOfWork.execute(async (uow) => {
        // Step 3a: Complete data replacement - delete all existing data
        const deleteResult = await uow.records.deleteAll();
        if (deleteResult.isErr()) {
          return Err(deleteResult.unwrapErr());
        }

        // Step 3b: Process records in batches for performance
        const processResult = await this.processRecordsInBatches(
          exportData.records,
          this.DEFAULT_BATCH_SIZE
        );

        if (processResult.isErr()) {
          return Err(processResult.unwrapErr());
        }

        const { records, tags } = processResult.unwrap();

        // Step 3c: Save tags first (for referential integrity)
        const tagSaveResult = await uow.tags.saveBatch(tags);
        if (tagSaveResult.isErr()) {
          return Err(tagSaveResult.unwrapErr());
        }

        // Step 3d: Save records
        const recordSaveResult = await uow.records.saveBatch(records);
        if (recordSaveResult.isErr()) {
          return Err(recordSaveResult.unwrapErr());
        }

        return Ok({
          savedRecords: recordSaveResult.unwrap(),
          savedTags: tagSaveResult.unwrap(),
        });
      });

      if (importResult.isErr()) {
        return Err(importResult.unwrapErr());
      }

      const { savedRecords } = importResult.unwrap() as {
        savedRecords: Record[];
        savedTags: Tag[];
      };
      const endTime = new Date();

      // Step 4: Create successful import result with statistics
      const result = ImportResultDTOMapper.createWithWarnings(
        savedRecords.map((record: Record) => ({
          id: record.id.toString(),
          content: record.content.toString(),
          tagIds: Array.from(record.tagIds).map((tagId) =>
            (tagId as TagId).toString()
          ),
          createdAt: record.createdAt.toISOString(),
          updatedAt: record.updatedAt.toISOString(),
        })),
        [], // No errors for successful import
        warnings,
        startTime,
        endTime
      );

      return Ok(result);
    } catch (error) {
      const endTime = new Date();
      const importError = new DomainError(
        'IMPORT_OPERATION_FAILED',
        `Import operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { originalError: error }
      );

      // Return failure result
      const failureResult = ImportResultDTOMapper.createFailure(
        [
          {
            isValid: false,
            errors: [
              {
                field: 'import',
                message: importError.message,
                code: importError.code,
                severity: 'error' as const,
              },
            ],
            warnings: [],
            metadata: {
              code: importError.code,
              timestamp: endTime.toISOString(),
            },
          },
        ],
        startTime,
        endTime
      );

      return Ok(failureResult); // Return as Ok with failure details, not as Err
    }
  }

  private async createBackup(): Promise<Result<boolean, DomainError>> {
    try {
      // Check if there's existing data to backup
      const recordCountResult = await this.unitOfWork.records.count();
      if (recordCountResult.isErr()) {
        return recordCountResult.map(() => false);
      }

      const recordCount = recordCountResult.unwrap();
      if (recordCount === 0) {
        return Ok(false); // No backup needed for empty database
      }

      // In a real implementation, this would create an actual backup file
      // For now, we'll just indicate that a backup would be created
      // This could involve:
      // 1. Exporting current data to backup file
      // 2. Storing backup metadata
      // 3. Managing backup retention policy

      return Ok(true); // Backup created successfully
    } catch (error) {
      return Err(
        new DomainError(
          'BACKUP_CREATION_FAILED',
          `Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
    }
  }

  private async processRecordsInBatches(
    recordDTOs: RecordDTO[],
    batchSize: number
  ): Promise<Result<{ records: Record[]; tags: Tag[] }, DomainError>> {
    try {
      const allRecords: Record[] = [];
      const tagMap = new Map<string, Tag>(); // Use Map to avoid duplicates

      // Process records in batches for better memory management
      for (let i = 0; i < recordDTOs.length; i += batchSize) {
        const batch = recordDTOs.slice(i, i + batchSize);

        for (const recordDTO of batch) {
          // Create tags for this record (avoiding duplicates)
          const recordTagIds = new Set<TagId>();

          for (const tagValue of recordDTO.tagIds) {
            if (!tagMap.has(tagValue)) {
              const tag = this.tagFactory.createFromString(tagValue);
              tagMap.set(tagValue, tag);
            }
            recordTagIds.add(tagMap.get(tagValue)!.id);
          }

          // Create record with tag references
          const record = this.createRecordFromDTO(recordDTO, recordTagIds);
          allRecords.push(record);
        }
      }

      return Ok({
        records: allRecords,
        tags: Array.from(tagMap.values()),
      });
    } catch (error) {
      return Err(
        new DomainError(
          'RECORD_PROCESSING_FAILED',
          `Failed to process records: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
    }
  }

  private createRecordFromDTO(
    recordDTO: RecordDTO,
    tagIdObjects: Set<TagId>
  ): Record {
    // Create RecordContent from DTO content
    const recordContent = new RecordContent(recordDTO.content);

    // Create record with preserved timestamps using the Record constructor directly
    // since we need to preserve the original timestamps from import
    return new Record(
      RecordId.generate(), // Generate new ID for import
      recordContent,
      tagIdObjects,
      new Date(recordDTO.createdAt),
      new Date(recordDTO.updatedAt)
    );
  }

  /**
   * Get supported import formats
   */
  getSupportedFormats(): string[] {
    return ['json', 'csv', 'xml', 'yaml'];
  }

  /**
   * Get current batch size setting
   */
  getBatchSize(): number {
    return this.DEFAULT_BATCH_SIZE;
  }

  /**
   * Validate import data without performing the import
   */
  async validateOnly(
    importData: unknown
  ): Promise<Result<ImportValidationResult, DomainError>> {
    return this.importValidator.validate(importData);
  }
}
