// Result type for error handling
export { Result, Ok, Err } from './result';

// UUID utilities
export {
  generateUuid,
  validateUuid,
  isValidUuid,
  parseUuid,
} from './uuid-utils';

// Value objects
export { RecordId } from './record-id';
export { TagId } from './tag-id';
export { RecordContent } from './record-content';
export { SearchQuery } from './search-query';

// Date utilities
export {
  formatDate,
  parseDate,
  isValidDate,
  getCurrentTimestamp,
  addDays,
  subtractDays,
  daysBetween,
  type DateInput,
  type DateFormat,
} from './date-utils';

// String utilities
export {
  normalizeString,
  slugify,
  truncate,
  sanitizeInput,
  isEmptyOrWhitespace,
} from './string-utils';

// Validation constants and rules
export { ValidationConstants, ValidationRules } from './validation-constants';

// Configuration
export { DefaultConfig, createConfig, type AppConfig } from './config';

// Export/Import Schemas
export {
  ExportRecordV1Schema,
  ExportMetadataV1Schema,
  ExportFormatV1Schema,
  ExportRecordV2Schema,
  NormalizationRulesSchema,
  ExportMetadataV2Schema,
  ExportFormatV2Schema,
  ExportFormatSchema,
  ImportResultSchema,
  validateExportFormat,
  validateImportResult,
  type ExportRecordV1,
  type ExportMetadataV1,
  type ExportFormatV1,
  type ExportRecordV2,
  type NormalizationRules,
  type ExportMetadataV2,
  type ExportFormatV2,
  type ExportFormat,
  type ImportResult,
} from './export-format-schema';
