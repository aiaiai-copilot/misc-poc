import { StorageManager } from '../storage-manager';
import { StorageSchema, type StorageSchemaV21 } from '../storage-schema';

// Mock localStorage
const localStorageMock = ((): Storage & {
  _getStore: () => Record<string, string>;
  _setStore: (newStore: Record<string, string>) => void;
} => {
  let store: Record<string, string> = {};

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length(): number {
      return Object.keys(store).length;
    },
    key: (index: number): string | null => {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
    // Helper method for testing
    _getStore: (): Record<string, string> => store,
    _setStore: (newStore: Record<string, string>): void => {
      store = newStore;
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('StorageManager', () => {
  let storageManager: StorageManager;
  const STORAGE_KEY = 'test-storage';

  beforeEach(() => {
    localStorageMock.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    storageManager = new StorageManager(STORAGE_KEY);
  });

  describe('initialization', () => {
    it('should create a new StorageManager with provided key', () => {
      expect(storageManager).toBeInstanceOf(StorageManager);
    });

    it('should initialize with empty schema when localStorage is empty', async () => {
      const schema = await storageManager.load();
      expect(schema).toEqual(StorageSchema.createEmpty());
    });

    it('should load existing valid schema from localStorage', async () => {
      const mockSchema = StorageSchema.createEmpty();
      mockSchema.tags['tag1'] = { id: 'tag1', normalizedValue: 'test' };
      localStorageMock.setItem(STORAGE_KEY, StorageSchema.toJSON(mockSchema));

      const schema = await storageManager.load();
      expect(schema).toEqual(mockSchema);
    });

    it('should migrate legacy schema v2.0 to v2.1', async () => {
      const legacySchema = {
        version: '2.0',
        tags: [{ id: 'tag1', normalizedValue: 'test' }],
        records: [
          {
            id: 'rec1',
            content: 'content',
            tagIds: ['tag1'],
            createdAt: '2023-01-01',
            updatedAt: '2023-01-01',
          },
        ],
      };
      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(legacySchema));

      const schema = await storageManager.load();
      expect(schema.version).toBe('2.1');
      expect(schema.tags['tag1']).toEqual({
        id: 'tag1',
        normalizedValue: 'test',
      });
      expect(schema.records['rec1']).toBeDefined();
      expect(schema.indexes.normalizedToTagId['test']).toBe('tag1');
      expect(schema.indexes.tagToRecords['tag1']).toEqual(['rec1']);
    });

    it('should handle corrupted JSON gracefully', async () => {
      localStorageMock.setItem(STORAGE_KEY, 'invalid-json');

      const schema = await storageManager.load();
      expect(schema).toEqual(StorageSchema.createEmpty());
    });
  });

  describe('save operations', () => {
    it('should save schema to localStorage', async () => {
      const schema = StorageSchema.createEmpty();
      schema.tags['tag1'] = { id: 'tag1', normalizedValue: 'test' };

      await storageManager.save(schema);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        StorageSchema.toJSON(schema)
      );
    });

    it('should handle save operation atomically', async () => {
      const schema = StorageSchema.createEmpty();
      let saveCallCount = 0;

      localStorageMock.setItem.mockImplementation(() => {
        saveCallCount++;
        if (saveCallCount === 1) {
          throw new Error('Storage error');
        }
      });

      await expect(storageManager.save(schema)).rejects.toThrow(
        'Storage error'
      );
      expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
    });
  });

  describe('quota monitoring', () => {
    it('should detect storage quota exceeded', async () => {
      const schema = StorageSchema.createEmpty();
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      await expect(storageManager.save(schema)).rejects.toThrow(
        'Storage quota exceeded'
      );
    });

    it('should provide quota usage information', async () => {
      const schema = StorageSchema.createEmpty();
      schema.tags['tag1'] = { id: 'tag1', normalizedValue: 'test' };

      // Clear any previous mock to avoid quota exceeded error
      localStorageMock.setItem.mockClear();
      localStorageMock.setItem.mockImplementation((key, value) => {
        localStorageMock._getStore()[key] = value;
      });

      await storageManager.save(schema);

      const usage = await storageManager.getQuotaUsage();
      expect(usage.used).toBeGreaterThan(0);
      expect(usage.available).toBeGreaterThan(0);
      expect(usage.total).toBe(usage.used + usage.available);
      expect(usage.percentage).toBeGreaterThan(0);
      expect(usage.percentage).toBeLessThanOrEqual(100);
    });

    it('should warn when approaching storage limits', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Clear any previous mock implementations
      localStorageMock.setItem.mockClear();
      localStorageMock.setItem.mockImplementation((key, value) => {
        localStorageMock._getStore()[key] = value;
      });

      // Mock high storage usage
      Object.defineProperty(storageManager, 'getQuotaUsage', {
        value: jest.fn().mockResolvedValue({
          used: 9000000,
          available: 1000000,
          total: 10000000,
          percentage: 90,
        }),
      });

      const schema = StorageSchema.createEmpty();
      await storageManager.save(schema);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Storage usage is high: 90')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should handle localStorage unavailable', async () => {
      // Mock localStorage as unavailable
      Object.defineProperty(window, 'localStorage', {
        get: () => {
          throw new Error('localStorage not available');
        },
        configurable: true,
      });

      const manager = new StorageManager(STORAGE_KEY);
      await expect(manager.load()).rejects.toThrow(
        'localStorage not available'
      );

      // Restore localStorage
      Object.defineProperty(window, 'localStorage', {
        value: localStorageMock,
        configurable: true,
      });
    });

    it('should handle storage errors during save operations', async () => {
      const schema = StorageSchema.createEmpty();
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage write error');
      });

      await expect(storageManager.save(schema)).rejects.toThrow(
        'Storage write error'
      );
    });

    it('should provide detailed error messages for different failure scenarios', async () => {
      // Test permission denied
      localStorageMock.setItem.mockImplementation(() => {
        const error = new Error('Permission denied');
        error.name = 'SecurityError';
        throw error;
      });

      const schema = StorageSchema.createEmpty();
      await expect(storageManager.save(schema)).rejects.toThrow(
        'Storage access denied: Permission denied'
      );
    });
  });

  describe('data integrity verification', () => {
    it('should verify schema integrity after load', async () => {
      // Reset mock to default behavior
      localStorageMock.setItem.mockClear();
      localStorageMock.setItem.mockImplementation((key, value) => {
        localStorageMock._getStore()[key] = value;
      });

      const validSchema = StorageSchema.createEmpty();
      validSchema.tags['tag1'] = { id: 'tag1', normalizedValue: 'test' };
      localStorageMock.setItem(STORAGE_KEY, StorageSchema.toJSON(validSchema));

      const loadedSchema = await storageManager.load();
      const isValid = await storageManager.verifyIntegrity(loadedSchema);

      expect(isValid).toBe(true);
    });

    it('should detect corrupted schema data', async () => {
      const corruptedSchema = {
        version: '2.1',
        tags: { tag1: { id: 'tag1', normalizedValue: 'test' } },
        records: {},
        indexes: {
          normalizedToTagId: { test: 'tag1' },
          tagToRecords: { tag1: ['non-existent-record'] }, // Corrupted: references non-existent record
        },
      } as StorageSchemaV21;

      const isValid = await storageManager.verifyIntegrity(corruptedSchema);
      expect(isValid).toBe(false);
    });

    it('should repair minor data inconsistencies', async () => {
      const inconsistentSchema = StorageSchema.createEmpty();
      inconsistentSchema.tags['tag1'] = { id: 'tag1', normalizedValue: 'test' };
      inconsistentSchema.records['rec1'] = {
        id: 'rec1',
        content: 'content',
        tagIds: ['tag1'],
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01',
      };
      // Missing index entries

      const repairedSchema =
        await storageManager.repairData(inconsistentSchema);

      expect(repairedSchema.indexes.normalizedToTagId['test']).toBe('tag1');
      expect(repairedSchema.indexes.tagToRecords['tag1']).toEqual(['rec1']);
    });
  });

  describe('backup and restore functionality', () => {
    it('should create a backup of current data', async () => {
      // Reset mock to default behavior
      localStorageMock.setItem.mockClear();
      localStorageMock.setItem.mockImplementation((key, value) => {
        localStorageMock._getStore()[key] = value;
      });

      const schema = StorageSchema.createEmpty();
      schema.tags['tag1'] = { id: 'tag1', normalizedValue: 'test' };
      await storageManager.save(schema);

      const backup = await storageManager.createBackup();

      expect(backup).toHaveProperty('timestamp');
      expect(backup).toHaveProperty('data');
      expect(backup.data).toEqual(schema);
      expect(new Date(backup.timestamp)).toBeInstanceOf(Date);
    });

    it('should restore data from backup', async () => {
      // Reset mock to default behavior
      localStorageMock.setItem.mockClear();
      localStorageMock.setItem.mockImplementation((key, value) => {
        localStorageMock._getStore()[key] = value;
      });

      const originalSchema = StorageSchema.createEmpty();
      originalSchema.tags['tag1'] = { id: 'tag1', normalizedValue: 'original' };
      await storageManager.save(originalSchema);

      const backup = await storageManager.createBackup();

      // Modify current data
      const modifiedSchema = StorageSchema.createEmpty();
      modifiedSchema.tags['tag2'] = { id: 'tag2', normalizedValue: 'modified' };
      await storageManager.save(modifiedSchema);

      // Restore from backup
      await storageManager.restoreFromBackup(backup);

      const restoredSchema = await storageManager.load();
      expect(restoredSchema).toEqual(originalSchema);
    });

    it('should validate backup data before restore', async () => {
      const invalidBackup = {
        timestamp: new Date().toISOString(),
        data: { invalid: 'data' } as any,
      };

      await expect(
        storageManager.restoreFromBackup(invalidBackup)
      ).rejects.toThrow(
        'Failed to restore backup: Invalid backup data structure'
      );
    });

    it('should maintain backup history', async () => {
      // Reset mock to default behavior and clear storage
      localStorageMock.clear();
      localStorageMock.setItem.mockClear();
      localStorageMock.setItem.mockImplementation((key, value) => {
        localStorageMock._getStore()[key] = value;
      });

      const schema1 = StorageSchema.createEmpty();
      schema1.tags['tag1'] = { id: 'tag1', normalizedValue: 'first' };
      await storageManager.save(schema1);
      const backup1 = await storageManager.createBackup();

      // Small delay to ensure unique Date.now() values
      await new Promise((resolve) => setTimeout(resolve, 2));

      const schema2 = StorageSchema.createEmpty();
      schema2.tags['tag2'] = { id: 'tag2', normalizedValue: 'second' };
      await storageManager.save(schema2);
      const backup2 = await storageManager.createBackup();

      const backups = await storageManager.getBackupHistory();

      expect(backups).toHaveLength(2);
      expect(backups[0].timestamp).toBe(backup2.timestamp);
      expect(backups[1].timestamp).toBe(backup1.timestamp);
    });

    it('should limit backup history size', async () => {
      // Reset mock to default behavior and clear storage
      localStorageMock.clear();
      localStorageMock.setItem.mockClear();
      localStorageMock.setItem.mockImplementation((key, value) => {
        localStorageMock._getStore()[key] = value;
      });

      // Create many backups with small delays to ensure unique timestamps
      for (let i = 0; i < 12; i++) {
        const schema = StorageSchema.createEmpty();
        schema.tags[`tag${i}`] = { id: `tag${i}`, normalizedValue: `test${i}` };
        await storageManager.save(schema);
        await storageManager.createBackup();
        // Small delay to ensure unique Date.now() values
        await new Promise((resolve) => setTimeout(resolve, 2));
      }

      const backups = await storageManager.getBackupHistory();
      expect(backups).toHaveLength(10); // Should limit to 10 backups
    });
  });

  describe('atomic operations simulation', () => {
    it('should simulate atomic save operations', async () => {
      const schema = StorageSchema.createEmpty();
      schema.tags['tag1'] = { id: 'tag1', normalizedValue: 'test' };

      // Mock partial failure during save
      let callCount = 0;
      localStorageMock.setItem.mockImplementation((key, value) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Simulated failure');
        }
        localStorageMock._getStore()[key] = value;
      });

      // Should rollback on failure
      await expect(storageManager.save(schema)).rejects.toThrow(
        'Simulated failure'
      );

      // Storage should remain unchanged
      const loadedSchema = await storageManager.load();
      expect(loadedSchema).toEqual(StorageSchema.createEmpty());
    });

    it('should handle concurrent save operations', async () => {
      // Reset mock to default behavior
      localStorageMock.setItem.mockClear();
      localStorageMock.setItem.mockImplementation((key, value) => {
        localStorageMock._getStore()[key] = value;
      });

      const schema1 = StorageSchema.createEmpty();
      schema1.tags['tag1'] = { id: 'tag1', normalizedValue: 'first' };

      const schema2 = StorageSchema.createEmpty();
      schema2.tags['tag2'] = { id: 'tag2', normalizedValue: 'second' };

      // Attempt concurrent saves - expect one to fail due to save lock
      const savePromises = [
        storageManager.save(schema1),
        storageManager.save(schema2).catch((e) => e), // Catch the expected error
      ];

      const results = await Promise.all(savePromises);

      // One should succeed, one should fail with save lock error
      expect(
        results.some(
          (r) =>
            r instanceof Error &&
            r.message.includes('Save operation already in progress')
        )
      ).toBe(true);

      // Check that one schema was saved
      const finalSchema = await storageManager.load();
      expect(
        finalSchema.tags['tag1'] || finalSchema.tags['tag2']
      ).toBeDefined();
    });
  });

  describe('performance monitoring', () => {
    it('should track operation performance metrics', async () => {
      // Reset mock to default behavior
      localStorageMock.setItem.mockClear();
      localStorageMock.setItem.mockImplementation((key, value) => {
        localStorageMock._getStore()[key] = value;
      });

      const schema = StorageSchema.createEmpty();
      const startTime = performance.now();

      await storageManager.save(schema);

      const metrics = storageManager.getPerformanceMetrics();
      expect(metrics.lastSaveTime).toBeGreaterThan(0);
      expect(metrics.averageSaveTime).toBeGreaterThan(0);
      expect(metrics.totalOperations).toBeGreaterThan(0);
    });

    it('should warn about slow operations', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Mock slow operation by making setItem synchronous but delay performance.now measurement
      const originalNow = performance.now;
      let callCount = 0;
      performance.now = jest.fn(() => {
        callCount++;
        if (callCount === 1) return 0; // start time
        if (callCount === 2) return 1100; // end time (1.1 seconds later)
        return originalNow.call(performance);
      });

      localStorageMock.setItem.mockImplementation((key, value) => {
        localStorageMock._getStore()[key] = value;
      });

      const schema = StorageSchema.createEmpty();
      await storageManager.save(schema);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Slow storage operation detected')
      );

      // Restore original functions
      performance.now = originalNow;
      consoleSpy.mockRestore();
    }, 10000); // Increase timeout for this test
  });

  describe('additional coverage tests', () => {
    it('should handle unrecognized schema version', async () => {
      const unrecognizedSchema = {
        version: '3.0', // Future version
        data: 'some data',
      };
      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(unrecognizedSchema));

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const schema = await storageManager.load();
      expect(schema).toEqual(StorageSchema.createEmpty());
      expect(consoleSpy).toHaveBeenCalledWith(
        'Unrecognized schema version, initializing with empty schema'
      );

      consoleSpy.mockRestore();
    });

    it('should handle invalid schema structure', async () => {
      const invalidSchema = {
        version: '2.1',
        // Missing required fields
        tags: null,
        records: null,
      };
      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(invalidSchema));

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const schema = await storageManager.load();
      expect(schema).toEqual(StorageSchema.createEmpty());
      expect(consoleSpy).toHaveBeenCalledWith(
        'Invalid schema structure, initializing with empty schema'
      );

      consoleSpy.mockRestore();
    });

    it('should handle unknown errors in load', async () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw 'string error'; // Non-Error object
      });

      await expect(storageManager.load()).rejects.toThrow(
        'Failed to load storage: Unknown error'
      );
    });

    it('should handle unknown errors in save', async () => {
      const schema = StorageSchema.createEmpty();
      localStorageMock.setItem.mockImplementation(() => {
        throw 'string error'; // Non-Error object
      });

      await expect(storageManager.save(schema)).rejects.toThrow(
        'Storage save failed: Unknown error'
      );
    });

    it('should handle quota calculation errors', async () => {
      // Mock localStorage.length to throw an error
      Object.defineProperty(localStorage, 'length', {
        get: () => {
          throw new Error('Access denied');
        },
        configurable: true,
      });

      const usage = await storageManager.getQuotaUsage();
      expect(usage).toEqual({
        used: 0,
        available: 5 * 1024 * 1024,
        total: 5 * 1024 * 1024,
        percentage: 0,
      });

      // Restore localStorage length
      Object.defineProperty(localStorage, 'length', {
        get: () => Object.keys(localStorageMock._getStore()).length,
        configurable: true,
      });
    });

    it('should handle verifyIntegrity errors', async () => {
      // Create a schema that will cause an error during verification
      const problematicSchema = {
        version: '2.1',
        tags: { tag1: { id: 'tag1', normalizedValue: 'test' } },
        records: {},
        indexes: {
          normalizedToTagId: {},
          tagToRecords: {},
        },
      } as StorageSchemaV21;

      // Mock Object.entries to throw an error
      const originalEntries = Object.entries;
      Object.entries = jest.fn().mockImplementation(() => {
        throw new Error('Mock error');
      });

      const isValid = await storageManager.verifyIntegrity(problematicSchema);
      expect(isValid).toBe(false);

      // Restore Object.entries
      Object.entries = originalEntries;
    });

    it('should handle backup creation errors with unknown error type', async () => {
      // Mock load to throw a non-Error object
      const originalLoad = storageManager.load;
      storageManager.load = jest.fn().mockRejectedValue('string error');

      await expect(storageManager.createBackup()).rejects.toThrow(
        'Failed to create backup: Unknown error'
      );

      // Restore original load
      storageManager.load = originalLoad;
    });

    it('should handle restore backup with invalid timestamp', async () => {
      const invalidBackup = {
        timestamp: 'invalid-timestamp',
        data: StorageSchema.createEmpty(),
      };

      await expect(
        storageManager.restoreFromBackup(invalidBackup)
      ).rejects.toThrow('Failed to restore backup: Invalid backup timestamp');
    });

    it('should handle restore backup errors with unknown error type', async () => {
      const validBackup = {
        timestamp: new Date().toISOString(),
        data: StorageSchema.createEmpty(),
      };

      // Mock save to throw a non-Error object
      const originalSave = storageManager.save;
      storageManager.save = jest.fn().mockRejectedValue('string error');

      await expect(
        storageManager.restoreFromBackup(validBackup)
      ).rejects.toThrow('Failed to restore backup: Unknown error');

      // Restore original save
      storageManager.save = originalSave;
    });

    it('should handle getBackupHistory with storage access errors', async () => {
      // Mock localStorage.length to throw
      Object.defineProperty(localStorage, 'length', {
        get: () => {
          throw new Error('Storage access error');
        },
        configurable: true,
      });

      const backups = await storageManager.getBackupHistory();
      expect(backups).toEqual([]);

      // Restore localStorage length
      Object.defineProperty(localStorage, 'length', {
        get: () => Object.keys(localStorageMock._getStore()).length,
        configurable: true,
      });
    });

    it('should detect integrity issues with invalid schema', async () => {
      const invalidSchema = {
        version: '2.1',
        tags: null,
        records: null,
        indexes: null,
      } as any;

      const isValid = await storageManager.verifyIntegrity(invalidSchema);
      expect(isValid).toBe(false);
    });

    it('should detect integrity issues with inconsistent normalized index', async () => {
      const inconsistentSchema: StorageSchemaV21 = {
        version: '2.1',
        tags: { tag1: { id: 'tag1', normalizedValue: 'correct' } },
        records: {},
        indexes: {
          normalizedToTagId: { wrong: 'tag1' }, // Inconsistent with tag's normalizedValue
          tagToRecords: {},
        },
      };

      const isValid = await storageManager.verifyIntegrity(inconsistentSchema);
      expect(isValid).toBe(false);
    });

    it('should detect integrity issues with missing tag in tagToRecords index', async () => {
      const inconsistentSchema: StorageSchemaV21 = {
        version: '2.1',
        tags: {},
        records: {},
        indexes: {
          normalizedToTagId: {},
          tagToRecords: { 'nonexistent-tag': ['record1'] }, // Tag doesn't exist
        },
      };

      const isValid = await storageManager.verifyIntegrity(inconsistentSchema);
      expect(isValid).toBe(false);
    });

    it('should detect integrity issues with records having invalid tag references', async () => {
      const inconsistentSchema: StorageSchemaV21 = {
        version: '2.1',
        tags: { tag1: { id: 'tag1', normalizedValue: 'test' } },
        records: {
          record1: {
            id: 'record1',
            content: 'content',
            tagIds: ['nonexistent-tag'], // Invalid tag reference
            createdAt: '2023-01-01',
            updatedAt: '2023-01-01',
          },
        },
        indexes: {
          normalizedToTagId: { test: 'tag1' },
          tagToRecords: { tag1: [] },
        },
      };

      const isValid = await storageManager.verifyIntegrity(inconsistentSchema);
      expect(isValid).toBe(false);
    });

    it('should handle backup creation errors with Error instance', async () => {
      // Mock load to throw an Error object
      const originalLoad = storageManager.load;
      storageManager.load = jest
        .fn()
        .mockRejectedValue(new Error('Load failed'));

      await expect(storageManager.createBackup()).rejects.toThrow(
        'Failed to create backup: Load failed'
      );

      // Restore original load
      storageManager.load = originalLoad;
    });
  });
});
