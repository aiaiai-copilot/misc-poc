import { Result, Ok, Err } from './result';

export const ValidationConstants = {
  MAX_STRING_LENGTH: 1000,
  MAX_TAG_LENGTH: 50,
  MIN_SEARCH_LENGTH: 2,
  MAX_TAGS_PER_RECORD: 20,
  
  // Patterns
  VALID_TAG_PATTERN: /^[a-z0-9-]+$/,
  EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  
  // Error messages
  ERRORS: {
    STRING_TOO_LONG: 'String exceeds maximum length',
    TAG_INVALID: 'Tag contains invalid characters',
    TAG_TOO_LONG: 'Tag exceeds maximum length',
    EMAIL_INVALID: 'Invalid email format',
    SEARCH_TOO_SHORT: 'Search term too short'
  }
} as const;

export const ValidationRules = {
  validateStringLength(input: string, maxLength: number = ValidationConstants.MAX_STRING_LENGTH): Result<string, string> {
    if (input.length > maxLength) {
      return Err(ValidationConstants.ERRORS.STRING_TOO_LONG);
    }
    return Ok(input);
  },

  validateTag(tag: string): Result<string, string> {
    if (tag.length > ValidationConstants.MAX_TAG_LENGTH) {
      return Err(ValidationConstants.ERRORS.TAG_TOO_LONG);
    }
    if (!ValidationConstants.VALID_TAG_PATTERN.test(tag)) {
      return Err(ValidationConstants.ERRORS.TAG_INVALID);
    }
    return Ok(tag);
  },

  validateEmail(email: string): Result<string, string> {
    if (!ValidationConstants.EMAIL_PATTERN.test(email)) {
      return Err(ValidationConstants.ERRORS.EMAIL_INVALID);
    }
    return Ok(email);
  },

  validateSearchTerm(term: string): Result<string, string> {
    if (term.length < ValidationConstants.MIN_SEARCH_LENGTH) {
      return Err(ValidationConstants.ERRORS.SEARCH_TOO_SHORT);
    }
    return Ok(term);
  }
};