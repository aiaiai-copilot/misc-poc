import { DataSource } from 'typeorm';
import { getDataSource } from './data-source.js';

/**
 * Migration Runner utility for programmatic migration management
 * Provides methods to run, revert, and check migration status
 */
export class MigrationRunner {
  private dataSource: DataSource;

  constructor(dataSource?: DataSource) {
    this.dataSource = dataSource || getDataSource();
  }

  /**
   * Initialize the database connection
   */
  async initialize(): Promise<void> {
    if (!this.dataSource.isInitialized) {
      await this.dataSource.initialize();
    }
  }

  /**
   * Close the database connection
   */
  async destroy(): Promise<void> {
    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy();
    }
  }

  /**
   * Run all pending migrations
   * @returns Array of executed migration names
   */
  async runMigrations(): Promise<string[]> {
    await this.initialize();

    try {
      const migrations = await this.dataSource.runMigrations({
        transaction: 'all', // Run all migrations in a single transaction
      });

      return migrations.map((migration) => migration.name);
    } catch (error) {
      console.error('Migration execution failed:', error);
      throw error;
    }
  }

  /**
   * Revert the last executed migration
   * @returns Name of the reverted migration or null if no migration to revert
   */
  async revertLastMigration(): Promise<string | null> {
    await this.initialize();

    try {
      // Get the last executed migration before reverting
      const executedMigrations = await this.getExecutedMigrations();
      if (executedMigrations.length === 0) {
        return null;
      }

      const lastMigration = executedMigrations[0];
      if (!lastMigration) {
        return null;
      }

      await this.dataSource.undoLastMigration({
        transaction: 'all',
      });

      return lastMigration.name;
    } catch (error) {
      console.error('Migration revert failed:', error);
      throw error;
    }
  }

  /**
   * Get list of executed migrations
   * @returns Array of executed migration objects with timestamps
   */
  async getExecutedMigrations(): Promise<
    Array<{ id: number; timestamp: number; name: string }>
  > {
    await this.initialize();

    const queryRunner = this.dataSource.createQueryRunner();
    try {
      const migrations = await queryRunner.query(
        `SELECT id, timestamp, name FROM ${this.dataSource.options.migrationsTableName || 'migrations'} ORDER BY timestamp DESC`
      );
      return migrations;
    } catch (error) {
      // Table might not exist yet
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === '42P01'
      ) {
        return [];
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get list of pending migrations
   * @returns Array of pending migration names
   */
  async getPendingMigrations(): Promise<string[]> {
    await this.initialize();

    const executedMigrations = await this.getExecutedMigrations();
    const executedNames = new Set(executedMigrations.map((m) => m.name));

    const allMigrations = this.dataSource.migrations;
    const pendingMigrations = allMigrations
      .filter(
        (migration) => migration.name && !executedNames.has(migration.name)
      )
      .map((migration) => migration.name!)
      .filter((name): name is string => name !== undefined);

    return pendingMigrations;
  }

  /**
   * Check if database is up to date (no pending migrations)
   * @returns true if no pending migrations, false otherwise
   */
  async isUpToDate(): Promise<boolean> {
    const pendingMigrations = await this.getPendingMigrations();
    return pendingMigrations.length === 0;
  }

  /**
   * Get migration status information
   * @returns Object with migration status details
   */
  async getStatus(): Promise<{
    isUpToDate: boolean;
    executedCount: number;
    pendingCount: number;
    executedMigrations: string[];
    pendingMigrations: string[];
  }> {
    const [executed, pending] = await Promise.all([
      this.getExecutedMigrations(),
      this.getPendingMigrations(),
    ]);

    return {
      isUpToDate: pending.length === 0,
      executedCount: executed.length,
      pendingCount: pending.length,
      executedMigrations: executed.map((m) => m.name),
      pendingMigrations: pending,
    };
  }

  /**
   * Validate database connection
   * @returns true if connection is successful, false otherwise
   */
  async validateConnection(): Promise<boolean> {
    try {
      await this.initialize();
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.query('SELECT 1');
      await queryRunner.release();
      return true;
    } catch (error) {
      console.error('Database connection validation failed:', error);
      return false;
    }
  }
}
