import { QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';
import { CreateRecordsTable1758589440122 } from '../migrations/1758589440122-CreateRecordsTable.js';

// Mock QueryRunner for testing migration logic
const createMockQueryRunner = (): QueryRunner => {
  const mockQueryRunner = {
    createTable: jest.fn(),
    createIndex: jest.fn(),
    createForeignKey: jest.fn(),
    dropIndex: jest.fn(),
    dropForeignKey: jest.fn(),
    dropTable: jest.fn(),
    hasTable: jest.fn(),
    getTable: jest.fn(),
    query: jest.fn(),
    release: jest.fn(),
  } as unknown as QueryRunner;

  return mockQueryRunner;
};

describe('Database Migration Contract: CreateRecordsTable', () => {
  let queryRunner: QueryRunner;
  let migration: CreateRecordsTable1758589440122;
  let mockCreateTable: jest.Mock;
  let mockCreateIndex: jest.Mock;
  let mockCreateForeignKey: jest.Mock;
  let mockDropIndex: jest.Mock;
  let mockDropForeignKey: jest.Mock;
  let mockDropTable: jest.Mock;
  let mockHasTable: jest.Mock;
  let mockGetTable: jest.Mock;
  let mockQuery: jest.Mock;

  beforeEach(() => {
    queryRunner = createMockQueryRunner();
    migration = new CreateRecordsTable1758589440122();

    mockCreateTable = queryRunner.createTable as jest.Mock;
    mockCreateIndex = queryRunner.createIndex as jest.Mock;
    mockCreateForeignKey = queryRunner.createForeignKey as jest.Mock;
    mockDropIndex = queryRunner.dropIndex as jest.Mock;
    mockDropForeignKey = queryRunner.dropForeignKey as jest.Mock;
    mockDropTable = queryRunner.dropTable as jest.Mock;
    mockHasTable = queryRunner.hasTable as jest.Mock;
    mockGetTable = queryRunner.getTable as jest.Mock;
    mockQuery = queryRunner.query as jest.Mock;

    jest.clearAllMocks();
  });

  describe('Migration Execution', () => {
    it('should create records table with correct schema according to PRD', async () => {
      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: Should call createTable with proper schema
      expect(mockCreateTable).toHaveBeenCalledTimes(1);

      const tableArg = mockCreateTable.mock.calls[0][0] as Table;
      expect(tableArg.name).toBe('records');
      expect(tableArg.columns).toHaveLength(7);

      // Check id column (UUID primary key)
      const idColumn = tableArg.columns.find((c) => c.name === 'id');
      expect(idColumn).toBeDefined();
      expect(idColumn!.type).toBe('uuid');
      expect(idColumn!.isPrimary).toBe(true);
      expect(idColumn!.generationStrategy).toBe('uuid');
      expect(idColumn!.default).toBe('gen_random_uuid()');

      // Check user_id column (foreign key to users table)
      const userIdColumn = tableArg.columns.find((c) => c.name === 'user_id');
      expect(userIdColumn).toBeDefined();
      expect(userIdColumn!.type).toBe('uuid');
      expect(userIdColumn!.isNullable).toBe(false);

      // Check content column (TEXT)
      const contentColumn = tableArg.columns.find((c) => c.name === 'content');
      expect(contentColumn).toBeDefined();
      expect(contentColumn!.type).toBe('text');
      expect(contentColumn!.isNullable).toBe(false);

      // Check tags column (TEXT[] array for PostgreSQL)
      const tagsColumn = tableArg.columns.find((c) => c.name === 'tags');
      expect(tagsColumn).toBeDefined();
      expect(tagsColumn!.type).toBe('text');
      expect(tagsColumn!.isArray).toBe(true);
      expect(tagsColumn!.isNullable).toBe(false);

      // Check normalized_tags column (TEXT[] array for search)
      const normalizedTagsColumn = tableArg.columns.find(
        (c) => c.name === 'normalized_tags'
      );
      expect(normalizedTagsColumn).toBeDefined();
      expect(normalizedTagsColumn!.type).toBe('text');
      expect(normalizedTagsColumn!.isArray).toBe(true);
      expect(normalizedTagsColumn!.isNullable).toBe(false);

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

    it('should create optimized indexes for query patterns per PRD specifications', async () => {
      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: Should create 4 indexes as specified in PRD
      expect(mockCreateIndex).toHaveBeenCalledTimes(4);

      // Verify all calls are made with 'records' table
      const calls = mockCreateIndex.mock.calls;
      expect(calls[0][0]).toBe('records');
      expect(calls[1][0]).toBe('records');
      expect(calls[2][0]).toBe('records');
      expect(calls[3][0]).toBe('records');

      // Verify TableIndex objects are passed
      expect(calls[0][1]).toBeInstanceOf(TableIndex);
      expect(calls[1][1]).toBeInstanceOf(TableIndex);
      expect(calls[2][1]).toBeInstanceOf(TableIndex);
      expect(calls[3][1]).toBeInstanceOf(TableIndex);

      // Check for user_id index (for user data isolation)
      const userIdIndex = calls.find(
        (call) => (call[1] as TableIndex).name === 'IDX_records_user_id'
      );
      expect(userIdIndex).toBeDefined();

      // Check for normalized_tags GIN index (for PostgreSQL array search)
      const normalizedTagsIndex = calls.find(
        (call) =>
          (call[1] as TableIndex).name === 'IDX_records_normalized_tags_gin'
      );
      expect(normalizedTagsIndex).toBeDefined();

      // Check for created_at index (for chronological ordering)
      const createdAtIndex = calls.find(
        (call) => (call[1] as TableIndex).name === 'IDX_records_created_at'
      );
      expect(createdAtIndex).toBeDefined();

      // Check for composite index for common query patterns
      const compositeIndex = calls.find(
        (call) =>
          (call[1] as TableIndex).name === 'IDX_records_user_id_created_at'
      );
      expect(compositeIndex).toBeDefined();
    });

    it('should create foreign key constraint to users table', async () => {
      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: Should create foreign key for user_id
      expect(mockCreateForeignKey).toHaveBeenCalledTimes(1);

      const foreignKeyCall = mockCreateForeignKey.mock.calls[0];
      expect(foreignKeyCall[0]).toBe('records');
      expect(foreignKeyCall[1]).toBeInstanceOf(TableForeignKey);

      const foreignKey = foreignKeyCall[1] as TableForeignKey;
      expect(foreignKey.columnNames).toContain('user_id');
      expect(foreignKey.referencedTableName).toBe('users');
      expect(foreignKey.referencedColumnNames).toContain('id');
      expect(foreignKey.onDelete).toBe('CASCADE');
    });

    it('should create unique constraint for user content as per PRD', async () => {
      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: Check table creation includes unique constraint
      expect(mockCreateTable).toHaveBeenCalledTimes(1);

      const tableArg = mockCreateTable.mock.calls[0][0] as Table;
      const uniques = tableArg.uniques || [];

      // Check for unique constraint on user_id + normalized_tags per PRD
      const uniqueConstraint = uniques.find(
        (unique) => unique.name === 'UQ_records_user_normalized_tags'
      );
      expect(uniqueConstraint).toBeDefined();
      expect(uniqueConstraint!.columnNames).toEqual([
        'user_id',
        'normalized_tags',
      ]);
    });

    it('should call migration operations in correct order', async () => {
      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: Should create table, foreign key, and indexes in correct sequence
      expect(mockCreateTable).toHaveBeenCalledTimes(1);
      expect(mockCreateForeignKey).toHaveBeenCalledTimes(1);
      expect(mockCreateIndex).toHaveBeenCalledTimes(4);

      // Table creation should happen before foreign key and indexes
      const createTableCallOrder = mockCreateTable.mock.invocationCallOrder[0];
      const createForeignKeyCallOrder =
        mockCreateForeignKey.mock.invocationCallOrder[0];
      const firstIndexCallOrder = mockCreateIndex.mock.invocationCallOrder[0];

      expect(createTableCallOrder).toBeLessThan(createForeignKeyCallOrder);
      expect(createTableCallOrder).toBeLessThan(firstIndexCallOrder);
    });
  });

  describe('Migration Rollback', () => {
    it('should drop the table, foreign key, and all indexes on rollback', async () => {
      // Act: Run rollback
      await migration.down(queryRunner);

      // Assert: Should drop indexes, foreign key, then table
      expect(mockDropIndex).toHaveBeenCalledTimes(4);
      expect(mockDropForeignKey).toHaveBeenCalledTimes(1);
      expect(mockDropTable).toHaveBeenCalledTimes(1);

      // Check index drops in reverse order
      expect(mockDropIndex).toHaveBeenCalledWith(
        'records',
        'IDX_records_user_id_created_at'
      );
      expect(mockDropIndex).toHaveBeenCalledWith(
        'records',
        'IDX_records_created_at'
      );
      expect(mockDropIndex).toHaveBeenCalledWith(
        'records',
        'IDX_records_normalized_tags_gin'
      );
      expect(mockDropIndex).toHaveBeenCalledWith(
        'records',
        'IDX_records_user_id'
      );

      // Check foreign key drop
      expect(mockDropForeignKey).toHaveBeenCalledWith(
        'records',
        'FK_records_user_id'
      );

      // Check table drop
      expect(mockDropTable).toHaveBeenCalledWith('records');

      // Should drop dependencies before table
      const firstDropIndexCallOrder = mockDropIndex.mock.invocationCallOrder[0];
      const dropForeignKeyCallOrder =
        mockDropForeignKey.mock.invocationCallOrder[0];
      const dropTableCallOrder = mockDropTable.mock.invocationCallOrder[0];

      expect(firstDropIndexCallOrder).toBeLessThan(dropTableCallOrder);
      expect(dropForeignKeyCallOrder).toBeLessThan(dropTableCallOrder);
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

    it('should handle foreign key creation failure gracefully', async () => {
      // Mock a failure during foreign key creation
      mockCreateForeignKey.mockRejectedValue(new Error('Foreign key error'));

      // Act & Assert: Migration should fail
      await expect(migration.up(queryRunner)).rejects.toThrow(
        'Foreign key error'
      );
    });
  });

  describe('Migration Structure Validation', () => {
    it('should have correct table name', async () => {
      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: Table name should be "records"
      const tableArg = mockCreateTable.mock.calls[0][0] as Table;
      expect(tableArg.name).toBe('records');
    });

    it('should have all required unique constraints for PRD compliance', async () => {
      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: Should have unique constraint for preventing duplicate content per user
      const tableArg = mockCreateTable.mock.calls[0][0] as Table;
      const uniques = tableArg.uniques || [];
      expect(uniques).toHaveLength(1);

      const constraintNames = uniques.map((unique) => unique.name);
      expect(constraintNames).toContain('UQ_records_user_normalized_tags');
    });

    it('should have correct column types and properties for PRD requirements', async () => {
      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: Verify specific column properties match PRD
      const tableArg = mockCreateTable.mock.calls[0][0] as Table;
      const columns = tableArg.columns;

      // Should have exactly 7 columns as per PRD
      expect(columns).toHaveLength(7);

      // All columns should have proper names
      const columnNames = columns.map((col) => col.name);
      expect(columnNames).toEqual([
        'id',
        'user_id',
        'content',
        'tags',
        'normalized_tags',
        'created_at',
        'updated_at',
      ]);
    });

    it('should support PostgreSQL-specific features for tag search', async () => {
      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: Verify GIN index is created for normalized_tags array search
      const indexCalls = mockCreateIndex.mock.calls;
      const ginIndexCall = indexCalls.find(
        (call) =>
          (call[1] as TableIndex).name === 'IDX_records_normalized_tags_gin'
      );

      expect(ginIndexCall).toBeDefined();
      const ginIndex = ginIndexCall![1] as TableIndex;
      expect(ginIndex.columnNames).toContain('normalized_tags');
    });
  });

  describe('Data Isolation Requirements', () => {
    it('should ensure user data isolation through foreign key constraint', async () => {
      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: Foreign key should enforce referential integrity
      const foreignKeyCall = mockCreateForeignKey.mock.calls[0];
      const foreignKey = foreignKeyCall[1] as TableForeignKey;

      expect(foreignKey.onDelete).toBe('CASCADE');
      expect(foreignKey.onUpdate).toBe('CASCADE');
    });

    it('should create indexes to support efficient user data queries', async () => {
      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: User ID index should exist for data isolation
      const indexCalls = mockCreateIndex.mock.calls;
      const userIdIndex = indexCalls.find(
        (call) => (call[1] as TableIndex).name === 'IDX_records_user_id'
      );

      expect(userIdIndex).toBeDefined();
      const index = userIdIndex![1] as TableIndex;
      expect(index.columnNames).toContain('user_id');
    });
  });
});
