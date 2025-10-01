/**
 * User-Friendly Error Messages
 * Task 12.7: Generate clear, actionable error messages
 */

import { ErrorLogEntry, ErrorSeverity } from '../types/error-recovery.js';

export class ErrorMessageBuilder {
  /**
   * Build user-friendly error message for duplicate record
   */
  static buildDuplicateMessage(
    content: string,
    recordIndex: number
  ): ErrorLogEntry {
    return {
      recordIndex,
      recordContent: content,
      errorCode: 'DUPLICATE_RECORD',
      errorMessage: `Record '${this.truncateContent(content)}' already exists (line ${recordIndex + 1})`,
      timestamp: new Date().toISOString(),
      severity: 'warning',
      suggestion: {
        type: 'duplicate_update',
        message:
          'This record already exists in the database. You can update the existing record using the update endpoint.',
        action: 'Remove from import or use PUT /api/records/{id}',
      },
    };
  }

  /**
   * Build user-friendly error message for invalid date
   */
  static buildInvalidDateMessage(
    dateString: string,
    recordIndex: number,
    content?: string
  ): ErrorLogEntry {
    return {
      recordIndex,
      recordContent: content,
      errorCode: 'INVALID_DATE_FORMAT',
      errorMessage: `Invalid date '${dateString}' in record at line ${recordIndex + 1}`,
      timestamp: new Date().toISOString(),
      severity: 'error',
      suggestion: {
        type: 'date_format',
        message: 'Date must be in ISO 8601 format',
        example: '2024-01-15T10:30:00.000Z',
        action: 'Convert date to YYYY-MM-DDTHH:mm:ss.sssZ format',
      },
    };
  }

  /**
   * Build user-friendly error message for empty content
   */
  static buildEmptyContentMessage(recordIndex: number): ErrorLogEntry {
    return {
      recordIndex,
      errorCode: 'EMPTY_CONTENT',
      errorMessage: `Record at line ${recordIndex + 1} has no content`,
      timestamp: new Date().toISOString(),
      severity: 'error',
      suggestion: {
        type: 'remove_empty',
        message: 'Records must contain at least one word',
        action: `Remove empty record at line ${recordIndex + 1}`,
      },
    };
  }

  /**
   * Build user-friendly error message for malformed JSON
   */
  static buildMalformedJsonMessage(
    position: number,
    details: string
  ): ErrorLogEntry {
    return {
      recordIndex: -1,
      errorCode: 'MALFORMED_JSON',
      errorMessage: `JSON parsing failed at position ${position}: ${details}`,
      timestamp: new Date().toISOString(),
      severity: 'error',
      suggestion: {
        type: 'contact_support',
        message: 'The import file contains invalid JSON syntax',
        action: 'Validate JSON format using a JSON validator tool',
        example: '{"version":"2.0","records":[...]}',
      },
    };
  }

  /**
   * Build user-friendly error message for size limit
   */
  static buildSizeLimitMessage(
    actualCount: number,
    maxCount: number
  ): ErrorLogEntry {
    return {
      recordIndex: -1,
      errorCode: 'TOO_MANY_RECORDS',
      errorMessage: `Import exceeds limit: ${actualCount.toLocaleString()} records (max: ${maxCount.toLocaleString()})`,
      timestamp: new Date().toISOString(),
      severity: 'error',
      suggestion: {
        type: 'split_batch',
        message: 'The import file is too large',
        action: `Split into ${Math.ceil(actualCount / maxCount)} files of max ${maxCount.toLocaleString()} records each`,
      },
    };
  }

  /**
   * Build user-friendly error message for database connection
   */
  static buildDatabaseErrorMessage(
    originalError: string,
    recordIndex: number = -1
  ): ErrorLogEntry {
    const isConnectionError =
      originalError.toLowerCase().includes('connection') ||
      originalError.toLowerCase().includes('timeout');

    return {
      recordIndex,
      errorCode: isConnectionError ? 'CONNECTION_ERROR' : 'DATABASE_ERROR',
      errorMessage: isConnectionError
        ? 'Database temporarily unavailable, please retry'
        : `Database error: ${this.sanitizeErrorMessage(originalError)}`,
      timestamp: new Date().toISOString(),
      severity: 'error',
      suggestion: {
        type: 'retry',
        message: isConnectionError
          ? 'The database connection was temporarily lost'
          : 'An unexpected database error occurred',
        action: isConnectionError
          ? 'Wait a few moments and retry using the resume feature'
          : 'Contact support if this error persists',
      },
    };
  }

  /**
   * Build user-friendly error message for constraint violation
   */
  static buildConstraintViolationMessage(
    constraintName: string,
    recordIndex: number,
    content?: string
  ): ErrorLogEntry {
    const friendlyMessage = this.interpretConstraintViolation(constraintName);

    return {
      recordIndex,
      recordContent: content,
      errorCode: 'CONSTRAINT_VIOLATION',
      errorMessage: `${friendlyMessage} (line ${recordIndex + 1})`,
      timestamp: new Date().toISOString(),
      severity: 'error',
      suggestion: {
        type: 'duplicate_update',
        message: 'Database constraint prevents this operation',
        action: 'Verify data integrity and remove conflicting records',
      },
    };
  }

  /**
   * Build user-friendly error message for special characters
   */
  static buildInvalidCharactersMessage(
    recordIndex: number,
    content: string
  ): ErrorLogEntry {
    return {
      recordIndex,
      recordContent: content,
      errorCode: 'INVALID_CHARACTERS',
      errorMessage: `Special characters detected in record at line ${recordIndex + 1}`,
      timestamp: new Date().toISOString(),
      severity: 'warning',
      suggestion: {
        type: 'normalize_content',
        message: 'Content contains characters that may cause issues',
        action: 'Remove or escape special characters',
      },
    };
  }

  /**
   * Build generic error message with context
   */
  static buildGenericError(
    errorCode: string,
    message: string,
    recordIndex: number = -1,
    content?: string,
    severity: ErrorSeverity = 'error'
  ): ErrorLogEntry {
    return {
      recordIndex,
      recordContent: content,
      errorCode,
      errorMessage: message,
      timestamp: new Date().toISOString(),
      severity,
    };
  }

  // Private helper methods

  private static truncateContent(
    content: string,
    maxLength: number = 50
  ): string {
    if (content.length <= maxLength) return content;
    return `${content.substring(0, maxLength)}...`;
  }

  private static sanitizeErrorMessage(error: string): string {
    // Remove sensitive information like connection strings, passwords
    return error
      .replace(/password=[^;]*/gi, 'password=***')
      .replace(/pwd=[^;]*/gi, 'pwd=***')
      .substring(0, 200);
  }

  private static interpretConstraintViolation(constraintName: string): string {
    const constraintMap: Record<string, string> = {
      unique: 'Duplicate record found',
      'foreign key': 'Referenced record does not exist',
      'not null': 'Required field is missing',
      check: 'Data validation failed',
    };

    for (const [key, message] of Object.entries(constraintMap)) {
      if (constraintName.toLowerCase().includes(key)) {
        return message;
      }
    }

    return 'Database constraint violation';
  }
}
