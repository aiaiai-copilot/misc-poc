import { RecordDTO } from './record-dto';
import { ValidationResultDTO } from './validation-result-dto';

export interface ImportWarning {
  readonly message: string;
  readonly code: string;
  readonly details?: unknown;
}

export interface ImportSource {
  readonly filename: string;
  readonly format: 'json' | 'csv' | 'xml' | 'yaml';
  readonly fileSize: number;
  readonly originalPath?: string;
}

export interface ImportSummary {
  readonly recordsCreated: number;
  readonly recordsUpdated: number;
  readonly recordsSkipped: number;
  readonly recordsFailed: number;
}

export interface ImportResultDTO {
  readonly success: boolean;
  readonly totalProcessed: number;
  readonly successCount: number;
  readonly errorCount: number;
  readonly importedAt: string;
  readonly duration: number;
  readonly summary: ImportSummary;
  readonly successfulRecords?: RecordDTO[];
  readonly errors?: ValidationResultDTO[];
  readonly warnings?: ImportWarning[];
  readonly source?: ImportSource;
  readonly importId?: string;
  readonly importedBy?: string;
}

export class ImportResultDTOMapper {
  static createSuccess(
    successfulRecords: RecordDTO[],
    startTime: Date,
    endTime: Date
  ): ImportResultDTO {
    return {
      success: true,
      totalProcessed: successfulRecords.length,
      successCount: successfulRecords.length,
      errorCount: 0,
      importedAt: endTime.toISOString(),
      duration: endTime.getTime() - startTime.getTime(),
      summary: {
        recordsCreated: successfulRecords.length,
        recordsUpdated: 0,
        recordsSkipped: 0,
        recordsFailed: 0,
      },
      successfulRecords,
    };
  }

  static createFailure(
    errors: ValidationResultDTO[],
    startTime: Date,
    endTime: Date
  ): ImportResultDTO {
    return {
      success: false,
      totalProcessed: errors.length,
      successCount: 0,
      errorCount: errors.length,
      importedAt: endTime.toISOString(),
      duration: endTime.getTime() - startTime.getTime(),
      summary: {
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        recordsFailed: errors.length,
      },
      errors,
    };
  }

  static createPartial(
    successfulRecords: RecordDTO[],
    errors: ValidationResultDTO[],
    startTime: Date,
    endTime: Date
  ): ImportResultDTO {
    const totalProcessed = successfulRecords.length + errors.length;

    return {
      success: errors.length === 0,
      totalProcessed,
      successCount: successfulRecords.length,
      errorCount: errors.length,
      importedAt: endTime.toISOString(),
      duration: endTime.getTime() - startTime.getTime(),
      summary: {
        recordsCreated: successfulRecords.length,
        recordsUpdated: 0,
        recordsSkipped: 0,
        recordsFailed: errors.length,
      },
      successfulRecords:
        successfulRecords.length > 0 ? successfulRecords : undefined,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  static createWithSource(
    successfulRecords: RecordDTO[],
    errors: ValidationResultDTO[],
    startTime: Date,
    endTime: Date,
    source: ImportSource
  ): ImportResultDTO {
    const baseResult = this.createPartial(
      successfulRecords,
      errors,
      startTime,
      endTime
    );

    return {
      ...baseResult,
      source,
    };
  }

  static createWithWarnings(
    successfulRecords: RecordDTO[],
    errors: ValidationResultDTO[],
    warnings: ImportWarning[],
    startTime: Date,
    endTime: Date
  ): ImportResultDTO {
    const baseResult = this.createPartial(
      successfulRecords,
      errors,
      startTime,
      endTime
    );

    return {
      ...baseResult,
      warnings,
    };
  }

  static createWithId(
    successfulRecords: RecordDTO[],
    errors: ValidationResultDTO[],
    startTime: Date,
    endTime: Date
  ): ImportResultDTO {
    const baseResult = this.createPartial(
      successfulRecords,
      errors,
      startTime,
      endTime
    );

    return {
      ...baseResult,
      importId: this.generateImportId(),
    };
  }

  static createWithOperationStats(
    successfulRecords: RecordDTO[],
    errors: ValidationResultDTO[],
    startTime: Date,
    endTime: Date,
    operationStats: {
      created: number;
      updated: number;
      skipped: number;
    }
  ): ImportResultDTO {
    const baseResult = this.createPartial(
      successfulRecords,
      errors,
      startTime,
      endTime
    );

    return {
      ...baseResult,
      summary: {
        recordsCreated: operationStats.created,
        recordsUpdated: operationStats.updated,
        recordsSkipped: operationStats.skipped,
        recordsFailed: errors.length,
      },
    };
  }

  private static generateImportId(): string {
    return `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
