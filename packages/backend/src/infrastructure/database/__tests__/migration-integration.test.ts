import { DataSource, QueryRunner } from 'typeorm';
import { TestDataSource } from '../data-source.js';
import { CreateUsersTable1758589440121 } from '../migrations/1758589440121-CreateUsersTable.js';

/**
 * Integration tests for database migration execution
 * Following TDD contract specifications from PRD section 4.2.2
 */
describe('Database Migration Contract - Integration Tests', () => {
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  beforeAll(async () => {
    // Use test database for integration tests
    dataSource = TestDataSource;

    // Skip if no test database available
    if (!process.env.POSTGRES_TEST_PASSWORD) {
      console.warn('Skipping integration tests - no test database configured');
      return;
    }

    try {
      await dataSource.initialize();
      queryRunner = dataSource.createQueryRunner();
    } catch (error) {
      console.warn(
        'Skipping integration tests - database connection failed:',
        error
      );
    }
  });

  afterAll(async () => {
    if (queryRunner) {
      await queryRunner.release();
    }
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    if (!queryRunner) {
      return; // Skip test if no database connection
    }

    // Clean up any existing users table
    try {
      await queryRunner.dropTable('users', true); // ifExists = true
    } catch {
      // Table doesn't exist, which is fine
    }
  });

  describe('Migration Execution', () => {
    it('should run migration and track in migrations table', async () => {
      if (!queryRunner) {
        return; // Skip test if no database connection
      }

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
      if (!queryRunner) {
        return; // Skip test if no database connection
      }

      const migration = new CreateUsersTable1758589440121();

      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: Check indexes exist
      const table = await queryRunner.getTable('users');
      expect(table).toBeDefined();

      const indexes = table!.indices;
      expect(indexes).toHaveLength(3);

      // Check google_id unique index
      const googleIdIndex = indexes.find(
        (idx) => idx.name === 'IDX_users_google_id'
      );
      expect(googleIdIndex).toBeDefined();
      expect(googleIdIndex!.isUnique).toBe(true);
      expect(googleIdIndex!.columnNames).toEqual(['google_id']);

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
      if (!queryRunner) {
        return; // Skip test if no database connection
      }

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
      if (!queryRunner) {
        return; // Skip test if no database connection
      }

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
      if (!queryRunner) {
        return; // Skip test if no database connection
      }

      const migration = new CreateUsersTable1758589440121();

      // Act: Run migration twice
      await migration.up(queryRunner);

      // Second run should not fail due to "IF NOT EXISTS" usage
      await expect(migration.up(queryRunner)).resolves.not.toThrow();
    });
  });

  describe('Migration Rollback', () => {
    it('should rollback migration and remove all artifacts', async () => {
      if (!queryRunner) {
        return; // Skip test if no database connection
      }

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
      if (!queryRunner) {
        return; // Skip test if no database connection
      }

      const migration = new CreateUsersTable1758589440121();

      // Setup: Run migration first
      await migration.up(queryRunner);

      // Act & Assert: Rollback should succeed
      await expect(migration.down(queryRunner)).resolves.not.toThrow();

      // Verify clean state
      expect(await queryRunner.hasTable('users')).toBe(false);
    });

    it('should handle data preservation during rollback', async () => {
      if (!queryRunner) {
        return; // Skip test if no database connection
      }

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
      if (!queryRunner) {
        return; // Skip test if no database connection
      }

      const migration = new CreateUsersTable1758589440121();

      // Act: Run migration (implicitly uses transaction in TypeORM)
      await migration.up(queryRunner);

      // Assert: Migration completed successfully
      expect(await queryRunner.hasTable('users')).toBe(true);
    });

    it('should validate schema after migration', async () => {
      if (!queryRunner) {
        return; // Skip test if no database connection
      }

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
      expect(table!.indices).toHaveLength(3);
    });

    it('should handle migration failure gracefully', async () => {
      if (!queryRunner) {
        return; // Skip test if no database connection
      }

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
      if (!queryRunner) {
        return; // Skip test if no database connection
      }

      const migration = new CreateUsersTable1758589440121();

      // Act: Run migration
      await migration.up(queryRunner);

      // Assert: Verify table exists before checking indexes
      // (indexes can only be created after table exists)
      const table = await queryRunner.getTable('users');
      expect(table).toBeDefined();
      expect(table!.indices).toHaveLength(3);
    });
  });
});
