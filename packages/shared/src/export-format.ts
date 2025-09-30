/**
 * Export/Import Data Format Types
 *
 * Defines the structure for exporting and importing user data
 * across different versions of the application.
 */

/**
 * Record in v1.0 format (localStorage-based prototype)
 */
export interface ExportRecordV1 {
  /** Record content as space-separated tags */
  content: string;
  /** Creation timestamp (ISO-8601) */
  createdAt: string;
}

/**
 * Export format for v1.0 (localStorage prototype)
 */
export interface ExportFormatV1 {
  /** Format version identifier */
  version: '1.0';
  /** Array of records */
  records: ExportRecordV1[];
  /** Export metadata */
  metadata?: {
    /** Export timestamp (ISO-8601) */
    exportedAt?: string;
    /** Total number of records */
    recordCount?: number;
  };
}

/**
 * Record in v2.0 format (PostgreSQL-based MVP)
 */
export interface ExportRecordV2 {
  /** Record content as space-separated tags */
  content: string;
  /** Creation timestamp (ISO-8601) */
  createdAt: string;
  /** Last update timestamp (ISO-8601) */
  updatedAt: string;
}

/**
 * Normalization rules for v2.0 format
 */
export interface NormalizationRules {
  /** Whether tag matching is case-sensitive */
  caseSensitive: boolean;
  /** Whether to remove accents from tags */
  removeAccents: boolean;
}

/**
 * Export metadata for v2.0 format
 */
export interface ExportMetadataV2 {
  /** Export timestamp (ISO-8601) */
  exportedAt: string;
  /** Total number of records */
  recordCount: number;
  /** Normalization settings used */
  normalizationRules: NormalizationRules;
}

/**
 * Export format for v2.0 (PostgreSQL MVP)
 */
export interface ExportFormatV2 {
  /** Format version identifier */
  version: '2.0';
  /** Array of records */
  records: ExportRecordV2[];
  /** Export metadata (required in v2.0) */
  metadata: ExportMetadataV2;
}

/**
 * Union type for all supported export formats
 */
export type ExportFormat = ExportFormatV1 | ExportFormatV2;

/**
 * Import result statistics
 */
export interface ImportResult {
  /** Number of successfully imported records */
  imported: number;
  /** Number of skipped records (duplicates) */
  skipped: number;
  /** Error messages for failed records */
  errors: string[];
}
