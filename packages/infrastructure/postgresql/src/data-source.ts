import { DataSource } from 'typeorm';
import { CreateMiscSchema1704067200000 } from './migrations/1704067200000-CreateMiscSchema.js';
import { AddRowLevelSecurity1704067300000 } from './migrations/1704067300000-AddRowLevelSecurity.js';

export interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export function createDataSource(config: PostgresConfig): DataSource {
  return new DataSource({
    type: 'postgres',
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    password: config.password,
    synchronize: false,
    logging: false,
    migrations: [
      CreateMiscSchema1704067200000,
      AddRowLevelSecurity1704067300000,
    ],
    migrationsTableName: 'schema_migrations',
    migrationsTransactionMode: 'each',
    // Connection pooling configuration for production performance
    extra: {
      max: 20, // Maximum pool size
      min: 5, // Minimum pool size
      idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
      connectionTimeoutMillis: 2000, // Connection timeout
      acquireTimeoutMillis: 60000, // Pool acquire timeout
    },
    // Query optimization settings
    maxQueryExecutionTime: 10000, // 10 second query timeout
  });
}

// Factory function for creating test data sources
export function createTestDataSource(config: PostgresConfig): DataSource {
  return new DataSource({
    type: 'postgres',
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    password: config.password,
    synchronize: false,
    logging: ['error', 'warn'],
    migrations: [
      CreateMiscSchema1704067200000,
      AddRowLevelSecurity1704067300000,
    ],
    migrationsTableName: 'schema_migrations',
    migrationsTransactionMode: 'each',
  });
}
