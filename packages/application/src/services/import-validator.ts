import { Result, Ok, Err } from '@misc-poc/shared';
import { DomainError } from '@misc-poc/domain';
import { RecordDTO } from '../dtos/record-dto';

export interface ImportValidationError {
  readonly type: string;
  readonly field: string;
  readonly message: string;
  readonly severity: 'error' | 'warning';
  readonly recordIndex?: number;
  readonly tagIndex?: number;
  readonly recoverySuggestion?: string;
}

export interface MigrationPlan {
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly steps: string[];
  readonly isBreaking: boolean;
}

export interface ImportValidationResult {
  readonly isValid: boolean;
  readonly errors: ImportValidationError[];
  readonly warnings: ImportValidationError[];
  readonly recordCount: number;
  readonly version: string;
  readonly migrationRequired: boolean;
  readonly migrationPlan?: MigrationPlan;
}

export interface VersionCompatibility {
  readonly isSupported: boolean;
  readonly migrationRequired: boolean;
  readonly targetVersion?: string;
}

export class ImportValidator {
  private readonly SUPPORTED_VERSIONS = ['1.0', '0.9'];
  private readonly CURRENT_VERSION = '1.0';
  private readonly MAX_CONTENT_LENGTH = 10000;
  private readonly MAX_TAG_LENGTH = 100;
  private readonly FORBIDDEN_TAG_CHARS = /[{}[\]:,"\\]/;

  async validate(
    importData: unknown
  ): Promise<Result<ImportValidationResult, DomainError>> {
    try {
      const errors: ImportValidationError[] = [];
      const warnings: ImportValidationError[] = [];

      // Basic structure validation
      if (!this.isValidStructure(importData)) {
        return Err(
          new DomainError(
            'IMPORT_VALIDATION_FAILED',
            'Invalid import data structure. Expected ExportDTO format.'
          )
        );
      }

      const data = importData as Record<string, unknown>;

      // Validate required fields
      this.validateRequiredFields(data, errors);

      if (
        errors.length > 0 &&
        errors.some((e) => e.field === 'records' || e.field === 'version')
      ) {
        return Ok({
          isValid: false,
          errors,
          warnings,
          recordCount: 0,
          version: typeof data.version === 'string' ? data.version : 'unknown',
          migrationRequired: false,
        });
      }

      // Version compatibility check
      const version = data.version as string;
      let versionValidation = this.validateVersion(version, errors, warnings);

      // Detect if this is old format data that needs migration
      if (this.isOldFormatData(data)) {
        if (!versionValidation.migrationRequired) {
          warnings.push({
            type: 'MIGRATION_REQUIRED',
            field: 'structure',
            message: 'Data structure requires migration to current format',
            severity: 'warning',
          });
          versionValidation = {
            migrationRequired: true,
            migrationPlan: this.createMigrationPlan(
              version,
              this.CURRENT_VERSION
            ),
          };
        }
      }

      // Records validation - handle both current and old format
      let recordsToValidate = data.records as RecordDTO[];
      if (!recordsToValidate && data.data) {
        // Old format used 'data' instead of 'records'
        recordsToValidate = data.data as RecordDTO[];
      }
      await this.validateRecords(recordsToValidate || [], errors, warnings);

      // Metadata consistency validation
      this.validateMetadata(data, errors, recordsToValidate);

      // Check for empty import
      if (recordsToValidate && recordsToValidate.length === 0) {
        warnings.push({
          type: 'EMPTY_IMPORT',
          field: 'records',
          message: 'Import data contains no records',
          severity: 'warning',
        });
      }

      const isValid = errors.length === 0;
      const recordCount = recordsToValidate ? recordsToValidate.length : 0;

      return Ok({
        isValid,
        errors,
        warnings,
        recordCount,
        version,
        migrationRequired: versionValidation.migrationRequired,
        migrationPlan: versionValidation.migrationPlan,
      });
    } catch (error) {
      return Err(
        new DomainError(
          'IMPORT_VALIDATION_FAILED',
          `Import validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
    }
  }

  async validateRecord(
    record: RecordDTO,
    index: number
  ): Promise<ImportValidationError[]> {
    const errors: ImportValidationError[] = [];

    // Validate required fields
    if (!record.id || record.id.trim() === '') {
      errors.push({
        type: 'INVALID_RECORD_FORMAT',
        field: `records[${index}].id`,
        message:
          record.id === undefined
            ? 'Record missing required field: id'
            : 'Record ID cannot be empty',
        severity: 'error',
        recordIndex: index,
        recoverySuggestion:
          'Generate a unique ID for this record or use content-based hashing',
      });
    }

    if (record.content === undefined) {
      errors.push({
        type: 'INVALID_RECORD_FORMAT',
        field: `records[${index}].content`,
        message: 'Record missing required field: content',
        severity: 'error',
        recordIndex: index,
      });
    } else if (record.content.trim() === '') {
      errors.push({
        type: 'INVALID_RECORD_CONTENT',
        field: `records[${index}].content`,
        message: 'Record content cannot be empty',
        severity: 'error',
        recordIndex: index,
      });
    } else if (record.content.length > this.MAX_CONTENT_LENGTH) {
      errors.push({
        type: 'INVALID_RECORD_CONTENT',
        field: `records[${index}].content`,
        message: `Record content exceeds maximum length of ${this.MAX_CONTENT_LENGTH} characters`,
        severity: 'error',
        recordIndex: index,
      });
    }

    if (record.tagIds === undefined) {
      errors.push({
        type: 'INVALID_RECORD_FORMAT',
        field: `records[${index}].tagIds`,
        message: 'Record missing required field: tagIds',
        severity: 'error',
        recordIndex: index,
      });
    } else if (!Array.isArray(record.tagIds)) {
      errors.push({
        type: 'INVALID_RECORD_FORMAT',
        field: `records[${index}].tagIds`,
        message: 'Record tagIds must be an array',
        severity: 'error',
        recordIndex: index,
      });
    } else {
      // Validate individual tags
      record.tagIds.forEach((tag, tagIndex) => {
        this.validateTag(tag, index, tagIndex, errors);
      });
    }

    // Validate dates
    if (record.createdAt === undefined) {
      errors.push({
        type: 'INVALID_RECORD_FORMAT',
        field: `records[${index}].createdAt`,
        message: 'Record missing required field: createdAt',
        severity: 'error',
        recordIndex: index,
      });
    } else if (!this.isValidDateString(record.createdAt)) {
      errors.push({
        type: 'INVALID_DATE_FORMAT',
        field: `records[${index}].createdAt`,
        message: `Invalid date format: ${record.createdAt}`,
        severity: 'error',
        recordIndex: index,
      });
    }

    if (record.updatedAt === undefined) {
      errors.push({
        type: 'INVALID_RECORD_FORMAT',
        field: `records[${index}].updatedAt`,
        message: 'Record missing required field: updatedAt',
        severity: 'error',
        recordIndex: index,
      });
    } else if (!this.isValidDateString(record.updatedAt)) {
      errors.push({
        type: 'INVALID_DATE_FORMAT',
        field: `records[${index}].updatedAt`,
        message: `Invalid date format: ${record.updatedAt}`,
        severity: 'error',
        recordIndex: index,
      });
    }

    // Validate date chronological order
    if (
      record.createdAt &&
      record.updatedAt &&
      this.isValidDateString(record.createdAt) &&
      this.isValidDateString(record.updatedAt)
    ) {
      const createdDate = new Date(record.createdAt);
      const updatedDate = new Date(record.updatedAt);

      if (updatedDate < createdDate) {
        errors.push({
          type: 'INVALID_DATE_ORDER',
          field: `records[${index}].updatedAt`,
          message: 'Record updatedAt cannot be before createdAt',
          severity: 'error',
          recordIndex: index,
        });
      }
    }

    return errors;
  }

  getSupportedVersions(): string[] {
    return [...this.SUPPORTED_VERSIONS];
  }

  getVersionCompatibility(version: string): VersionCompatibility {
    if (version === this.CURRENT_VERSION) {
      return {
        isSupported: true,
        migrationRequired: false,
      };
    }

    if (this.SUPPORTED_VERSIONS.includes(version)) {
      return {
        isSupported: true,
        migrationRequired: true,
        targetVersion: this.CURRENT_VERSION,
      };
    }

    return {
      isSupported: false,
      migrationRequired: false,
    };
  }

  private isValidStructure(data: unknown): boolean {
    return typeof data === 'object' && data !== null && !Array.isArray(data);
  }

  private isOldFormatData(data: Record<string, unknown>): boolean {
    // Check for old format field names that indicate migration is needed
    if (data.data !== undefined) {
      return true; // Old format used 'data' instead of 'records'
    }

    if (
      data.records &&
      Array.isArray(data.records) &&
      data.records.length > 0
    ) {
      const firstRecord = data.records[0] as Record<string, unknown>;
      return (
        firstRecord.text !== undefined || // Old format used 'text' instead of 'content'
        firstRecord.tags !== undefined || // Old format used 'tags' instead of 'tagIds'
        firstRecord.created !== undefined || // Old format used 'created' instead of 'createdAt'
        firstRecord.updated !== undefined // Old format used 'updated' instead of 'updatedAt'
      );
    }

    return false;
  }

  private validateRequiredFields(
    data: Record<string, unknown>,
    errors: ImportValidationError[]
  ): void {
    const requiredFields = [
      'records',
      'format',
      'exportedAt',
      'version',
      'metadata',
    ];

    requiredFields.forEach((field) => {
      if (data[field] === undefined) {
        errors.push({
          type: 'MISSING_REQUIRED_FIELD',
          field: field,
          message: `Missing required field: ${field}`,
          severity: 'error',
        });
      }
    });

    // Special case: Check for old format fields that need migration
    if (data.data && !data.records) {
      // This is likely an old format, don't treat as missing field
      const recordsError = errors.find((e) => e.field === 'records');
      if (recordsError) {
        errors.splice(errors.indexOf(recordsError), 1);
      }
    }
  }

  private validateVersion(
    version: string,
    errors: ImportValidationError[],
    warnings: ImportValidationError[]
  ): { migrationRequired: boolean; migrationPlan?: MigrationPlan } {
    const compatibility = this.getVersionCompatibility(version);

    if (!compatibility.isSupported) {
      errors.push({
        type: 'UNSUPPORTED_VERSION',
        field: 'version',
        message: `Unsupported version: ${version}. Supported versions: ${this.SUPPORTED_VERSIONS.join(', ')}`,
        severity: 'error',
      });
      return { migrationRequired: false };
    }

    if (compatibility.migrationRequired) {
      warnings.push({
        type: 'MIGRATION_REQUIRED',
        field: 'version',
        message: `Migration required from version ${version} to ${compatibility.targetVersion}`,
        severity: 'warning',
      });

      return {
        migrationRequired: true,
        migrationPlan: this.createMigrationPlan(
          version,
          compatibility.targetVersion!
        ),
      };
    }

    return { migrationRequired: false };
  }

  private async validateRecords(
    records: RecordDTO[],
    errors: ImportValidationError[],
    _warnings: ImportValidationError[]
  ): Promise<void> {
    if (!Array.isArray(records)) {
      errors.push({
        type: 'INVALID_RECORD_FORMAT',
        field: 'records',
        message: 'Records must be an array',
        severity: 'error',
      });
      return;
    }

    const recordIds = new Set<string>();

    // Validate each record and check for duplicates
    for (let i = 0; i < records.length; i++) {
      const record = records[i];

      if (!record) {
        errors.push({
          type: 'INVALID_RECORD',
          field: `records[${i}]`,
          message: `Record at index ${i} is null or undefined`,
          severity: 'error' as const,
          recordIndex: i,
        });
        continue;
      }

      // Validate individual record
      const recordErrors = await this.validateRecord(record, i);
      errors.push(...recordErrors);

      // Check for duplicate IDs
      if (record?.id) {
        if (recordIds.has(record.id)) {
          errors.push({
            type: 'DUPLICATE_RECORD_ID',
            field: `records[${i}].id`,
            message: `Duplicate record ID: ${record.id}`,
            severity: 'error',
            recordIndex: i,
          });
        } else {
          recordIds.add(record.id);
        }
      }
    }
  }

  private validateTag(
    tag: string,
    recordIndex: number,
    tagIndex: number,
    errors: ImportValidationError[]
  ): void {
    if (tag === undefined || tag === null) {
      errors.push({
        type: 'INVALID_TAG_FORMAT',
        field: `records[${recordIndex}].tagIds[${tagIndex}]`,
        message: 'Tag cannot be null or undefined',
        severity: 'error',
        recordIndex,
        tagIndex,
      });
      return;
    }

    if (typeof tag !== 'string') {
      errors.push({
        type: 'INVALID_TAG_FORMAT',
        field: `records[${recordIndex}].tagIds[${tagIndex}]`,
        message: 'Tag must be a string',
        severity: 'error',
        recordIndex,
        tagIndex,
      });
      return;
    }

    if (tag.trim() === '') {
      errors.push({
        type: 'INVALID_TAG_FORMAT',
        field: `records[${recordIndex}].tagIds[${tagIndex}]`,
        message: 'Tag cannot be empty',
        severity: 'error',
        recordIndex,
        tagIndex,
      });
      return;
    }

    if (tag.length > this.MAX_TAG_LENGTH) {
      errors.push({
        type: 'INVALID_TAG_FORMAT',
        field: `records[${recordIndex}].tagIds[${tagIndex}]`,
        message: `Tag exceeds maximum length of ${this.MAX_TAG_LENGTH} characters`,
        severity: 'error',
        recordIndex,
        tagIndex,
      });
    }

    if (this.FORBIDDEN_TAG_CHARS.test(tag)) {
      const forbiddenChars = tag.match(this.FORBIDDEN_TAG_CHARS) || [];
      errors.push({
        type: 'INVALID_TAG_FORMAT',
        field: `records[${recordIndex}].tagIds[${tagIndex}]`,
        message: `Tag contains forbidden characters: ${forbiddenChars.join('')}`,
        severity: 'error',
        recordIndex,
        tagIndex,
      });
    }
  }

  private validateMetadata(
    data: Record<string, unknown>,
    errors: ImportValidationError[],
    records?: unknown[]
  ): void {
    if (!data.metadata) {
      return; // Already handled in required fields validation
    }

    // Check if totalRecords matches actual record count
    const metadata = data.metadata as Record<string, unknown>;
    if (metadata?.totalRecords !== undefined && records) {
      const actualCount = records.length;
      if (metadata.totalRecords !== actualCount) {
        errors.push({
          type: 'METADATA_INCONSISTENCY',
          field: 'metadata.totalRecords',
          message: `Metadata totalRecords (${metadata.totalRecords}) does not match actual record count (${actualCount})`,
          severity: 'error',
        });
      }
    }
  }

  private isValidDateString(dateString: string): boolean {
    const date = new Date(dateString);
    return !isNaN(date.getTime()) && date.toISOString() === dateString;
  }

  private createMigrationPlan(
    fromVersion: string,
    toVersion: string
  ): MigrationPlan {
    const steps: string[] = [];
    let isBreaking = false;

    if (fromVersion === '0.9' && toVersion === '1.0') {
      steps.push(
        'Rename field "data" to "records"',
        'Rename field "text" to "content"',
        'Rename field "tags" to "tagIds"',
        'Rename field "created" to "createdAt"',
        'Rename field "updated" to "updatedAt"',
        'Ensure all date fields are in ISO 8601 format',
        'Update version field to "1.0"'
      );
      isBreaking = true;
    }

    return {
      fromVersion,
      toVersion,
      steps,
      isBreaking,
    };
  }
}
