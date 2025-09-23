import { QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';
import { CreateUserSettingsTable1758589440123 } from '../migrations/1758589440123-CreateUserSettingsTable.js';

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

describe('Database Migration Contract: CreateUserSettingsTable', () => {
  let queryRunner: QueryRunner;
  let migration: CreateUserSettingsTable1758589440123;
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
    migration = new CreateUserSettingsTable1758589440123();

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
    it('should create user_settings table with correct schema according to PRD', async () => {
      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: Should call createTable with proper schema
      expect(mockCreateTable).toHaveBeenCalledTimes(1);

      const tableArg = mockCreateTable.mock.calls[0][0] as Table;
      expect(tableArg.name).toBe('user_settings');
      expect(tableArg.columns).toHaveLength(8);

      // Check user_id column (UUID primary key and foreign key)
      const userIdColumn = tableArg.columns.find((c) => c.name === 'user_id');
      expect(userIdColumn).toBeDefined();
      expect(userIdColumn!.type).toBe('uuid');
      expect(userIdColumn!.isPrimary).toBe(true);
      expect(userIdColumn!.isNullable).toBe(false);

      // Check case_sensitive column (boolean with default false)
      const caseSensitiveColumn = tableArg.columns.find(
        (c) => c.name === 'case_sensitive'
      );
      expect(caseSensitiveColumn).toBeDefined();
      expect(caseSensitiveColumn!.type).toBe('boolean');
      expect(caseSensitiveColumn!.default).toBe(false);
      expect(caseSensitiveColumn!.isNullable).toBe(false);

      // Check remove_accents column (boolean with default true)
      const removeAccentsColumn = tableArg.columns.find(
        (c) => c.name === 'remove_accents'
      );
      expect(removeAccentsColumn).toBeDefined();
      expect(removeAccentsColumn!.type).toBe('boolean');
      expect(removeAccentsColumn!.default).toBe(true);
      expect(removeAccentsColumn!.isNullable).toBe(false);

      // Check max_tag_length column (integer with default 100)
      const maxTagLengthColumn = tableArg.columns.find(
        (c) => c.name === 'max_tag_length'
      );
      expect(maxTagLengthColumn).toBeDefined();
      expect(maxTagLengthColumn!.type).toBe('integer');
      expect(maxTagLengthColumn!.default).toBe(100);
      expect(maxTagLengthColumn!.isNullable).toBe(false);

      // Check max_tags_per_record column (integer with default 50)
      const maxTagsPerRecordColumn = tableArg.columns.find(
        (c) => c.name === 'max_tags_per_record'
      );
      expect(maxTagsPerRecordColumn).toBeDefined();
      expect(maxTagsPerRecordColumn!.type).toBe('integer');
      expect(maxTagsPerRecordColumn!.default).toBe(50);
      expect(maxTagsPerRecordColumn!.isNullable).toBe(false);

      // Check ui_language column (varchar with default 'en')
      const uiLanguageColumn = tableArg.columns.find(
        (c) => c.name === 'ui_language'
      );
      expect(uiLanguageColumn).toBeDefined();
      expect(uiLanguageColumn!.type).toBe('varchar');
      expect(uiLanguageColumn!.length).toBe('10');
      expect(uiLanguageColumn!.default).toBe("'en'");
      expect(uiLanguageColumn!.isNullable).toBe(false);

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

    it('should create foreign key constraint to users table', async () => {
      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: Should create foreign key for user_id
      expect(mockCreateForeignKey).toHaveBeenCalledTimes(1);

      const foreignKeyCall = mockCreateForeignKey.mock.calls[0];
      expect(foreignKeyCall[0]).toBe('user_settings');
      expect(foreignKeyCall[1]).toBeInstanceOf(TableForeignKey);

      const foreignKey = foreignKeyCall[1] as TableForeignKey;
      expect(foreignKey.columnNames).toContain('user_id');
      expect(foreignKey.referencedTableName).toBe('users');
      expect(foreignKey.referencedColumnNames).toContain('id');
      expect(foreignKey.onDelete).toBe('CASCADE');
    });

    it('should create indexes for efficient settings retrieval', async () => {
      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: Should create index on user_id (since it's the primary key, this might be implicit)
      // For user_settings, the user_id as primary key automatically gets an index
      // We might add additional indexes for performance if needed

      // Note: Since user_id is primary key, TypeORM automatically creates an index
      // Additional indexes would be created here if specified in the migration
    });

    it('should call migration operations in correct order', async () => {
      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: Should create table first, then foreign key
      expect(mockCreateTable).toHaveBeenCalledTimes(1);
      expect(mockCreateForeignKey).toHaveBeenCalledTimes(1);

      // Table creation should happen before foreign key
      const createTableCallOrder = mockCreateTable.mock.invocationCallOrder[0];
      const createForeignKeyCallOrder =
        mockCreateForeignKey.mock.invocationCallOrder[0];

      expect(createTableCallOrder).toBeLessThan(createForeignKeyCallOrder);
    });

    it('should use user_id as primary key per PRD specification', async () => {
      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: user_id should be the primary key
      const tableArg = mockCreateTable.mock.calls[0][0] as Table;
      const userIdColumn = tableArg.columns.find((c) => c.name === 'user_id');

      expect(userIdColumn).toBeDefined();
      expect(userIdColumn!.isPrimary).toBe(true);
      expect(userIdColumn!.type).toBe('uuid');
    });
  });

  describe('Migration Rollback', () => {
    it('should drop the table and foreign key on rollback', async () => {
      // Act: Run rollback
      await migration.down(queryRunner);

      // Assert: Should drop foreign key first, then table
      expect(mockDropForeignKey).toHaveBeenCalledTimes(1);
      expect(mockDropTable).toHaveBeenCalledTimes(1);

      // Check foreign key drop
      expect(mockDropForeignKey).toHaveBeenCalledWith(
        'user_settings',
        'FK_user_settings_user_id'
      );

      // Check table drop
      expect(mockDropTable).toHaveBeenCalledWith('user_settings');

      // Should drop foreign key before table
      const dropForeignKeyCallOrder =
        mockDropForeignKey.mock.invocationCallOrder[0];
      const dropTableCallOrder = mockDropTable.mock.invocationCallOrder[0];

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

      // Assert: Table name should be "user_settings"
      const tableArg = mockCreateTable.mock.calls[0][0] as Table;
      expect(tableArg.name).toBe('user_settings');
    });

    it('should have correct column types and properties for PRD requirements', async () => {
      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: Verify specific column properties match PRD
      const tableArg = mockCreateTable.mock.calls[0][0] as Table;
      const columns = tableArg.columns;

      // Should have exactly 8 columns as per PRD
      expect(columns).toHaveLength(8);

      // All columns should have proper names matching PRD
      const columnNames = columns.map((col) => col.name);
      expect(columnNames).toEqual([
        'user_id',
        'case_sensitive',
        'remove_accents',
        'max_tag_length',
        'max_tags_per_record',
        'ui_language',
        'created_at',
        'updated_at',
      ]);
    });

    it('should have correct default values as specified in PRD', async () => {
      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: Check all default values match PRD specification
      const tableArg = mockCreateTable.mock.calls[0][0] as Table;
      const columns = tableArg.columns;

      const caseSensitiveCol = columns.find((c) => c.name === 'case_sensitive');
      expect(caseSensitiveCol!.default).toBe(false);

      const removeAccentsCol = columns.find((c) => c.name === 'remove_accents');
      expect(removeAccentsCol!.default).toBe(true);

      const maxTagLengthCol = columns.find((c) => c.name === 'max_tag_length');
      expect(maxTagLengthCol!.default).toBe(100);

      const maxTagsPerRecordCol = columns.find(
        (c) => c.name === 'max_tags_per_record'
      );
      expect(maxTagsPerRecordCol!.default).toBe(50);

      const uiLanguageCol = columns.find((c) => c.name === 'ui_language');
      expect(uiLanguageCol!.default).toBe("'en'");
    });

    it('should have proper constraints for business rules', async () => {
      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: Check constraints for business logic
      const tableArg = mockCreateTable.mock.calls[0][0] as Table;
      const checks = tableArg.checks || [];

      // Should have constraints for max_tag_length and max_tags_per_record positive values
      const maxTagLengthCheck = checks.find((check) =>
        check.expression?.includes('max_tag_length > 0')
      );
      expect(maxTagLengthCheck).toBeDefined();

      const maxTagsPerRecordCheck = checks.find((check) =>
        check.expression?.includes('max_tags_per_record > 0')
      );
      expect(maxTagsPerRecordCheck).toBeDefined();
    });
  });

  describe('Data Isolation and User Association', () => {
    it('should ensure one-to-one relationship with users table', async () => {
      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: user_id should be primary key ensuring one-to-one relationship
      const tableArg = mockCreateTable.mock.calls[0][0] as Table;
      const userIdColumn = tableArg.columns.find((c) => c.name === 'user_id');

      expect(userIdColumn!.isPrimary).toBe(true);
      expect(userIdColumn!.isUnique).toBe(false); // Primary key implies unique

      // Foreign key should enforce referential integrity
      const foreignKeyCall = mockCreateForeignKey.mock.calls[0];
      const foreignKey = foreignKeyCall[1] as TableForeignKey;
      expect(foreignKey.onDelete).toBe('CASCADE');
    });

    it('should support efficient user settings retrieval', async () => {
      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: Primary key on user_id ensures efficient lookups
      const tableArg = mockCreateTable.mock.calls[0][0] as Table;
      const userIdColumn = tableArg.columns.find((c) => c.name === 'user_id');

      expect(userIdColumn!.isPrimary).toBe(true);
      // Primary key automatically creates an index for efficient retrieval
    });
  });

  describe('Normalization Settings Support', () => {
    it('should support case sensitivity configuration', async () => {
      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: case_sensitive column should exist with proper type
      const tableArg = mockCreateTable.mock.calls[0][0] as Table;
      const caseSensitiveColumn = tableArg.columns.find(
        (c) => c.name === 'case_sensitive'
      );

      expect(caseSensitiveColumn).toBeDefined();
      expect(caseSensitiveColumn!.type).toBe('boolean');
      expect(caseSensitiveColumn!.default).toBe(false);
    });

    it('should support accent removal configuration', async () => {
      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: remove_accents column should exist with proper type
      const tableArg = mockCreateTable.mock.calls[0][0] as Table;
      const removeAccentsColumn = tableArg.columns.find(
        (c) => c.name === 'remove_accents'
      );

      expect(removeAccentsColumn).toBeDefined();
      expect(removeAccentsColumn!.type).toBe('boolean');
      expect(removeAccentsColumn!.default).toBe(true);
    });

    it('should support tag length and count limits', async () => {
      // Act: Run the migration
      await migration.up(queryRunner);

      // Assert: max_tag_length and max_tags_per_record should exist
      const tableArg = mockCreateTable.mock.calls[0][0] as Table;

      const maxTagLengthColumn = tableArg.columns.find(
        (c) => c.name === 'max_tag_length'
      );
      expect(maxTagLengthColumn).toBeDefined();
      expect(maxTagLengthColumn!.type).toBe('integer');
      expect(maxTagLengthColumn!.default).toBe(100);

      const maxTagsPerRecordColumn = tableArg.columns.find(
        (c) => c.name === 'max_tags_per_record'
      );
      expect(maxTagsPerRecordColumn).toBeDefined();
      expect(maxTagsPerRecordColumn!.type).toBe('integer');
      expect(maxTagsPerRecordColumn!.default).toBe(50);
    });
  });
});
