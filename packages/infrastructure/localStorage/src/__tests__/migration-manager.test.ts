import { MigrationManager } from '../migration-manager';
import { StorageManager } from '../storage-manager';
import { StorageSchema } from '../storage-schema';
import type {
  StorageSchemaV21,
  LegacyStorageSchemaV20,
} from '../storage-schema';

// Mock StorageManager
jest.mock('../storage-manager');

describe('MigrationManager', () => {
  let migrationManager: MigrationManager;
  let mockStorageManager: jest.Mocked<StorageManager>;

  beforeEach(() => {
    mockStorageManager = {
      load: jest.fn(),
      save: jest.fn(),
      createBackup: jest.fn(),
      restoreFromBackup: jest.fn(),
      verifyIntegrity: jest.fn(),
    } as any;

    migrationManager = new MigrationManager(mockStorageManager, false);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Version Detection', () => {
    it('should detect current version from valid v2.1 schema', async () => {
      const currentSchema: StorageSchemaV21 = {
        version: '2.1',
        tags: {},
        records: {},
        indexes: { normalizedToTagId: {}, tagToRecords: {} },
      };
      mockStorageManager.load.mockResolvedValue(currentSchema);

      const version = await migrationManager.getCurrentVersion();

      expect(version).toBe('2.1');
    });

    it('should detect legacy version from v2.0 schema', async () => {
      const legacySchema: LegacyStorageSchemaV20 = {
        version: '2.0',
        tags: [],
        records: [],
      };
      mockStorageManager.load.mockResolvedValue(legacySchema as any);

      const version = await migrationManager.getCurrentVersion();

      expect(version).toBe('2.0');
    });

    it('should return null for unrecognized schema', async () => {
      const invalidSchema = { version: '1.0', data: [] };
      mockStorageManager.load.mockResolvedValue(invalidSchema as any);

      const version = await migrationManager.getCurrentVersion();

      expect(version).toBeNull();
    });

    it('should return null for empty/missing schema', async () => {
      mockStorageManager.load.mockResolvedValue(StorageSchema.createEmpty());

      const version = await migrationManager.getCurrentVersion();

      expect(version).toBe('2.1');
    });
  });

  describe('Migration Scripts Registration', () => {
    it('should register migration scripts', () => {
      const mockMigration = jest.fn();

      expect(() =>
        migrationManager.registerMigration('2.0', '2.1', mockMigration)
      ).not.toThrow();
    });

    it('should prevent duplicate migration script registration', () => {
      const mockMigration1 = jest.fn();
      const mockMigration2 = jest.fn();

      migrationManager.registerMigration('2.0', '2.1', mockMigration1);

      expect(() =>
        migrationManager.registerMigration('2.0', '2.1', mockMigration2)
      ).toThrow('Migration from 2.0 to 2.1 already registered');
    });

    it('should allow registration of different migration paths', () => {
      const mockMigration21to22 = jest.fn();
      const mockMigration22to23 = jest.fn();

      migrationManager.registerMigration('2.1', '2.2', mockMigration21to22);
      migrationManager.registerMigration('2.2', '2.3', mockMigration22to23);

      expect(() =>
        migrationManager.registerMigration('2.1', '2.2', mockMigration21to22)
      ).toThrow('Migration from 2.1 to 2.2 already registered');
    });
  });

  describe('Migration Execution', () => {
    it('should execute migration from v2.0 to v2.1 with backup', async () => {
      // Register built-in migration for this test
      migrationManager.registerMigration('2.0', '2.1', (schema) =>
        StorageSchema.migrate(schema)
      );
      const legacySchema: LegacyStorageSchemaV20 = {
        version: '2.0',
        tags: [
          { id: 'tag-1', normalizedValue: 'javascript' },
          { id: 'tag-2', normalizedValue: 'react' },
        ],
        records: [
          {
            id: 'record-1',
            content: 'javascript react',
            tagIds: ['tag-1', 'tag-2'],
            createdAt: '2023-01-01T00:00:00.000Z',
            updatedAt: '2023-01-01T00:00:00.000Z',
          },
        ],
      };

      const backupData = {
        timestamp: '2023-01-01T00:00:00.000Z',
        data: legacySchema as any,
      };

      mockStorageManager.load.mockResolvedValue(legacySchema as any);
      mockStorageManager.createBackup.mockResolvedValue(backupData);
      mockStorageManager.verifyIntegrity.mockResolvedValue(true);

      const result = await migrationManager.migrate();

      expect(result.success).toBe(true);
      expect(result.fromVersion).toBe('2.0');
      expect(result.toVersion).toBe('2.1');
      expect(result.backupCreated).toBe(true);
      expect(mockStorageManager.createBackup).toHaveBeenCalledTimes(1);
      expect(mockStorageManager.save).toHaveBeenCalledTimes(1);
    });

    it('should execute incremental migration through multiple versions', async () => {
      // Simulate schema with version 2.0 needing to migrate to 2.3
      const oldSchema = { version: '2.0', tags: [], records: [] };
      mockStorageManager.load.mockResolvedValue(oldSchema as any);
      mockStorageManager.createBackup.mockResolvedValue({
        timestamp: '2023-01-01T00:00:00.000Z',
        data: oldSchema as any,
      });
      mockStorageManager.verifyIntegrity.mockResolvedValue(true);

      const migration20to21 = jest.fn().mockReturnValue({
        version: '2.1',
        tags: {},
        records: {},
        indexes: { normalizedToTagId: {}, tagToRecords: {} },
      });
      const migration21to22 = jest.fn().mockReturnValue({
        version: '2.2',
        tags: {},
        records: {},
        indexes: { normalizedToTagId: {}, tagToRecords: {} },
        newField: 'added',
      });

      migrationManager.registerMigration('2.0', '2.1', migration20to21);
      migrationManager.registerMigration('2.1', '2.2', migration21to22);

      const result = await migrationManager.migrate('2.2');

      expect(result.success).toBe(true);
      expect(result.fromVersion).toBe('2.0');
      expect(result.toVersion).toBe('2.2');
      expect(migration20to21).toHaveBeenCalledTimes(1);
      expect(migration21to22).toHaveBeenCalledTimes(1);
    });

    it('should handle missing migration path gracefully', async () => {
      const unknownSchema = { version: '1.5', data: [] };
      mockStorageManager.load.mockResolvedValue(unknownSchema as any);

      const result = await migrationManager.migrate();

      expect(result.success).toBe(false);
      expect(result.error).toContain('No migration path found');
      expect(result.fromVersion).toBeNull(); // Unknown version returns null
      expect(result.toVersion).toBeNull();
    });

    it('should skip migration if already at target version', async () => {
      const currentSchema: StorageSchemaV21 = StorageSchema.createEmpty();
      mockStorageManager.load.mockResolvedValue(currentSchema);

      const result = await migrationManager.migrate();

      expect(result.success).toBe(true);
      expect(result.fromVersion).toBe('2.1');
      expect(result.toVersion).toBe('2.1');
      expect(result.backupCreated).toBe(false);
      expect(result.migrationSkipped).toBe(true);
    });
  });

  describe('Rollback Functionality', () => {
    it('should rollback to backup on migration failure', async () => {
      const legacySchema: LegacyStorageSchemaV20 = {
        version: '2.0',
        tags: [],
        records: [],
      };

      const backupData = {
        timestamp: '2023-01-01T00:00:00.000Z',
        data: legacySchema as any,
      };

      const failingMigration = jest.fn().mockImplementation(() => {
        throw new Error('Migration script failed');
      });

      mockStorageManager.load.mockResolvedValue(legacySchema as any);
      mockStorageManager.createBackup.mockResolvedValue(backupData);
      mockStorageManager.restoreFromBackup.mockResolvedValue(undefined);

      migrationManager.registerMigration('2.0', '2.1', failingMigration);

      const result = await migrationManager.migrate();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Migration script failed');
      expect(result.rolledBack).toBe(true);
      expect(mockStorageManager.restoreFromBackup).toHaveBeenCalledWith(
        backupData
      );
    });

    it('should handle rollback failure gracefully', async () => {
      const legacySchema: LegacyStorageSchemaV20 = {
        version: '2.0',
        tags: [],
        records: [],
      };

      const backupData = {
        timestamp: '2023-01-01T00:00:00.000Z',
        data: legacySchema as any,
      };

      const failingMigration = jest.fn().mockImplementation(() => {
        throw new Error('Migration script failed');
      });

      mockStorageManager.load.mockResolvedValue(legacySchema as any);
      mockStorageManager.createBackup.mockResolvedValue(backupData);
      mockStorageManager.restoreFromBackup.mockRejectedValue(
        new Error('Restore failed')
      );

      migrationManager.registerMigration('2.0', '2.1', failingMigration);

      const result = await migrationManager.migrate();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Migration script failed');
      expect(result.rolledBack).toBe(false);
      expect(result.rollbackError).toContain('Restore failed');
    });

    it('should manually rollback to specific backup', async () => {
      const backupData = {
        timestamp: '2023-01-01T00:00:00.000Z',
        data: StorageSchema.createEmpty(),
      };

      mockStorageManager.restoreFromBackup.mockResolvedValue(undefined);

      const result = await migrationManager.rollback(backupData);

      expect(result.success).toBe(true);
      expect(mockStorageManager.restoreFromBackup).toHaveBeenCalledWith(
        backupData
      );
    });
  });

  describe('Data Integrity Verification', () => {
    it('should verify data integrity after migration', async () => {
      migrationManager.registerMigration('2.0', '2.1', (schema) =>
        StorageSchema.migrate(schema)
      );
      const legacySchema: LegacyStorageSchemaV20 = {
        version: '2.0',
        tags: [],
        records: [],
      };

      mockStorageManager.load.mockResolvedValue(legacySchema as any);
      mockStorageManager.createBackup.mockResolvedValue({
        timestamp: '2023-01-01T00:00:00.000Z',
        data: legacySchema as any,
      });
      mockStorageManager.verifyIntegrity.mockResolvedValue(true);

      const result = await migrationManager.migrate();

      expect(result.success).toBe(true);
      expect(result.integrityVerified).toBe(true);
      expect(mockStorageManager.verifyIntegrity).toHaveBeenCalledTimes(1);
    });

    it('should handle integrity verification failure', async () => {
      migrationManager.registerMigration('2.0', '2.1', (schema) =>
        StorageSchema.migrate(schema)
      );
      const legacySchema: LegacyStorageSchemaV20 = {
        version: '2.0',
        tags: [],
        records: [],
      };

      const backupData = {
        timestamp: '2023-01-01T00:00:00.000Z',
        data: legacySchema as any,
      };

      mockStorageManager.load.mockResolvedValue(legacySchema as any);
      mockStorageManager.createBackup.mockResolvedValue(backupData);
      mockStorageManager.verifyIntegrity.mockResolvedValue(false);
      mockStorageManager.restoreFromBackup.mockResolvedValue(undefined);

      const result = await migrationManager.migrate();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Data integrity verification failed');
      expect(result.integrityVerified).toBe(false);
      expect(result.rolledBack).toBe(true);
    });
  });

  describe('Migration History', () => {
    it('should track migration history', async () => {
      migrationManager.registerMigration('2.0', '2.1', (schema) =>
        StorageSchema.migrate(schema)
      );
      const legacySchema: LegacyStorageSchemaV20 = {
        version: '2.0',
        tags: [],
        records: [],
      };

      mockStorageManager.load.mockResolvedValue(legacySchema as any);
      mockStorageManager.createBackup.mockResolvedValue({
        timestamp: '2023-01-01T00:00:00.000Z',
        data: legacySchema as any,
      });
      mockStorageManager.verifyIntegrity.mockResolvedValue(true);

      await migrationManager.migrate();

      const history = migrationManager.getMigrationHistory();
      expect(history).toHaveLength(1);
      expect(history[0].fromVersion).toBe('2.0');
      expect(history[0].toVersion).toBe('2.1');
      expect(history[0].success).toBe(true);
      expect(history[0].timestamp).toBeDefined();
    });

    it('should limit migration history to prevent memory bloat', async () => {
      const legacySchema: LegacyStorageSchemaV20 = {
        version: '2.0',
        tags: [],
        records: [],
      };

      mockStorageManager.load.mockResolvedValue(legacySchema as any);
      mockStorageManager.createBackup.mockResolvedValue({
        timestamp: '2023-01-01T00:00:00.000Z',
        data: legacySchema as any,
      });
      mockStorageManager.verifyIntegrity.mockResolvedValue(true);

      // Execute many migrations to test history limit
      for (let i = 0; i < 15; i++) {
        await migrationManager.migrate();
      }

      const history = migrationManager.getMigrationHistory();
      expect(history).toHaveLength(10); // Should be limited to 10 entries
    });
  });

  describe('Error Handling', () => {
    it('should handle storage manager errors during migration', async () => {
      mockStorageManager.load.mockRejectedValue(
        new Error('Storage load failed')
      );

      const result = await migrationManager.migrate();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Storage load failed');
    });

    it('should handle backup creation failure', async () => {
      migrationManager.registerMigration('2.0', '2.1', (schema) =>
        StorageSchema.migrate(schema)
      );
      const legacySchema: LegacyStorageSchemaV20 = {
        version: '2.0',
        tags: [],
        records: [],
      };

      mockStorageManager.load.mockResolvedValue(legacySchema as any);
      mockStorageManager.createBackup.mockRejectedValue(
        new Error('Backup failed')
      );

      const result = await migrationManager.migrate();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Backup failed');
      expect(result.backupCreated).toBe(false);
    });

    it('should handle save operation failure', async () => {
      migrationManager.registerMigration('2.0', '2.1', (schema) =>
        StorageSchema.migrate(schema)
      );
      const legacySchema: LegacyStorageSchemaV20 = {
        version: '2.0',
        tags: [],
        records: [],
      };

      const backupData = {
        timestamp: '2023-01-01T00:00:00.000Z',
        data: legacySchema as any,
      };

      mockStorageManager.load.mockResolvedValue(legacySchema as any);
      mockStorageManager.createBackup.mockResolvedValue(backupData);
      mockStorageManager.save.mockRejectedValue(new Error('Save failed'));
      mockStorageManager.restoreFromBackup.mockResolvedValue(undefined);

      const result = await migrationManager.migrate();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Save failed');
      expect(result.rolledBack).toBe(true);
    });
  });

  describe('Full Migration Scenarios', () => {
    it('should perform complete migration from empty state', async () => {
      const emptySchema = StorageSchema.createEmpty();
      mockStorageManager.load.mockResolvedValue(emptySchema);

      const result = await migrationManager.migrate();

      expect(result.success).toBe(true);
      expect(result.migrationSkipped).toBe(true);
      expect(result.fromVersion).toBe('2.1');
      expect(result.toVersion).toBe('2.1');
    });

    it('should perform migration with data preservation', async () => {
      migrationManager.registerMigration('2.0', '2.1', (schema) =>
        StorageSchema.migrate(schema)
      );
      const legacySchemaWithData: LegacyStorageSchemaV20 = {
        version: '2.0',
        tags: [
          { id: 'tag-1', normalizedValue: 'javascript' },
          { id: 'tag-2', normalizedValue: 'react' },
        ],
        records: [
          {
            id: 'record-1',
            content: 'javascript react tutorial',
            tagIds: ['tag-1', 'tag-2'],
            createdAt: '2023-01-01T00:00:00.000Z',
            updatedAt: '2023-01-01T00:00:00.000Z',
          },
        ],
      };

      mockStorageManager.load.mockResolvedValue(legacySchemaWithData as any);
      mockStorageManager.createBackup.mockResolvedValue({
        timestamp: '2023-01-01T00:00:00.000Z',
        data: legacySchemaWithData as any,
      });
      mockStorageManager.verifyIntegrity.mockResolvedValue(true);

      const result = await migrationManager.migrate();

      expect(result.success).toBe(true);
      expect(result.fromVersion).toBe('2.0');
      expect(result.toVersion).toBe('2.1');

      // Verify that save was called with migrated data
      expect(mockStorageManager.save).toHaveBeenCalledTimes(1);
      const savedData = mockStorageManager.save.mock.calls[0][0];
      expect(savedData.version).toBe('2.1');
      expect(savedData.tags).toEqual({
        'tag-1': { id: 'tag-1', normalizedValue: 'javascript' },
        'tag-2': { id: 'tag-2', normalizedValue: 'react' },
      });
    });
  });
});
