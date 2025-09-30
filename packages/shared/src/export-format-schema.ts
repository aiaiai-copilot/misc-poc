/**
 * Zod validation schemas for Export/Import data formats
 *
 * These schemas validate the structure and content of import/export data
 * according to the PRD specifications (section 4.2.3).
 */

import { z } from 'zod';

/**
 * ISO-8601 timestamp validation
 * Accepts timestamps with or without timezone offsets
 */
const iso8601DateString = z.string().datetime({
  offset: true, // Allow timezone offsets like +03:00
  message: 'Must be a valid ISO-8601 timestamp',
});

/**
 * Record content validation
 * - Must be non-empty string
 * - Will be split into tags by spaces
 */
const recordContent = z
  .string()
  .min(1, 'Record content cannot be empty')
  .max(5000, 'Record content is too long');

/**
 * V1.0 record schema (localStorage format)
 */
export const ExportRecordV1Schema = z.object({
  content: recordContent,
  createdAt: iso8601DateString,
});

/**
 * V1.0 export format schema
 */
export const ExportFormatV1Schema = z.object({
  version: z.literal('1.0'),
  records: z.array(ExportRecordV1Schema),
  metadata: z
    .object({
      exportedAt: iso8601DateString.optional(),
      recordCount: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

/**
 * V2.0 record schema (PostgreSQL format)
 */
export const ExportRecordV2Schema = z.object({
  content: recordContent,
  createdAt: iso8601DateString,
  updatedAt: iso8601DateString,
});

/**
 * Normalization rules schema
 */
export const NormalizationRulesSchema = z.object({
  caseSensitive: z.boolean(),
  removeAccents: z.boolean(),
});

/**
 * V2.0 metadata schema
 */
export const ExportMetadataV2Schema = z.object({
  exportedAt: iso8601DateString,
  recordCount: z.number().int().nonnegative(),
  normalizationRules: NormalizationRulesSchema,
});

/**
 * V2.0 export format schema
 */
export const ExportFormatV2Schema = z.object({
  version: z.literal('2.0'),
  records: z.array(ExportRecordV2Schema),
  metadata: ExportMetadataV2Schema,
});

/**
 * Union schema for all supported export formats
 *
 * This discriminated union allows parsing any supported version
 * and provides type-safe access to version-specific fields.
 */
export const ExportFormatSchema = z.discriminatedUnion('version', [
  ExportFormatV1Schema,
  ExportFormatV2Schema,
]);

/**
 * Import result schema
 */
export const ImportResultSchema = z.object({
  imported: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  errors: z.array(z.string()),
});

/**
 * Type inference helpers
 */
export type ExportRecordV1Input = z.input<typeof ExportRecordV1Schema>;
export type ExportRecordV2Input = z.input<typeof ExportRecordV2Schema>;
export type ExportFormatV1Input = z.input<typeof ExportFormatV1Schema>;
export type ExportFormatV2Input = z.input<typeof ExportFormatV2Schema>;
export type ExportFormatInput = z.input<typeof ExportFormatSchema>;
export type ImportResultInput = z.input<typeof ImportResultSchema>;
