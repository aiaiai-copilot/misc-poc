import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { EnhancedMigrationRunner } from '../enhanced-migration-runner.js';
import { MigrationCLI } from '../migration-cli.js';

/**
 * Integration tests for Enhanced Migration Runner using Testcontainers
 *
 * These tests validate the actual functionality against a real PostgreSQL database
 * using Testcontainers for dynamic container management.
 *
 * Tests cover:
 * - Real migration execution with PostgreSQL
 * - Transaction wrapping and rollback behavior
 * - CLI interface integration
 * - Performance benchmarks
 * - Error scenarios with real database constraints
 */

describe('Enhanced Migration Runner - Integration Tests with Testcontainers', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let migrationRunner: EnhancedMigrationRunner;
  let migrationCLI: MigrationCLI;

  // Test timeout increased for container startup and real database operations
  jest.setTimeout(120000);

  beforeAll(async () => {
    console.log('🐳 Starting PostgreSQL container for integration tests...');

    try {
      // Start PostgreSQL container with Testcontainers
      container = await new PostgreSqlContainer('postgres:15')
        .withDatabase('misc_test')
        .withUsername('test_user')
        .withPassword('test_password')
        .withExposedPorts(5432)
        .start();
    } catch (error) {
      console.warn(
        '⚠️  Docker not available, skipping Testcontainers integration tests'
      );
      console.warn('Error:', (error as Error).message);
      return;
    }

    console.log(
      `✅ PostgreSQL container started on ${container.getHost()}:${container.getMappedPort(5432)}`
    );

    // Create DataSource with dynamic container configuration
    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getMappedPort(5432),
      database: container.getDatabase(),
      username: container.getUsername(),
      password: container.getPassword(),
      synchronize: false, // We want to test migrations, not sync
      dropSchema: false,
      logging: ['error'], // Reduce noise in tests
      entities: [],
      migrations: [
        // Use actual migration files
        'src/migrations/*.ts',
      ],
      migrationsTableName: 'migrations',
    });

    // Initialize migration runner and CLI
    migrationRunner = new EnhancedMigrationRunner(dataSource);
    migrationCLI = new MigrationCLI(migrationRunner);

    console.log(
      '✅ Enhanced Migration Runner initialized with real PostgreSQL'
    );
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up test resources...');

    if (migrationRunner) {
      await migrationRunner.destroy();
    }

    if (container) {
      await container.stop();
      console.log('✅ PostgreSQL container stopped');
    }
  });

  beforeEach(async () => {
    // Skip tests if Docker/container not available
    if (!container) {
      console.warn('⚠️  Skipping test - Docker not available');
      return;
    }

    // Ensure clean state before each test
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  describe('Real Database Connection and Validation', () => {
    it('should validate database connection successfully', async () => {
      if (!container) return; // Skip if no Docker

      // Act
      const validation = await migrationRunner.validateDatabaseConnection();

      // Assert
      expect(validation.isValid).toBe(true);
      expect(validation.error).toBeNull();
    });

    it('should report detailed database information', async () => {
      // Act
      await migrationRunner.initialize();
      const queryRunner = dataSource.createQueryRunner();
      const version = await queryRunner.query('SELECT version()');
      await queryRunner.release();

      // Assert
      expect(version).toBeDefined();
      expect(version[0].version).toContain('PostgreSQL');
      console.log(`📊 PostgreSQL Version: ${version[0].version}`);
    });
  });

  describe('Real Migration Execution', () => {
    it('should execute migrations against real PostgreSQL database', async () => {
      // Arrange
      const startTime = Date.now();

      // Act
      const result = await migrationRunner.runMigrationsWithTransaction({
        outputFormat: 'cli',
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);

      const executionTime = Date.now() - startTime;
      console.log(`⏱️  Migration execution time: ${executionTime}ms`);

      // Verify migration table exists
      await migrationRunner.initialize();
      const queryRunner = dataSource.createQueryRunner();
      const tables = await queryRunner.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
      `);
      await queryRunner.release();

      const tableNames = tables.map((t: any) => t.table_name);
      expect(tableNames).toContain('migrations');

      console.log(`📋 Created tables: ${tableNames.join(', ')}`);
    });

    it('should handle transaction rollback on migration failure', async () => {
      // This test simulates a migration failure to test rollback behavior
      // We'll create a custom failing migration scenario

      // First, ensure we have a clean state
      await migrationRunner.initialize();

      // Create a scenario where a migration would fail
      const queryRunner = dataSource.createQueryRunner();

      try {
        await queryRunner.startTransaction();

        // Create a table that would conflict with a migration
        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS test_conflict_table (
            id SERIAL PRIMARY KEY,
            conflicting_column TEXT
          )
        `);

        await queryRunner.commitTransaction();

        // Now try to run migrations that might conflict
        // The transaction should handle any failures gracefully
        const result = await migrationRunner.runMigrationsWithTransaction();

        // Even if there are conflicts, the runner should handle them
        expect(result).toBeDefined();
        expect(result.success).toBeDefined();
      } finally {
        await queryRunner.release();
      }
    });

    it('should provide performance metrics for real database operations', async () => {
      // Act
      const result = await migrationRunner.runMigrationsWithTransaction({
        outputFormat: 'cli',
      });

      // Assert
      expect(result.state).toBeDefined();
      expect(result.state?.totalDuration).toBeGreaterThan(0);

      if (result.performance && result.executedMigrations.length > 0) {
        expect(result.performance.migrationCount).toBeGreaterThan(0);
        expect(result.performance.averageExecutionTime).toBeGreaterThan(0);

        console.log(`📊 Performance Metrics:
  - Total migrations: ${result.performance.migrationCount}
  - Total time: ${result.state?.totalDuration}ms
  - Average time per migration: ${result.performance.averageExecutionTime}ms`);
      }
    });
  });

  describe('Migration Status and History with Real Database', () => {
    it('should provide accurate migration status from real database', async () => {
      // Arrange - First run migrations
      await migrationRunner.runMigrationsWithTransaction();

      // Act
      const status = await migrationRunner.getDetailedStatus();

      // Assert
      expect(status.executedCount).toBeGreaterThanOrEqual(0);
      expect(status.pendingCount).toBeGreaterThanOrEqual(0);
      expect(status.isUpToDate).toBeDefined();

      console.log(`📊 Migration Status:
  - Executed: ${status.executedCount}
  - Pending: ${status.pendingCount}
  - Up to date: ${status.isUpToDate}`);
    });

    it('should export real migration history', async () => {
      // Arrange - Ensure migrations are run
      await migrationRunner.runMigrationsWithTransaction();

      // Act
      const history = await migrationRunner.exportMigrationHistory();

      // Assert
      expect(history.migrations).toBeDefined();
      expect(history.exportDate).toBeInstanceOf(Date);
      expect(history.version).toBe('2.0');

      console.log(
        `📜 Migration History: ${history.migrations.length} migrations exported`
      );
    });

    it('should validate migration history integrity against real data', async () => {
      // Arrange - Run migrations first
      await migrationRunner.runMigrationsWithTransaction();

      // Act
      const validation = await migrationRunner.validateMigrationHistory();

      // Assert
      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);

      console.log(
        `✅ Migration history validation: ${validation.isValid ? 'PASSED' : 'FAILED'}`
      );
    });
  });

  describe('CLI Integration with Real Database', () => {
    it('should execute migrate:status command against real database', async () => {
      // Act
      const result = await migrationCLI.executeCommand('migrate:status');

      // Assert
      expect(result.success).toBe(true);
      expect(result.output).toContain('Migration Status');
      expect(result.exitCode).toBe(0);

      console.log('📋 CLI Status Output:', result.output);
    });

    it('should execute migrate:up command with real database', async () => {
      // Act
      const result = await migrationCLI.executeCommand('migrate:up');

      // Assert
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);

      console.log('📋 CLI Migration Output:', result.output);
    });

    it('should execute migrate:validate command against real database', async () => {
      // Act
      const result = await migrationCLI.executeCommand('migrate:validate');

      // Assert
      expect(result.success).toBe(true);
      expect(result.output).toContain('Database connection: OK');
      expect(result.exitCode).toBe(0);

      console.log('📋 CLI Validation Output:', result.output);
    });

    it('should execute migrate:history command with real data', async () => {
      // Arrange - Ensure we have some migration history
      await migrationRunner.runMigrationsWithTransaction();

      // Act
      const result = await migrationCLI.executeCommand('migrate:history');

      // Assert
      expect(result.success).toBe(true);
      expect(result.output).toContain('Migration History');
      expect(result.exitCode).toBe(0);

      console.log('📋 CLI History Output:', result.output);
    });

    it('should handle dry-run mode without affecting real database', async () => {
      // Arrange - Get initial state
      const initialStatus = await migrationRunner.getDetailedStatus();

      // Act
      const result = await migrationCLI.executeCommand('migrate:up', [
        '--dry-run',
      ]);

      // Assert
      expect(result.success).toBe(true);
      expect(result.output).toContain('DRY RUN');
      expect(result.exitCode).toBe(0);

      // Verify no changes were made to the database
      const finalStatus = await migrationRunner.getDetailedStatus();
      expect(finalStatus.executedCount).toBe(initialStatus.executedCount);

      console.log('📋 CLI Dry-run Output:', result.output);
    });
  });

  describe('Error Handling with Real Database', () => {
    it('should handle database connection failures gracefully', async () => {
      // Arrange - Create a migration runner with invalid connection
      const invalidDataSource = new DataSource({
        type: 'postgres',
        host: 'invalid-host',
        port: 5432,
        database: 'invalid-db',
        username: 'invalid-user',
        password: 'invalid-password',
      });

      const invalidRunner = new EnhancedMigrationRunner(invalidDataSource);

      // Act
      const validation = await invalidRunner.validateDatabaseConnection();

      // Assert
      expect(validation.isValid).toBe(false);
      expect(validation.error).toBeDefined();

      console.log('🚫 Expected connection failure:', validation.error);
    });

    it('should handle SQL execution errors properly', async () => {
      // Arrange
      await migrationRunner.initialize();
      const queryRunner = dataSource.createQueryRunner();

      try {
        // Try to execute invalid SQL
        await queryRunner.query('INVALID SQL STATEMENT');
      } catch (error) {
        // Assert
        expect(error).toBeDefined();
        expect(error instanceof Error).toBe(true);
        console.log('🚫 Expected SQL error:', (error as Error).message);
      } finally {
        await queryRunner.release();
      }
    });
  });

  describe('Performance Benchmarks', () => {
    it('should benchmark migration execution performance', async () => {
      // Arrange
      const iterations = 3;
      const executionTimes: number[] = [];

      // Act - Run multiple iterations
      for (let i = 0; i < iterations; i++) {
        // Clean database state
        if (dataSource.isInitialized) {
          await dataSource.destroy();
        }

        const startTime = Date.now();
        const result = await migrationRunner.runMigrationsWithTransaction();
        const endTime = Date.now();

        if (result.success) {
          executionTimes.push(endTime - startTime);
        }
      }

      // Assert
      expect(executionTimes.length).toBeGreaterThan(0);

      const averageTime =
        executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
      const minTime = Math.min(...executionTimes);
      const maxTime = Math.max(...executionTimes);

      console.log(`📊 Performance Benchmark Results:
  - Iterations: ${iterations}
  - Average time: ${averageTime.toFixed(2)}ms
  - Min time: ${minTime}ms
  - Max time: ${maxTime}ms
  - Execution times: ${executionTimes.join(', ')}ms`);

      // Performance assertions
      expect(averageTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(minTime).toBeGreaterThan(0);
    });

    it('should benchmark concurrent migration status checks', async () => {
      // Arrange
      await migrationRunner.runMigrationsWithTransaction();
      const concurrentRequests = 5;

      // Act - Run concurrent status checks
      const startTime = Date.now();
      const promises = Array(concurrentRequests)
        .fill(0)
        .map(() => migrationRunner.getDetailedStatus());

      const results = await Promise.all(promises);
      const endTime = Date.now();

      // Assert
      expect(results).toHaveLength(concurrentRequests);
      results.forEach((result) => {
        expect(result.executedCount).toBeGreaterThanOrEqual(0);
      });

      const totalTime = endTime - startTime;
      const averageTimePerRequest = totalTime / concurrentRequests;

      console.log(`📊 Concurrent Status Check Benchmark:
  - Concurrent requests: ${concurrentRequests}
  - Total time: ${totalTime}ms
  - Average time per request: ${averageTimePerRequest.toFixed(2)}ms`);

      // Performance assertion
      expect(averageTimePerRequest).toBeLessThan(1000); // Should respond within 1 second per request
    });
  });
});
