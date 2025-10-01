import { Result, Err } from '@misc-poc/shared';
import { DomainError } from '@misc-poc/domain';
import { isTransientError } from './errors';
import { logDebug } from './logger';
import type pino from 'pino';

/**
 * Retry Logic for Transient Database Failures
 *
 * Implements exponential backoff retry strategy for transient errors
 * such as connection timeouts, serialization failures, and deadlocks.
 *
 * Non-transient errors (e.g., constraint violations) are NOT retried.
 */

export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts: number;

  /** Initial delay in milliseconds (default: 100) */
  initialDelayMs: number;

  /** Maximum delay in milliseconds (default: 5000) */
  maxDelayMs: number;

  /** Backoff multiplier (default: 2 for exponential backoff) */
  backoffMultiplier: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
};

/**
 * Calculate delay for retry attempt with exponential backoff
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay =
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute operation with retry logic for transient failures
 *
 * @param operation - The operation to execute
 * @param logger - Logger instance for logging retry attempts
 * @param config - Retry configuration (optional, uses defaults if not provided)
 * @returns Result of the operation
 */
export async function withRetry<T>(
  operation: () => Promise<Result<T, DomainError>>,
  logger: pino.Logger,
  config: Partial<RetryConfig> = {}
): Promise<Result<T, DomainError>> {
  const retryConfig: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  let lastError: DomainError | null = null;
  let attempt = 0;

  while (attempt < retryConfig.maxAttempts) {
    attempt++;

    try {
      const result = await operation();

      // Operation succeeded
      if (result.isOk()) {
        if (attempt > 1) {
          logDebug(logger, 'Operation succeeded after retry', {
            attempt,
            total_attempts: retryConfig.maxAttempts,
          });
        }
        return result;
      }

      // Operation failed - check if error is transient
      if (result.isErr()) {
        const error = result.unwrapErr();
        lastError = error;

        // If error is not transient, fail immediately without retrying
        if (!isTransientError(error)) {
          logDebug(logger, 'Non-transient error, not retrying', {
            error_code: error.code,
            error_message: error.message,
          });
          return result;
        }

        // If we've exhausted all attempts, fail
        if (attempt >= retryConfig.maxAttempts) {
          logger.warn(
            {
              attempt,
              max_attempts: retryConfig.maxAttempts,
              error_code: error.code,
              error_message: error.message,
            },
            'Max retry attempts exhausted'
          );
          return result;
        }

        // Calculate delay and retry
        const delayMs = calculateDelay(attempt, retryConfig);

        logger.info(
          {
            attempt,
            max_attempts: retryConfig.maxAttempts,
            error_code: error.code,
            retry_delay_ms: delayMs,
          },
          `Retrying operation after transient failure (attempt ${attempt}/${retryConfig.maxAttempts})`
        );

        await sleep(delayMs);
      }
    } catch (error) {
      // Unexpected error (not a Result type)
      logger.error(
        {
          attempt,
          error: error instanceof Error ? error.message : String(error),
        },
        'Unexpected error during retry operation'
      );

      // Convert to DomainError and return
      const domainError = new DomainError(
        'UNEXPECTED_ERROR',
        error instanceof Error ? error.message : 'Unknown error'
      );
      return Err(domainError);
    }
  }

  // This should not be reached, but TypeScript needs it
  return Err(
    lastError ||
      new DomainError('RETRY_FAILED', 'Retry logic failed unexpectedly')
  );
}

/**
 * Retry configuration builder for fluent API
 *
 * Example:
 * ```ts
 * const config = new RetryConfigBuilder()
 *   .maxAttempts(5)
 *   .initialDelay(200)
 *   .maxDelay(10000)
 *   .build();
 * ```
 */
export class RetryConfigBuilder {
  private config: Partial<RetryConfig> = {};

  maxAttempts(attempts: number): this {
    this.config.maxAttempts = attempts;
    return this;
  }

  initialDelay(delayMs: number): this {
    this.config.initialDelayMs = delayMs;
    return this;
  }

  maxDelay(delayMs: number): this {
    this.config.maxDelayMs = delayMs;
    return this;
  }

  backoffMultiplier(multiplier: number): this {
    this.config.backoffMultiplier = multiplier;
    return this;
  }

  build(): Partial<RetryConfig> {
    return { ...this.config };
  }
}
