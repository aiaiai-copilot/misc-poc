import { DomainError } from '@misc-poc/domain';

/**
 * Custom Error Types for PostgreSQL Repository
 *
 * These error types provide specific classification of database failures
 * to enable better error handling, logging, and retry logic.
 */

/**
 * Database Connection Error
 * Thrown when unable to establish or maintain database connection
 */
export class DatabaseConnectionError extends DomainError {
  constructor(
    message: string,
    public readonly originalError?: Error
  ) {
    super('DATABASE_CONNECTION_ERROR', message);
    this.name = 'DatabaseConnectionError';
  }
}

/**
 * Query Timeout Error
 * Thrown when a database query exceeds the configured timeout
 */
export class QueryTimeoutError extends DomainError {
  constructor(
    message: string,
    public readonly queryName?: string,
    public readonly timeoutMs?: number
  ) {
    super('QUERY_TIMEOUT_ERROR', message);
    this.name = 'QueryTimeoutError';
  }
}

/**
 * Unique Constraint Violation Error
 * Thrown when attempting to insert/update with duplicate unique values
 */
export class UniqueConstraintError extends DomainError {
  constructor(
    message: string,
    public readonly constraintName?: string,
    public readonly conflictingValue?: string
  ) {
    super('UNIQUE_CONSTRAINT_VIOLATION', message);
    this.name = 'UniqueConstraintError';
  }
}

/**
 * Transaction Serialization Error
 * Thrown when concurrent transactions conflict (PostgreSQL serialization failure)
 */
export class TransactionSerializationError extends DomainError {
  constructor(message: string) {
    super('TRANSACTION_SERIALIZATION_ERROR', message);
    this.name = 'TransactionSerializationError';
  }
}

/**
 * Deadlock Error
 * Thrown when a database deadlock is detected
 */
export class DeadlockError extends DomainError {
  constructor(message: string) {
    super('DEADLOCK_ERROR', message);
    this.name = 'DeadlockError';
  }
}

/**
 * Helper function to classify PostgreSQL errors
 * Maps database error codes to custom error types
 */
interface PostgresError extends Error {
  code?: string;
}

export function classifyPostgresError(error: Error): DomainError {
  const errorMessage = error.message.toLowerCase();
  const postgresError = error as PostgresError; // PostgreSQL errors have additional properties

  // Connection errors
  if (
    errorMessage.includes('connect') ||
    errorMessage.includes('econnrefused') ||
    errorMessage.includes('enotfound') ||
    errorMessage.includes('etimedout') ||
    errorMessage.includes('connection') ||
    postgresError.code === 'ECONNREFUSED' ||
    postgresError.code === 'ENOTFOUND' ||
    postgresError.code === 'ETIMEDOUT'
  ) {
    return new DatabaseConnectionError(
      `Database connection failed: ${error.message}`,
      error
    );
  }

  // Query timeout (PostgreSQL error code 57014)
  if (
    postgresError.code === '57014' ||
    errorMessage.includes('query timeout') ||
    errorMessage.includes('statement timeout')
  ) {
    return new QueryTimeoutError(`Query timeout: ${error.message}`);
  }

  // Unique constraint violation (PostgreSQL error code 23505)
  if (
    postgresError.code === '23505' ||
    errorMessage.includes('duplicate key') ||
    errorMessage.includes('unique constraint')
  ) {
    // Extract constraint name from error message
    const constraintMatch = error.message.match(/constraint "([^"]+)"/);
    const constraintName = constraintMatch ? constraintMatch[1] : undefined;

    // Determine specific constraint type
    if (errorMessage.includes('email') || constraintName?.includes('email')) {
      return new DomainError(
        'DUPLICATE_EMAIL',
        'A user with this email already exists'
      );
    }

    if (
      errorMessage.includes('google_id') ||
      constraintName?.includes('google_id')
    ) {
      return new DomainError(
        'DUPLICATE_GOOGLE_ID',
        'A user with this Google ID already exists'
      );
    }

    return new UniqueConstraintError(
      `Unique constraint violation: ${error.message}`,
      constraintName
    );
  }

  // Serialization failure (PostgreSQL error code 40001)
  if (postgresError.code === '40001') {
    return new TransactionSerializationError(
      `Transaction serialization failure: ${error.message}`
    );
  }

  // Deadlock detected (PostgreSQL error code 40P01)
  if (postgresError.code === '40P01') {
    return new DeadlockError(`Deadlock detected: ${error.message}`);
  }

  // Generic database error
  return new DomainError('DATABASE_ERROR', error.message);
}

/**
 * Determines if an error is transient and should be retried
 */
export function isTransientError(error: DomainError): boolean {
  // These errors are typically transient and can be retried
  const transientErrorCodes = [
    'DATABASE_CONNECTION_ERROR',
    'TRANSACTION_SERIALIZATION_ERROR',
    'DEADLOCK_ERROR',
    'QUERY_TIMEOUT_ERROR',
  ];

  return transientErrorCodes.includes(error.code);
}

/**
 * Determines if an error is a constraint violation (should NOT be retried)
 */
export function isConstraintViolation(error: DomainError): boolean {
  const constraintErrorCodes = [
    'DUPLICATE_EMAIL',
    'DUPLICATE_GOOGLE_ID',
    'UNIQUE_CONSTRAINT_VIOLATION',
  ];

  return constraintErrorCodes.includes(error.code);
}
