import { QueryRunner, Table, TableIndex, TableCheck } from 'typeorm';
import { CreateUsersTable1758589440121 } from '../migrations/1758589440121-CreateUsersTable.js';

// Mock QueryRunner for testing migration logic
const createMockQueryRunner = (): QueryRunner => {
  const mockQueryRunner = {
    createTable: jest.fn(),
    createIndex: jest.fn(),
    dropIndex: jest.fn(),
    dropTable: jest.fn(),
    hasTable: jest.fn(),
    getTable: jest.fn(),
    query: jest.fn(),
    release: jest.fn(),
  } as unknown as QueryRunner;

  return mockQueryRunner;
};

describe('Database Migration Contract: CreateUsersTable', () => {
  let queryRunner: QueryRunner;
  let migration: CreateUsersTable1758589440121;
  let mockCreateTable: jest.Mock;
  let mockCreateIndex: jest.Mock;
  let mockDropIndex: jest.Mock;
  let mockDropTable: jest.Mock;
  let mockHasTable: jest.Mock;
  let mockGetTable: jest.Mock;
  let mockQuery: jest.Mock;

  beforeEach(() => {
    queryRunner = createMockQueryRunner();
    migration = new CreateUsersTable1758589440121();

    mockCreateTable = queryRunner.createTable as jest.Mock;
    mockCreateIndex = queryRunner.createIndex as jest.Mock;
    mockDropIndex = queryRunner.dropIndex as jest.Mock;
    mockDropTable = queryRunner.dropTable as jest.Mock;
    mockHasTable = queryRunner.hasTable as jest.Mock;
    mockGetTable = queryRunner.getTable as jest.Mock;
    mockQuery = queryRunner.query as jest.Mock;

    // Configure default mock behavior
    mockHasTable.mockResolvedValue(false); // Default: table doesn't exist
    mockGetTable.mockResolvedValue({
      name: 'users',
      columns: [
        { name: 'id' },
        { name: 'google_id' },
        { name: 'email' },
        { name: 'name' },
        { name: 'profile_picture_url' },
        { name: 'created_at' },
        { name: 'updated_at' },
      ],
    });

    jest.clearAllMocks();
  });

  describe('Migration Execution', () => {
    it('should create users table with correct schema', async () => {
      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: Should call createTable with proper schema
      expect(mockCreateTable).toHaveBeenCalledTimes(1);

      const tableArg = mockCreateTable.mock.calls[0][0] as Table;
      expect(tableArg.name).toBe('users');
      expect(tableArg.columns).toHaveLength(7);

      // Check id column (UUID primary key)
      const idColumn = tableArg.columns.find((c) => c.name === 'id');
      expect(idColumn).toBeDefined();
      expect(idColumn!.type).toBe('uuid');
      expect(idColumn!.isPrimary).toBe(true);
      expect(idColumn!.generationStrategy).toBe('uuid');

      // Check google_id column (unique varchar)
      const googleIdColumn = tableArg.columns.find(
        (c) => c.name === 'google_id'
      );
      expect(googleIdColumn).toBeDefined();
      expect(googleIdColumn!.type).toBe('varchar');
      expect(googleIdColumn!.length).toBe('255');
      expect(googleIdColumn!.isUnique).toBe(true);

      // Check email column (varchar not null)
      const emailColumn = tableArg.columns.find((c) => c.name === 'email');
      expect(emailColumn).toBeDefined();
      expect(emailColumn!.type).toBe('varchar');
      expect(emailColumn!.length).toBe('320');
      expect(emailColumn!.isNullable).toBe(false);

      // Check name column (varchar not null)
      const nameColumn = tableArg.columns.find((c) => c.name === 'name');
      expect(nameColumn).toBeDefined();
      expect(nameColumn!.type).toBe('varchar');
      expect(nameColumn!.length).toBe('255');
      expect(nameColumn!.isNullable).toBe(false);

      // Check profile_picture_url column (text nullable)
      const profilePictureColumn = tableArg.columns.find(
        (c) => c.name === 'profile_picture_url'
      );
      expect(profilePictureColumn).toBeDefined();
      expect(profilePictureColumn!.type).toBe('text');
      expect(profilePictureColumn!.isNullable).toBe(true);

      // Check created_at column (timestamp with default)
      const createdAtColumn = tableArg.columns.find(
        (c) => c.name === 'created_at'
      );
      expect(createdAtColumn).toBeDefined();
      expect(createdAtColumn!.type).toBe('timestamp');
      expect(createdAtColumn!.default).toBe('CURRENT_TIMESTAMP');
      expect(createdAtColumn!.isNullable).toBe(false);

      // Check updated_at column (timestamp with default and onUpdate)
      const updatedAtColumn = tableArg.columns.find(
        (c) => c.name === 'updated_at'
      );
      expect(updatedAtColumn).toBeDefined();
      expect(updatedAtColumn!.type).toBe('timestamp');
      expect(updatedAtColumn!.default).toBe('CURRENT_TIMESTAMP');
      expect(updatedAtColumn!.onUpdate).toBe('CURRENT_TIMESTAMP');
      expect(updatedAtColumn!.isNullable).toBe(false);
    });

    it('should create proper indexes for google_id and email fields', async () => {
      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: Should create 2 explicit indexes (google_id is auto-created by unique constraint)
      expect(mockCreateIndex).toHaveBeenCalledTimes(2);

      // Verify all calls are made with 'users' table
      const calls = mockCreateIndex.mock.calls;
      expect(calls[0][0]).toBe('users');
      expect(calls[1][0]).toBe('users');

      // Verify TableIndex objects are passed
      expect(calls[0][1]).toBeInstanceOf(TableIndex);
      expect(calls[1][1]).toBeInstanceOf(TableIndex);
    });

    it('should create constraints for OAuth fields and email validation', async () => {
      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: Check table creation includes constraints
      expect(mockCreateTable).toHaveBeenCalledTimes(1);

      const tableArg = mockCreateTable.mock.calls[0][0] as Table;
      const checks = tableArg.checks || [];

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

    it('should call migration operations in correct order', async () => {
      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: Should create table and indexes in correct sequence
      expect(mockCreateTable).toHaveBeenCalledTimes(1);
      expect(mockCreateIndex).toHaveBeenCalledTimes(2);

      // Table creation should happen before index creation
      const createTableCallOrder = mockCreateTable.mock.invocationCallOrder[0];
      const firstIndexCallOrder = mockCreateIndex.mock.invocationCallOrder[0];
      expect(createTableCallOrder).toBeLessThan(firstIndexCallOrder);
    });
  });

  describe('Migration Rollback', () => {
    it('should drop the table and all indexes on rollback', async () => {
      // Arrange: Setup mock to indicate table exists
      mockHasTable.mockResolvedValue(true);

      // Act: Run rollback
      await migration.down(queryRunner);

      // Assert: Should drop explicitly created indexes first, then table
      expect(mockDropIndex).toHaveBeenCalledTimes(2);
      expect(mockDropTable).toHaveBeenCalledTimes(1);

      // Check index drops (only explicit indexes, google_id constraint is auto-dropped)
      expect(mockDropIndex).toHaveBeenCalledWith(
        'users',
        'IDX_users_created_at'
      );
      expect(mockDropIndex).toHaveBeenCalledWith('users', 'IDX_users_email');

      // Check table drop
      expect(mockDropTable).toHaveBeenCalledWith('users');

      // Should drop indexes before table
      const firstDropIndexCallOrder = mockDropIndex.mock.invocationCallOrder[0];
      const dropTableCallOrder = mockDropTable.mock.invocationCallOrder[0];
      expect(firstDropIndexCallOrder).toBeLessThan(dropTableCallOrder);
    });

    it('should handle rollback gracefully', async () => {
      // Act & Assert: Should not throw error
      await expect(migration.down(queryRunner)).resolves.not.toThrow();
    });
  });

  describe('Migration Safety', () => {
    it('should use proper table creation with all parameters', async () => {
      // Act: Run migration
      await migration.up(queryRunner);

      // Assert: Table creation should include all necessary parameters
      expect(mockCreateTable).toHaveBeenCalledWith(
        expect.any(Table),
        true // ifNotExists parameter
      );
    });

    it('should handle migration failure gracefully', async () => {
      // Mock a failure during table creation
      mockCreateTable.mockRejectedValue(new Error('Database error'));

      // Act & Assert: Migration should fail
      await expect(migration.up(queryRunner)).rejects.toThrow('Database error');
    });

    it('should handle index creation failure gracefully', async () => {
      // Mock a failure during index creation
      mockCreateIndex.mockRejectedValue(new Error('Index error'));

      // Act & Assert: Migration should fail
      await expect(migration.up(queryRunner)).rejects.toThrow('Index error');
    });
  });

  describe('Migration Structure Validation', () => {
    it('should have correct table name', async () => {
      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: Table name should be "users"
      const tableArg = mockCreateTable.mock.calls[0][0] as Table;
      expect(tableArg.name).toBe('users');
    });

    it('should have all required check constraints', async () => {
      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: Should have exactly 3 check constraints
      const tableArg = mockCreateTable.mock.calls[0][0] as Table;
      const checks = tableArg.checks || [];
      expect(checks).toHaveLength(3);

      const constraintNames = checks.map((check) => check.name);
      expect(constraintNames).toContain('CHK_users_email_format');
      expect(constraintNames).toContain('CHK_users_google_id_not_empty');
      expect(constraintNames).toContain('CHK_users_name_not_empty');
    });

    it('should have correct column types and properties', async () => {
      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: Verify specific column properties
      const tableArg = mockCreateTable.mock.calls[0][0] as Table;
      const columns = tableArg.columns;

      // Should have exactly 7 columns
      expect(columns).toHaveLength(7);

      // All columns should have proper names
      const columnNames = columns.map((col) => col.name);
      expect(columnNames).toEqual([
        'id',
        'google_id',
        'email',
        'name',
        'profile_picture_url',
        'created_at',
        'updated_at',
      ]);
    });
  });
});
