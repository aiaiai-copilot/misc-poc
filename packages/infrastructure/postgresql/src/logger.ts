import pino from 'pino';

/**
 * Repository Logger Module
 *
 * Provides structured logging for PostgreSQL repository operations
 * with contextual metadata, error tracking, and performance monitoring.
 *
 * Key Features:
 * - Structured JSON logging (production)
 * - Pretty printing (development)
 * - Sensitive data masking
 * - Operation timing
 * - Error context enrichment
 */

// Determine log level from environment
const logLevel = process.env.LOG_LEVEL || 'info';
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// Create base logger with appropriate configuration
export const logger = pino({
  level: isTest ? 'silent' : logLevel,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
    bindings: (bindings) => {
      return {
        pid: bindings.pid,
        host: bindings.hostname,
      };
    },
  },
  // Pretty print in development, JSON in production
  transport:
    !isProduction && !isTest
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  // Add timestamp
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
});

/**
 * Create a child logger for a specific repository
 */
export function createRepositoryLogger(repositoryName: string): pino.Logger {
  return logger.child({ repository: repositoryName });
}

/**
 * Mask sensitive data in logs for privacy
 * Examples:
 * - test@example.com -> t***@example.com
 * - google-id-12345 -> goo***345
 */
export function maskSensitiveData(value: string, type: 'email' | 'id'): string {
  if (!value) {
    return value;
  }

  if (type === 'email') {
    const [local, domain] = value.split('@');
    if (!local || !domain) return value;

    const maskedLocal =
      local.length <= 3
        ? local[0] + '***'
        : local[0] + '***' + local[local.length - 1];

    return `${maskedLocal}@${domain}`;
  }

  if (type === 'id') {
    if (value.length <= 6) return '***';
    const start = value.substring(0, 3);
    const end = value.substring(value.length - 3);
    return `${start}***${end}`;
  }

  return value;
}

/**
 * Log a repository operation with timing
 */
export interface OperationLog {
  operation: string;
  repository: string;
  durationMs?: number;
  userId?: string;
  email?: string;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  context?: Record<string, unknown>;
}

export function logOperation(logger: pino.Logger, log: OperationLog): void {
  const logData: Record<string, unknown> = {
    operation: log.operation,
    repository: log.repository,
    success: log.success,
  };

  // Add timing if available
  if (log.durationMs !== undefined) {
    logData.duration_ms = Math.round(log.durationMs);
  }

  // Add user context (masked)
  if (log.userId) {
    logData.user_id = maskSensitiveData(log.userId, 'id');
  }

  if (log.email) {
    logData.email = maskSensitiveData(log.email, 'email');
  }

  // Add error details if failed
  if (!log.success) {
    logData.error_code = log.errorCode;
    logData.error_message = log.errorMessage;
  }

  // Add additional context
  if (log.context) {
    Object.assign(logData, log.context);
  }

  // Log at appropriate level
  if (log.success) {
    logger.info(logData, `${log.operation} completed successfully`);
  } else {
    logger.error(logData, `${log.operation} failed: ${log.errorMessage}`);
  }
}

/**
 * Start operation timer
 */
export function startTimer(): () => number {
  const start: number = performance.now();
  return (): number => performance.now() - start;
}

/**
 * Log error with full context
 */
interface ErrorWithCode extends Error {
  code?: string;
}

export function logError(
  logger: pino.Logger,
  error: Error,
  context?: Record<string, unknown>
): void {
  logger.error(
    {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as ErrorWithCode).code,
      },
      ...context,
    },
    error.message
  );
}

/**
 * Log debug information (only in debug mode)
 */
export function logDebug(
  logger: pino.Logger,
  message: string,
  data?: Record<string, unknown>
): void {
  logger.debug(data, message);
}
