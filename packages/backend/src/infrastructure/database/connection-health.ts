/**
 * Database Connection Health Module
 * Provides health checking and retry logic for database connections
 */

export interface HealthCheckOptions {
  host?: string;
  port?: number;
  user?: string;
  database?: string;
  password?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  exponentialBackoff?: boolean;
  maxBackoffDelay?: number;
}

export interface HealthCheckResult {
  isHealthy: boolean;
  responseTime: number;
  attempt: number;
  error?: Error;
  timestamp: Date;
  connectionInfo: {
    host: string;
    port: number;
    database: string;
    user: string;
  };
}

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  exponentialBackoff: boolean;
  jitter: boolean;
}

export class DatabaseHealthChecker {
  private defaultOptions: Required<HealthCheckOptions>;

  constructor(options: Partial<HealthCheckOptions> = {}) {
    this.defaultOptions = {
      host:
        process.env.DATABASE_HOST || process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(
        process.env.DATABASE_PORT || process.env.POSTGRES_PORT || '5432'
      ),
      user:
        process.env.DATABASE_USER || process.env.POSTGRES_USER || 'postgres',
      database:
        process.env.DATABASE_NAME || process.env.POSTGRES_DB || 'misc_poc_dev',
      password:
        process.env.DATABASE_PASSWORD || process.env.POSTGRES_PASSWORD || '',
      timeout: 5000,
      maxRetries: 5,
      retryDelay: 1000,
      exponentialBackoff: true,
      maxBackoffDelay: 30000,
      ...options,
    };
  }

  /**
   * Perform a single health check
   */
  async checkHealth(
    options?: Partial<HealthCheckOptions>
  ): Promise<HealthCheckResult> {
    const config = { ...this.defaultOptions, ...options };
    const startTime = Date.now();
    const timestamp = new Date();

    const connectionInfo = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
    };

    try {
      // Import pg dynamically to avoid issues if not installed
      const { Client } = await import('pg');

      const client = new Client({
        host: config.host,
        port: config.port,
        user: config.user,
        database: config.database,
        password: config.password,
        connectionTimeoutMillis: config.timeout,
        query_timeout: config.timeout,
      });

      await client.connect();

      // Perform a simple query to verify the connection is working
      await client.query('SELECT 1');

      await client.end();

      const responseTime = Date.now() - startTime;

      return {
        isHealthy: true,
        responseTime,
        attempt: 1,
        timestamp,
        connectionInfo,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        isHealthy: false,
        responseTime,
        attempt: 1,
        error: error as Error,
        timestamp,
        connectionInfo,
      };
    }
  }

  /**
   * Perform health check with retry logic
   */
  async checkHealthWithRetry(
    options?: Partial<HealthCheckOptions>
  ): Promise<HealthCheckResult> {
    const config = { ...this.defaultOptions, ...options };
    let lastResult: HealthCheckResult;
    let delay = config.retryDelay;

    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      lastResult = await this.checkHealth(config);
      lastResult.attempt = attempt;

      if (lastResult.isHealthy) {
        return lastResult;
      }

      // Don't wait after the last attempt
      if (attempt < config.maxRetries) {
        await this.sleep(delay);

        // Apply exponential backoff if enabled
        if (config.exponentialBackoff) {
          delay = Math.min(delay * 2, config.maxBackoffDelay);
        }
      }
    }

    return lastResult!;
  }

  /**
   * Wait for database to become healthy
   */
  async waitForHealthy(
    options?: Partial<HealthCheckOptions & { maxWaitTime?: number }>
  ): Promise<HealthCheckResult> {
    const config = { ...this.defaultOptions, maxWaitTime: 60000, ...options };
    const startTime = Date.now();

    while (Date.now() - startTime < config.maxWaitTime) {
      const result = await this.checkHealth(config);

      if (result.isHealthy) {
        return result;
      }

      await this.sleep(config.retryDelay);
    }

    // Final attempt after timeout
    const finalResult = await this.checkHealth(config);
    if (!finalResult.isHealthy) {
      finalResult.error = new Error(
        `Database health check timeout after ${config.maxWaitTime}ms`
      );
    }

    return finalResult;
  }

  /**
   * Create a retry wrapper for database operations
   */
  createRetryWrapper<T>(retryConfig: Partial<RetryConfig> = {}) {
    const config: RetryConfig = {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      exponentialBackoff: true,
      jitter: true,
      ...retryConfig,
    };

    return async (operation: () => Promise<T>): Promise<T> => {
      let lastError: Error;
      let delay = config.initialDelay;

      for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
        try {
          return await operation();
        } catch (error) {
          lastError = error as Error;

          // Don't retry on certain types of errors
          if (this.isNonRetryableError(error as Error)) {
            throw error;
          }

          // Don't wait after the last attempt
          if (attempt < config.maxRetries) {
            // Add jitter to prevent thundering herd
            const jitterMultiplier = config.jitter
              ? 0.5 + Math.random() * 0.5
              : 1;
            const actualDelay = delay * jitterMultiplier;

            await this.sleep(actualDelay);

            // Apply exponential backoff if enabled
            if (config.exponentialBackoff) {
              delay = Math.min(delay * 2, config.maxDelay);
            }
          }
        }
      }

      throw lastError!;
    };
  }

  /**
   * Monitor database health continuously
   */
  async *monitorHealth(
    options?: Partial<HealthCheckOptions & { interval?: number }>
  ): AsyncGenerator<HealthCheckResult, void, unknown> {
    const config = { ...this.defaultOptions, interval: 10000, ...options };

    while (true) {
      const result = await this.checkHealth(config);
      yield result;
      await this.sleep(config.interval!);
    }
  }

  /**
   * Get test database health checker
   */
  static createTestChecker(
    options: Partial<HealthCheckOptions> = {}
  ): DatabaseHealthChecker {
    const testOptions: Partial<HealthCheckOptions> = {
      host: process.env.TEST_DATABASE_HOST || 'localhost',
      port: parseInt(process.env.TEST_DATABASE_PORT || '5433'),
      user: process.env.TEST_DATABASE_USER || 'postgres_test',
      database: process.env.TEST_DATABASE_NAME || 'misc_poc_test',
      password: process.env.TEST_DATABASE_PASSWORD || 'test_password',
      ...options,
    };

    return new DatabaseHealthChecker(testOptions);
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isNonRetryableError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();

    // Don't retry on authentication errors
    if (errorMessage.includes('authentication failed')) {
      return true;
    }

    // Don't retry on database not found errors
    if (
      errorMessage.includes('database') &&
      errorMessage.includes('does not exist')
    ) {
      return true;
    }

    // Don't retry on permission errors
    if (errorMessage.includes('permission denied')) {
      return true;
    }

    return false;
  }
}

/**
 * Default health checker instance
 */
export const healthChecker = new DatabaseHealthChecker();

/**
 * Test database health checker instance
 */
export const testHealthChecker = DatabaseHealthChecker.createTestChecker();

/**
 * Utility function for quick health checks
 */
export async function isHealthy(
  options?: Partial<HealthCheckOptions>
): Promise<boolean> {
  const result = await healthChecker.checkHealth(options);
  return result.isHealthy;
}

/**
 * Utility function to wait for database
 */
export async function waitForDatabase(
  options?: Partial<HealthCheckOptions & { maxWaitTime?: number }>
): Promise<void> {
  const result = await healthChecker.waitForHealthy(options);
  if (!result.isHealthy) {
    throw result.error || new Error('Database health check failed');
  }
}

/**
 * Create a database operation with automatic retry
 */
export function withRetry<T>(
  operation: () => Promise<T>,
  retryConfig?: Partial<RetryConfig>
): Promise<T> {
  const retryWrapper = healthChecker.createRetryWrapper<T>(retryConfig);
  return retryWrapper(operation);
}
