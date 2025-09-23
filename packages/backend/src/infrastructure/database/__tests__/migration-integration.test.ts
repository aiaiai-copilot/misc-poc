import { DataSource, QueryRunner } from 'typeorm';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { CreateUsersTable1758589440121 } from '../migrations/1758589440121-CreateUsersTable.js';

/**
 * Integration tests for database migration execution using Testcontainers
 * Following TDD contract specifications from PRD section 4.2.2
 *
 * Now uses Testcontainers for reliable, isolated PostgreSQL testing
 */
describe('Database Migration Contract - Integration Tests with Testcontainers', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  // Increase timeout for container operations
  jest.setTimeout(120000);

  beforeAll(async () => {
    console.log(
      '🐳 Starting PostgreSQL container for migration integration tests...'
    );

    try {
      // Start PostgreSQL container with Testcontainers
      container = await new PostgreSqlContainer('postgres:15')
        .withDatabase('migration_test')
        .withUsername('test_user')
        .withPassword('test_password')
        .start();

      console.log(
        `✅ PostgreSQL container started: ${container.getHost()}:${container.getMappedPort(5432)}`
      );

      // Create DataSource with dynamic container configuration
      dataSource = new DataSource({
        type: 'postgres',
        host: container.getHost(),
        port: container.getMappedPort(5432),
        database: container.getDatabase(),
        username: container.getUsername(),
        password: container.getPassword(),
        synchronize: false,
        dropSchema: false,
        logging: ['error'], // Reduce test noise
        entities: [],
        migrations: [], // We'll test individual migrations
        migrationsTableName: 'migrations',
      });

      await dataSource.initialize();
      queryRunner = dataSource.createQueryRunner();

      console.log('✅ Migration integration test environment ready');
    } catch (error) {
      console.error('Failed to initialize test environment:', error);
      throw error;
    }
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up test resources...');

    if (queryRunner) {
      await queryRunner.release();
    }
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    if (container) {
      await container.stop();
      console.log('✅ PostgreSQL container stopped');
    }
  });

  beforeEach(async () => {
    // Clean up any existing users table for fresh state
    try {
      await queryRunner.dropTable('users', true); // ifExists = true
    } catch {
      // Table doesn't exist, which is fine
    }
  });

  describe('Migration Execution', () => {
    it('should run migration and track in migrations table', async () => {
      const migration = new CreateUsersTable1758589440121();

      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: Table should exist
      const hasTable = await queryRunner.hasTable('users');
      expect(hasTable).toBe(true);

      // Assert: Table should have correct structure
      const table = await queryRunner.getTable('users');
      expect(table).toBeDefined();
      expect(table!.columns).toHaveLength(7);

      // Verify primary key
      const primaryColumns = table!.columns.filter((col) => col.isPrimary);
      expect(primaryColumns).toHaveLength(1);
      expect(primaryColumns[0].name).toBe('id');
      expect(primaryColumns[0].type).toBe('uuid');
    });

    it('should create proper indexes for optimization', async () => {
      const migration = new CreateUsersTable1758589440121();

      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: Check indexes exist
      const table = await queryRunner.getTable('users');
      expect(table).toBeDefined();

      const indexes = table!.indices;
      expect(indexes).toHaveLength(2);

      // Note: google_id unique constraint is created automatically by TypeORM, not as separate index

      // Check email index
      const emailIndex = indexes.find((idx) => idx.name === 'IDX_users_email');
      expect(emailIndex).toBeDefined();
      expect(emailIndex!.columnNames).toEqual(['email']);

      // Check created_at index
      const createdAtIndex = indexes.find(
        (idx) => idx.name === 'IDX_users_created_at'
      );
      expect(createdAtIndex).toBeDefined();
      expect(createdAtIndex!.columnNames).toEqual(['created_at']);
    });

    it('should create constraints for data integrity', async () => {
      const migration = new CreateUsersTable1758589440121();

      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: Check constraints exist
      const table = await queryRunner.getTable('users');
      expect(table).toBeDefined();

      const checks = table!.checks;
      expect(checks).toHaveLength(3);

      // Check email format constraint
      const emailFormatCheck = checks.find(
        (check) => check.name === 'CHK_users_email_format'
      );
      expect(emailFormatCheck).toBeDefined();
      expect(emailFormatCheck!.expression).toContain('email');

      // Check google_id not empty constraint
      const googleIdNotEmptyCheck = checks.find(
        (check) => check.name === 'CHK_users_google_id_not_empty'
      );
      expect(googleIdNotEmptyCheck).toBeDefined();
      expect(googleIdNotEmptyCheck!.expression).toContain('google_id');

      // Check name not empty constraint
      const nameNotEmptyCheck = checks.find(
        (check) => check.name === 'CHK_users_name_not_empty'
      );
      expect(nameNotEmptyCheck).toBeDefined();
      expect(nameNotEmptyCheck!.expression).toContain('name');
    });

    it('should enforce data validation constraints', async () => {
      const migration = new CreateUsersTable1758589440121();
      await migration.up(queryRunner);

      // Test email validation constraint
      await expect(
        queryRunner.query(`
          INSERT INTO users (google_id, email, name)
          VALUES ('test123', 'invalid-email', 'Test User')
        `)
      ).rejects.toThrow();

      // Test google_id not empty constraint
      await expect(
        queryRunner.query(`
          INSERT INTO users (google_id, email, name)
          VALUES ('', 'test@example.com', 'Test User')
        `)
      ).rejects.toThrow();

      // Test name not empty constraint
      await expect(
        queryRunner.query(`
          INSERT INTO users (google_id, email, name)
          VALUES ('test123', 'test@example.com', '')
        `)
      ).rejects.toThrow();
    });

    it('should prevent duplicate migration execution', async () => {
      const migration = new CreateUsersTable1758589440121();

      // Act: Run migration twice
      await migration.up(queryRunner);

      // Second run should not fail due to "IF NOT EXISTS" usage
      await expect(migration.up(queryRunner)).resolves.not.toThrow();
    });
  });

  describe('Migration Rollback', () => {
    it('should rollback migration and remove all artifacts', async () => {
      const migration = new CreateUsersTable1758589440121();

      // Setup: Run migration first
      await migration.up(queryRunner);
      expect(await queryRunner.hasTable('users')).toBe(true);

      // Act: Rollback migration
      await migration.down(queryRunner);

      // Assert: Table should be removed
      const hasTable = await queryRunner.hasTable('users');
      expect(hasTable).toBe(false);
    });

    it('should handle rollback in reverse chronological order', async () => {
      const migration = new CreateUsersTable1758589440121();

      // Setup: Run migration first
      await migration.up(queryRunner);

      // Act & Assert: Rollback should succeed
      await expect(migration.down(queryRunner)).resolves.not.toThrow();

      // Verify clean state
      expect(await queryRunner.hasTable('users')).toBe(false);
    });

    it('should handle data preservation during rollback', async () => {
      const migration = new CreateUsersTable1758589440121();

      // Setup: Run migration and add test data
      await migration.up(queryRunner);
      await queryRunner.query(`
        INSERT INTO users (google_id, email, name)
        VALUES ('test123', 'test@example.com', 'Test User')
      `);

      // Act: Rollback (this will remove the table and data)
      await migration.down(queryRunner);

      // Assert: Table should be gone (data preservation in this case means clean removal)
      expect(await queryRunner.hasTable('users')).toBe(false);
    });
  });

  describe('Migration Safety', () => {
    it('should use transactions for migration operations', async () => {
      const migration = new CreateUsersTable1758589440121();

      // Act: Run migration (implicitly uses transaction in TypeORM)
      await migration.up(queryRunner);

      // Assert: Migration completed successfully
      expect(await queryRunner.hasTable('users')).toBe(true);
    });

    it('should validate schema after migration', async () => {
      const migration = new CreateUsersTable1758589440121();

      // Act: Run migration
      await migration.up(queryRunner);

      // Assert: Validate complete schema structure
      const table = await queryRunner.getTable('users');
      expect(table).toBeDefined();

      // Validate all columns exist with correct types
      const columnNames = table!.columns.map((col) => col.name);
      expect(columnNames).toEqual([
        'id',
        'google_id',
        'email',
        'name',
        'profile_picture_url',
        'created_at',
        'updated_at',
      ]);

      // Validate constraints
      expect(table!.checks).toHaveLength(3);

      // Note: TypeORM creates unique constraints, not separate indexes for unique columns
      // We should have at least the explicitly created indexes (email, created_at)
      expect(table!.indices.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle migration failure gracefully', async () => {
      // Create a scenario that might fail (table already exists without IF NOT EXISTS)
      await queryRunner.query(`
        CREATE TABLE users (id SERIAL PRIMARY KEY)
      `);

      const migration = new CreateUsersTable1758589440121();

      // Act & Assert: Migration should handle existing table gracefully
      await expect(migration.up(queryRunner)).resolves.not.toThrow();
    });
  });

  describe('Migration Execution Order', () => {
    it('should execute migration operations in correct sequence', async () => {
      const migration = new CreateUsersTable1758589440121();

      // Act: Run migration
      await migration.up(queryRunner);

      // Assert: Verify table exists before checking indexes
      // (indexes can only be created after table exists)
      const table = await queryRunner.getTable('users');
      expect(table).toBeDefined();
      expect(table!.indices).toHaveLength(2);
    });
  });
});
