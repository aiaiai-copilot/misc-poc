// Result type for error handling
export { Result, Ok, Err } from './result';

// UUID utilities
export { generateUuid, validateUuid, isValidUuid, parseUuid } from './uuid-utils';

// Value objects
export { RecordId } from './record-id';
export { TagId } from './tag-id';

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
  type DateFormat
} from './date-utils';

// String utilities
export {
  normalizeString,
  slugify,
  truncate,
  sanitizeInput,
  isEmptyOrWhitespace
} from './string-utils';

// Validation constants and rules
export { ValidationConstants, ValidationRules } from './validation-constants';

// Configuration
export { DefaultConfig, createConfig, type AppConfig } from './config';