/**
 * Export/Import Data Format Schemas
 * Task 12.1: Design Import/Export Data Format Schemas
 *
 * Defines Zod validation schemas for v1.0 (localStorage) and v2.0 (PostgreSQL) export formats.
 * Supports discriminated union for version-specific parsing.
 * Includes field validation, type checking, and version compatibility rules.
 *
 * Based on PRD section 4.2.3
 */

import { z } from 'zod';

// Constants for validation
const MAX_CONTENT_LENGTH = 10000;

/**
 * V1.0 Record Schema (localStorage format)
 * Contains: content and createdAt timestamp
 */
export const ExportRecordV1Schema = z.object({
  content: z
    .string()
    .min(1, 'Content cannot be empty')
    .max(
      MAX_CONTENT_LENGTH,
      `Content cannot exceed ${MAX_CONTENT_LENGTH} characters`
    ),
  createdAt: z
    .string()
    .datetime({ offset: true, message: 'Invalid ISO 8601 timestamp' }),
});

export type ExportRecordV1 = z.infer<typeof ExportRecordV1Schema>;

/**
 * V1.0 Metadata Schema (optional)
 * Contains: export timestamp and record count
 */
export const ExportMetadataV1Schema = z
  .object({
    exportedAt: z
      .string()
      .datetime({ offset: true, message: 'Invalid ISO 8601 timestamp' })
      .optional(),
    recordCount: z.number().int().nonnegative().optional(),
  })
  .optional();

export type ExportMetadataV1 = z.infer<typeof ExportMetadataV1Schema>;

/**
 * V1.0 Export Format Schema
 * Complete localStorage export format with version discriminator
 */
export const ExportFormatV1Schema = z.object({
  version: z.literal('1.0'),
  records: z.array(ExportRecordV1Schema),
  metadata: ExportMetadataV1Schema,
});

export type ExportFormatV1 = z.infer<typeof ExportFormatV1Schema>;

/**
 * V2.0 Record Schema (PostgreSQL format)
 * Contains: content, createdAt, and updatedAt timestamps
 */
export const ExportRecordV2Schema = z.object({
  content: z
    .string()
    .min(1, 'Content cannot be empty')
    .max(
      MAX_CONTENT_LENGTH,
      `Content cannot exceed ${MAX_CONTENT_LENGTH} characters`
    ),
  createdAt: z
    .string()
    .datetime({ offset: true, message: 'Invalid ISO 8601 timestamp' }),
  updatedAt: z
    .string()
    .datetime({ offset: true, message: 'Invalid ISO 8601 timestamp' }),
});

export type ExportRecordV2 = z.infer<typeof ExportRecordV2Schema>;

/**
 * Normalization Rules Schema
 * Defines tag normalization settings
 */
export const NormalizationRulesSchema = z.object({
  caseSensitive: z.boolean(),
  removeAccents: z.boolean(),
});

export type NormalizationRules = z.infer<typeof NormalizationRulesSchema>;

/**
 * V2.0 Metadata Schema (required)
 * Contains: export timestamp, record count, and normalization rules
 */
export const ExportMetadataV2Schema = z.object({
  exportedAt: z
    .string()
    .datetime({ offset: true, message: 'Invalid ISO 8601 timestamp' }),
  recordCount: z
    .number()
    .int()
    .nonnegative('Record count must be non-negative'),
  normalizationRules: NormalizationRulesSchema,
});

export type ExportMetadataV2 = z.infer<typeof ExportMetadataV2Schema>;

/**
 * V2.0 Export Format Schema
 * Complete PostgreSQL export format with version discriminator
 */
export const ExportFormatV2Schema = z.object({
  version: z.literal('2.0'),
  records: z.array(ExportRecordV2Schema),
  metadata: ExportMetadataV2Schema,
});

export type ExportFormatV2 = z.infer<typeof ExportFormatV2Schema>;

/**
 * Export Format Discriminated Union
 * Efficiently parses either v1.0 or v2.0 format based on version field
 *
 * Usage:
 * ```typescript
 * const result = ExportFormatSchema.safeParse(jsonData);
 * if (result.success) {
 *   if (result.data.version === '1.0') {
 *     // Handle v1.0 format
 *   } else {
 *     // Handle v2.0 format
 *   }
 * }
 * ```
 */
export const ExportFormatSchema = z.discriminatedUnion('version', [
  ExportFormatV1Schema,
  ExportFormatV2Schema,
]);

export type ExportFormat = z.infer<typeof ExportFormatSchema>;

/**
 * Import Result Schema
 * Tracks statistics from import operations
 */
export const ImportResultSchema = z.object({
  imported: z.number().int().nonnegative('Imported count must be non-negative'),
  skipped: z.number().int().nonnegative('Skipped count must be non-negative'),
  failed: z.number().int().nonnegative('Failed count must be non-negative'),
  errors: z.array(z.string()),
});

export type ImportResult = z.infer<typeof ImportResultSchema>;

/**
 * Validates and parses export data in any supported format
 * @param data - Raw JSON data to validate
 * @returns Parsed and validated export data or validation error
 */
export function validateExportFormat(
  data: unknown
):
  | { success: true; data: ExportFormat }
  | { success: false; error: z.ZodError } {
  return ExportFormatSchema.safeParse(data);
}

/**
 * Validates import result data
 * @param data - Raw import result data to validate
 * @returns Parsed and validated import result or validation error
 */
export function validateImportResult(
  data: unknown
):
  | { success: true; data: ImportResult }
  | { success: false; error: z.ZodError } {
  return ImportResultSchema.safeParse(data);
}
