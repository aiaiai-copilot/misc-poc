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

// Export/Import format types and schemas
export type {
  ExportRecordV1,
  ExportFormatV1,
  ExportRecordV2,
  NormalizationRules,
  ExportMetadataV2,
  ExportFormatV2,
  ExportFormat,
  ImportResult,
} from './export-format';

export {
  ExportFormatSchema,
  ExportFormatV1Schema,
  ExportFormatV2Schema,
  ExportRecordV1Schema,
  ExportRecordV2Schema,
  NormalizationRulesSchema,
  ExportMetadataV2Schema,
  ImportResultSchema,
  type ExportRecordV1Input,
  type ExportRecordV2Input,
  type ExportFormatV1Input,
  type ExportFormatV2Input,
  type ExportFormatInput,
  type ImportResultInput,
} from './export-format-schema';
