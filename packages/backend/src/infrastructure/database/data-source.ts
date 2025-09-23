import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config();

/**
 * TypeORM DataSource configuration for migrations-only mode
 * This configuration is specifically for database schema management
 * and does not include entity synchronization or Active Record patterns
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB || 'misc_poc_dev',

  // Migration-specific configuration
  migrations: [
    join(
      process.cwd(),
      'src',
      'infrastructure',
      'database',
      'migrations',
      '*.{ts,js}'
    ),
  ],
  migrationsTableName: 'migration_history',
  migrationsRun: false, // Do not auto-run migrations

  // Disable entity synchronization for migrations-only mode
  synchronize: false,
  dropSchema: false,

  // Connection pool settings
  extra: {
    connectionTimeoutMillis: parseInt(
      process.env.DB_CONNECTION_TIMEOUT || '30000'
    ),
    idleTimeoutMillis: 30000,
    max: parseInt(process.env.DB_POOL_MAX || '10'),
    min: parseInt(process.env.DB_POOL_MIN || '2'),
  },

  // Logging configuration
  logging:
    process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'schema', 'warn', 'info', 'log']
      : ['error'],

  // SSL configuration for production
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
});

/**
 * Test DataSource configuration for isolated testing
 */
export const TestDataSource = new DataSource({
  type: 'postgres',
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '5433'),
  username: process.env.POSTGRES_TEST_USER || 'postgres_test',
  password: process.env.POSTGRES_TEST_PASSWORD || 'test_password',
  database: process.env.POSTGRES_TEST_DB || 'misc_poc_test',

  // Migration-specific configuration for testing
  migrations: [
    join(
      process.cwd(),
      'src',
      'infrastructure',
      'database',
      'migrations',
      '*.{ts,js}'
    ),
  ],
  migrationsTableName: 'migration_history',
  migrationsRun: false,

  // Test-specific settings
  synchronize: false,
  dropSchema: false,

  // Reduced connection pool for testing
  extra: {
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
    max: 5,
    min: 1,
  },

  // Minimal logging for tests
  logging: ['error'],
  ssl: false,
});

/**
 * Get the appropriate DataSource based on environment
 */
export function getDataSource(): DataSource {
  return process.env.NODE_ENV === 'test' ? TestDataSource : AppDataSource;
}
