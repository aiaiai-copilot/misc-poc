import { RecordDTO } from './record-dto';

export interface ExportSchema {
  readonly version: string;
  readonly fields: Array<{
    readonly name: string;
    readonly type: string;
    readonly required: boolean;
  }>;
}

export interface ExportDTO {
  readonly records: RecordDTO[];
  readonly format: 'json' | 'csv' | 'xml' | 'yaml';
  readonly exportedAt: string;
  readonly version: string;
  readonly metadata: {
    readonly totalRecords: number;
    readonly exportSource: string;
    readonly searchQuery?: string;
    readonly filters?: {
      readonly tagIds?: string[];
      readonly dateRange?: {
        readonly from: string;
        readonly to: string;
      };
    };
    readonly exportedBy?: string;
    readonly compressed?: boolean;
    readonly fileSize?: number;
    readonly [key: string]: unknown;
  };
  readonly schema?: ExportSchema;
}

export class ExportDTOMapper {
  static create(
    records: RecordDTO[],
    format: 'json' | 'csv' | 'xml' | 'yaml'
  ): ExportDTO {
    return {
      records,
      format,
      exportedAt: new Date().toISOString(),
      version: '1.0',
      metadata: {
        totalRecords: records.length,
        exportSource: records.length === 0 ? 'empty-export' : 'full-database',
      },
    };
  }

  static createWithSearch(
    records: RecordDTO[],
    format: 'json' | 'csv' | 'xml' | 'yaml',
    searchQuery?: string,
    filters?: {
      tagIds?: string[];
      dateRange?: {
        from: Date;
        to: Date;
      };
    }
  ): ExportDTO {
    return {
      records,
      format,
      exportedAt: new Date().toISOString(),
      version: '1.0',
      metadata: {
        totalRecords: records.length,
        exportSource: 'search-results',
        searchQuery,
        filters: filters
          ? {
              tagIds: filters.tagIds,
              dateRange: filters.dateRange
                ? {
                    from: filters.dateRange.from.toISOString(),
                    to: filters.dateRange.to.toISOString(),
                  }
                : undefined,
            }
          : undefined,
      },
    };
  }

  static createWithMetadata(
    records: RecordDTO[],
    format: 'json' | 'csv' | 'xml' | 'yaml',
    customMetadata: {
      exportedBy?: string;
      compressed?: boolean;
      fileSize?: number;
      [key: string]: unknown;
    }
  ): ExportDTO {
    const baseExport = this.create(records, format);
    const estimatedFileSize =
      customMetadata.fileSize ||
      this.estimateFileSize(records, format, customMetadata.compressed);

    return {
      ...baseExport,
      metadata: {
        ...baseExport.metadata,
        ...customMetadata,
        fileSize: estimatedFileSize,
      },
    };
  }

  static createWithSchema(
    records: RecordDTO[],
    format: 'json' | 'csv' | 'xml' | 'yaml'
  ): ExportDTO {
    const baseExport = this.create(records, format);

    return {
      ...baseExport,
      schema: {
        version: '1.0',
        fields: [
          { name: 'id', type: 'string', required: true },
          { name: 'content', type: 'string', required: true },
          { name: 'tagIds', type: 'array', required: true },
          { name: 'createdAt', type: 'datetime', required: true },
          { name: 'updatedAt', type: 'datetime', required: true },
        ],
      },
    };
  }

  private static estimateFileSize(
    records: RecordDTO[],
    format: 'json' | 'csv' | 'xml' | 'yaml',
    compressed?: boolean
  ): number {
    if (records.length === 0) return 0;

    const sampleRecord = records[0];
    const estimatedRecordSize = JSON.stringify(sampleRecord).length;
    let totalSize = estimatedRecordSize * records.length;

    // Add format-specific overhead
    switch (format) {
      case 'json':
        totalSize += 50; // JSON array brackets and metadata
        break;
      case 'csv':
        totalSize *= 0.8; // CSV is more compact
        break;
      case 'xml':
        totalSize *= 1.5; // XML has more overhead
        break;
      case 'yaml':
        totalSize *= 0.9; // YAML is slightly more compact than JSON
        break;
    }

    if (compressed) {
      totalSize *= 0.3; // Assume 70% compression ratio
    }

    return Math.round(totalSize);
  }
}
