import { StorageManager } from '../storage-manager';
import { StorageSchema, StorageSchemaV21 } from '../storage-schema';
import { Result } from '@misc-poc/shared';

// Mock localStorage for testing
const mockLocalStorage = ((): any => {
  let store: Record<string, string> = {};
  let quota = 5 * 1024 * 1024; // 5MB default quota
  let usedSpace = 0;

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      const newSize =
        usedSpace - (store[key]?.length || 0) + key.length + value.length;
      if (newSize > quota) {
        throw new Error('QuotaExceededError');
      }
      store[key] = value;
      usedSpace = newSize;
    }),
    removeItem: jest.fn((key: string) => {
      if (store[key]) {
        usedSpace -= key.length + store[key].length;
        delete store[key];
      }
    }),
    clear: jest.fn(() => {
      store = {};
      usedSpace = 0;
    }),
    get length(): number {
      return Object.keys(store).length;
    },
    key: jest.fn(
      (index: number): string | null => Object.keys(store)[index] || null
    ),
    __setQuota: (newQuota: number): void => {
      quota = newQuota;
    },
    __getUsedSpace: (): number => usedSpace,
    __getStore: (): Record<string, string> => store,
  };
})();

// Replace global localStorage with mock
Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('StorageManager', () => {
  const storageKey = 'test-app-data';
  let storageManager: StorageManager;

  beforeEach(() => {
    mockLocalStorage.clear();
    mockLocalStorage.__setQuota(5 * 1024 * 1024); // Reset to default quota
    jest.clearAllMocks();
    storageManager = new StorageManager(storageKey);
  });

  describe('initialization', () => {
    it('should create manager with default storage key', () => {
      const manager = new StorageManager();
      expect(manager).toBeDefined();
    });

    it('should create manager with custom storage key', () => {
      const customKey = 'custom-app-data';
      const manager = new StorageManager(customKey);
      expect(manager).toBeDefined();
    });
  });

  describe('storage operations', () => {
    describe('load', () => {
      it('should return empty schema when localStorage is empty', async () => {
        const result = await storageManager.load();

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          const schema = result.unwrap();
          expect(schema.version).toBe('2.1');
          expect(schema.tags).toEqual({});
          expect(schema.records).toEqual({});
          expect(schema.indexes.normalizedToTagId).toEqual({});
          expect(schema.indexes.tagToRecords).toEqual({});
        }
      });

      it('should load valid schema from localStorage', async () => {
        const validSchema = StorageSchema.createEmpty();
        validSchema.tags['tag-1'] = {
          id: 'tag-1',
          normalizedValue: 'test-tag',
        };

        mockLocalStorage.setItem(storageKey, StorageSchema.toJSON(validSchema));

        const result = await storageManager.load();

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          const schema = result.unwrap();
          expect(schema.tags['tag-1']).toEqual({
            id: 'tag-1',
            normalizedValue: 'test-tag',
          });
        }
      });

      it('should migrate legacy schema when loading', async () => {
        const legacySchema = {
          version: '2.0',
          tags: [
            { id: 'tag-1', normalizedValue: 'javascript' },
            { id: 'tag-2', normalizedValue: 'typescript' },
          ],
          records: [
            {
              id: 'record-1',
              content: 'Test content',
              tagIds: ['tag-1'],
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ],
        };

        mockLocalStorage.setItem(storageKey, JSON.stringify(legacySchema));

        const result = await storageManager.load();

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          const schema = result.unwrap();
          expect(schema.version).toBe('2.1');
          expect(schema.tags['tag-1']).toEqual({
            id: 'tag-1',
            normalizedValue: 'javascript',
          });
          expect(schema.indexes.normalizedToTagId.javascript).toBe('tag-1');
        }
      });

      it('should handle corrupted JSON gracefully', async () => {
        mockLocalStorage.setItem(storageKey, 'invalid json {');

        const result = await storageManager.load();

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.unwrapErr()).toContain('Failed to parse storage data');
        }
      });

      it('should handle localStorage access errors', async () => {
        const originalGetItem = mockLocalStorage.getItem;
        mockLocalStorage.getItem.mockImplementationOnce(() => {
          throw new Error('SecurityError: Access denied');
        });

        const result = await storageManager.load();

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.unwrapErr()).toContain('Failed to access localStorage');
        }

        mockLocalStorage.getItem.mockImplementation(originalGetItem);
      });
    });

    describe('save', () => {
      it('should save schema to localStorage', async () => {
        const schema = StorageSchema.createEmpty();
        schema.tags['tag-1'] = {
          id: 'tag-1',
          normalizedValue: 'test-tag',
        };

        const result = await storageManager.save(schema);

        expect(result.isOk()).toBe(true);
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          storageKey,
          StorageSchema.toJSON(schema)
        );
      });

      it('should handle quota exceeded errors', async () => {
        const schema = StorageSchema.createEmpty();
        // Create a large schema that exceeds quota
        for (let i = 0; i < 1000; i++) {
          schema.records[`record-${i}`] = {
            id: `record-${i}`,
            content: 'A'.repeat(10000), // Large content
            tagIds: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }

        // Set a small quota
        mockLocalStorage.__setQuota(1000);

        const result = await storageManager.save(schema);

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.unwrapErr()).toContain('Storage quota exceeded');
        }
      });

      it('should handle localStorage access errors during save', async () => {
        const schema = StorageSchema.createEmpty();
        const originalSetItem = mockLocalStorage.setItem;
        mockLocalStorage.setItem.mockImplementationOnce(() => {
          throw new Error('SecurityError: Access denied');
        });

        const result = await storageManager.save(schema);

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.unwrapErr()).toContain(
            'Failed to save to localStorage'
          );
        }

        mockLocalStorage.setItem.mockImplementation(originalSetItem);
      });
    });

    describe('clear', () => {
      it('should clear storage data', async () => {
        const schema = StorageSchema.createEmpty();
        await storageManager.save(schema);

        const result = await storageManager.clear();

        expect(result.isOk()).toBe(true);
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(storageKey);
      });

      it('should handle localStorage access errors during clear', async () => {
        const originalRemoveItem = mockLocalStorage.removeItem;
        mockLocalStorage.removeItem.mockImplementationOnce(() => {
          throw new Error('SecurityError: Access denied');
        });

        const result = await storageManager.clear();

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.unwrapErr()).toContain('Failed to clear localStorage');
        }

        mockLocalStorage.removeItem.mockImplementation(originalRemoveItem);
      });
    });
  });

  describe('quota monitoring', () => {
    describe('getQuotaInfo', () => {
      it('should return quota information when storage is empty', async () => {
        const result = await storageManager.getQuotaInfo();

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          const info = result.unwrap();
          expect(info.used).toBe(0);
          expect(info.available).toBeGreaterThan(0);
          expect(info.total).toBeGreaterThan(0);
          expect(info.percentUsed).toBe(0);
        }
      });

      it('should return accurate quota information with data', async () => {
        const schema = StorageSchema.createEmpty();
        schema.tags['tag-1'] = {
          id: 'tag-1',
          normalizedValue: 'test-tag',
        };

        const saveResult = await storageManager.save(schema);
        expect(saveResult.isOk()).toBe(true);

        const result = await storageManager.getQuotaInfo();

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          const info = result.unwrap();
          expect(info.used).toBeGreaterThan(0);
          expect(info.available).toBeGreaterThan(0);
          expect(info.percentUsed).toBeGreaterThan(0);
          expect(info.percentUsed).toBeLessThan(100);
        }
      });

      it('should handle localStorage access errors during quota check', async () => {
        const originalSetItem = mockLocalStorage.setItem;
        let callCount = 0;
        mockLocalStorage.setItem.mockImplementation(
          (key: string, value: string) => {
            callCount++;
            if (callCount === 1) {
              throw new Error('SecurityError: Access denied');
            }
            return originalSetItem(key, value);
          }
        );

        const result = await storageManager.getQuotaInfo();

        expect(result.isOk()).toBe(true); // Should fallback to default quota
        if (result.isOk()) {
          const info = result.unwrap();
          expect(info.total).toBeGreaterThan(0); // Should use fallback quota
        }

        mockLocalStorage.setItem.mockImplementation(originalSetItem);
      });
    });

    describe('isQuotaAvailable', () => {
      it('should return true when quota is available', async () => {
        const schema = StorageSchema.createEmpty();
        const result = await storageManager.isQuotaAvailable(schema);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.unwrap()).toBe(true);
        }
      });

      it('should return false when quota would be exceeded', async () => {
        // Set a very small quota
        mockLocalStorage.__setQuota(100);

        const schema = StorageSchema.createEmpty();
        // Add data that exceeds quota
        schema.records['large-record'] = {
          id: 'large-record',
          content: 'A'.repeat(1000),
          tagIds: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const result = await storageManager.isQuotaAvailable(schema);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.unwrap()).toBe(false);
        }

        // Reset quota for other tests
        mockLocalStorage.__setQuota(5 * 1024 * 1024);
      });
    });
  });

  describe('data integrity', () => {
    describe('validateIntegrity', () => {
      it('should validate correct schema structure', async () => {
        const schema = StorageSchema.createEmpty();
        schema.tags['tag-1'] = {
          id: 'tag-1',
          normalizedValue: 'test-tag',
        };
        schema.indexes.normalizedToTagId['test-tag'] = 'tag-1';

        const result = await storageManager.validateIntegrity(schema);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          const issues = result.unwrap();
          expect(issues).toEqual([]);
        }
      });

      it('should detect missing tag in normalizedToTagId index', async () => {
        const schema = StorageSchema.createEmpty();
        schema.tags['tag-1'] = {
          id: 'tag-1',
          normalizedValue: 'test-tag',
        };
        // Missing index entry

        const result = await storageManager.validateIntegrity(schema);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          const issues = result.unwrap();
          expect(issues).toHaveLength(1);
          expect(issues[0]).toContain('normalizedToTagId index missing entry');
        }
      });

      it('should detect orphaned entries in indexes', async () => {
        const schema = StorageSchema.createEmpty();
        schema.indexes.normalizedToTagId['test-tag'] = 'non-existent-tag';

        const result = await storageManager.validateIntegrity(schema);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          const issues = result.unwrap();
          expect(issues).toHaveLength(1);
          expect(issues[0]).toContain(
            'normalizedToTagId index references non-existent tag'
          );
        }
      });

      it('should detect record referencing non-existent tags', async () => {
        const schema = StorageSchema.createEmpty();
        schema.records['record-1'] = {
          id: 'record-1',
          content: 'Test content',
          tagIds: ['non-existent-tag'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const result = await storageManager.validateIntegrity(schema);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          const issues = result.unwrap();
          expect(issues).toHaveLength(1);
          expect(issues[0]).toContain(
            'Record record-1 references non-existent tag'
          );
        }
      });

      it('should detect missing record in tagToRecords index', async () => {
        const schema = StorageSchema.createEmpty();
        schema.tags['tag-1'] = {
          id: 'tag-1',
          normalizedValue: 'test-tag',
        };
        schema.records['record-1'] = {
          id: 'record-1',
          content: 'Test content',
          tagIds: ['tag-1'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        schema.indexes.normalizedToTagId['test-tag'] = 'tag-1';
        // Missing tagToRecords index entry

        const result = await storageManager.validateIntegrity(schema);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          const issues = result.unwrap();
          expect(issues).toHaveLength(1);
          expect(issues[0]).toContain('tagToRecords index missing record');
        }
      });
    });

    describe('repairData', () => {
      it('should repair missing normalizedToTagId index entries', async () => {
        const schema = StorageSchema.createEmpty();
        schema.tags['tag-1'] = {
          id: 'tag-1',
          normalizedValue: 'test-tag',
        };

        const result = await storageManager.repairData(schema);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          const repairedSchema = result.unwrap();
          expect(repairedSchema.indexes.normalizedToTagId['test-tag']).toBe(
            'tag-1'
          );
        }
      });

      it('should remove orphaned index entries', async () => {
        const schema = StorageSchema.createEmpty();
        schema.indexes.normalizedToTagId['orphaned-tag'] = 'non-existent-tag';

        const result = await storageManager.repairData(schema);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          const repairedSchema = result.unwrap();
          expect(
            repairedSchema.indexes.normalizedToTagId['orphaned-tag']
          ).toBeUndefined();
        }
      });

      it('should rebuild tagToRecords index', async () => {
        const schema = StorageSchema.createEmpty();
        schema.tags['tag-1'] = {
          id: 'tag-1',
          normalizedValue: 'test-tag',
        };
        schema.records['record-1'] = {
          id: 'record-1',
          content: 'Test content',
          tagIds: ['tag-1'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        schema.indexes.normalizedToTagId['test-tag'] = 'tag-1';

        const result = await storageManager.repairData(schema);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          const repairedSchema = result.unwrap();
          expect(repairedSchema.indexes.tagToRecords['tag-1']).toEqual([
            'record-1',
          ]);
        }
      });
    });
  });

  describe('backup and restore', () => {
    describe('createBackup', () => {
      it('should create backup of current data', async () => {
        const schema = StorageSchema.createEmpty();
        schema.tags['tag-1'] = {
          id: 'tag-1',
          normalizedValue: 'test-tag',
        };

        const saveResult = await storageManager.save(schema);
        expect(saveResult.isOk()).toBe(true);

        const result = await storageManager.createBackup();

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          const backupKey = result.unwrap();
          expect(backupKey).toContain('backup');
          expect(backupKey).toContain(storageKey);
        }
      });

      it('should handle backup creation errors', async () => {
        // First save some data
        const schema = StorageSchema.createEmpty();
        const saveResult = await storageManager.save(schema);
        expect(saveResult.isOk()).toBe(true);

        const originalSetItem = mockLocalStorage.setItem;
        mockLocalStorage.setItem.mockImplementation(
          (key: string, value: string) => {
            if (key.includes('backup')) {
              throw new Error('QuotaExceededError');
            }
            return originalSetItem(key, value);
          }
        );

        const result = await storageManager.createBackup();

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.unwrapErr()).toContain('Failed to create backup');
        }

        mockLocalStorage.setItem.mockImplementation(originalSetItem);
      });
    });

    describe('restoreFromBackup', () => {
      it('should restore data from backup', async () => {
        const schema = StorageSchema.createEmpty();
        schema.tags['original-tag'] = {
          id: 'original-tag',
          normalizedValue: 'original',
        };

        await storageManager.save(schema);
        const backupResult = await storageManager.createBackup();

        expect(backupResult.isOk()).toBe(true);
        if (backupResult.isOk()) {
          const backupKey = backupResult.unwrap();

          // Modify current data
          const modifiedSchema = StorageSchema.createEmpty();
          modifiedSchema.tags['modified-tag'] = {
            id: 'modified-tag',
            normalizedValue: 'modified',
          };
          await storageManager.save(modifiedSchema);

          // Restore from backup
          const restoreResult =
            await storageManager.restoreFromBackup(backupKey);

          expect(restoreResult.isOk()).toBe(true);

          // Verify restoration
          const loadResult = await storageManager.load();
          expect(loadResult.isOk()).toBe(true);
          if (loadResult.isOk()) {
            const restoredSchema = loadResult.unwrap();
            expect(restoredSchema.tags['original-tag']).toBeDefined();
            expect(restoredSchema.tags['modified-tag']).toBeUndefined();
          }
        }
      });

      it('should handle missing backup gracefully', async () => {
        const result = await storageManager.restoreFromBackup(
          'non-existent-backup'
        );

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.unwrapErr()).toContain('Backup not found');
        }
      });

      it('should handle restore errors', async () => {
        const schema = StorageSchema.createEmpty();
        await storageManager.save(schema);
        const backupResult = await storageManager.createBackup();

        expect(backupResult.isOk()).toBe(true);
        if (backupResult.isOk()) {
          const backupKey = backupResult.unwrap();

          const originalSetItem = mockLocalStorage.setItem;
          mockLocalStorage.setItem.mockImplementation((key: string) => {
            if (key === storageKey) {
              throw new Error('QuotaExceededError');
            }
            return originalSetItem(key);
          });

          const result = await storageManager.restoreFromBackup(backupKey);

          expect(result.isErr()).toBe(true);
          if (result.isErr()) {
            expect(result.unwrapErr()).toContain(
              'Failed to restore from backup'
            );
          }

          mockLocalStorage.setItem.mockImplementation(originalSetItem);
        }
      });
    });

    describe('listBackups', () => {
      it('should list available backups', async () => {
        const schema = StorageSchema.createEmpty();
        await storageManager.save(schema);

        const backup1Result = await storageManager.createBackup();
        const backup2Result = await storageManager.createBackup();

        expect(backup1Result.isOk()).toBe(true);
        expect(backup2Result.isOk()).toBe(true);

        const result = await storageManager.listBackups();

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          const backups = result.unwrap();
          expect(backups).toHaveLength(2);
          expect(backups.every((backup) => backup.key.includes('backup'))).toBe(
            true
          );
          expect(backups.every((backup) => backup.timestamp)).toBe(true);
          expect(backups.every((backup) => backup.size > 0)).toBe(true);
        }
      });

      it('should return empty list when no backups exist', async () => {
        const result = await storageManager.listBackups();

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          const backups = result.unwrap();
          expect(backups).toEqual([]);
        }
      });
    });

    describe('deleteBackup', () => {
      it('should delete specific backup', async () => {
        const schema = StorageSchema.createEmpty();
        await storageManager.save(schema);

        const backupResult = await storageManager.createBackup();
        expect(backupResult.isOk()).toBe(true);

        if (backupResult.isOk()) {
          const backupKey = backupResult.unwrap();
          const deleteResult = await storageManager.deleteBackup(backupKey);

          expect(deleteResult.isOk()).toBe(true);

          // Verify backup was deleted
          const listResult = await storageManager.listBackups();
          expect(listResult.isOk()).toBe(true);
          if (listResult.isOk()) {
            const backups = listResult.unwrap();
            expect(backups.find((b) => b.key === backupKey)).toBeUndefined();
          }
        }
      });

      it('should handle deletion of non-existent backup gracefully', async () => {
        const result = await storageManager.deleteBackup('non-existent-backup');

        expect(result.isOk()).toBe(true); // Should not error for non-existent backup
      });
    });
  });

  describe('atomic operations', () => {
    describe('atomicUpdate', () => {
      it('should perform atomic update successfully', async () => {
        const initialSchema = StorageSchema.createEmpty();
        initialSchema.tags['tag-1'] = {
          id: 'tag-1',
          normalizedValue: 'initial',
        };

        await storageManager.save(initialSchema);

        const result = await storageManager.atomicUpdate(async (schema) => {
          schema.tags['tag-2'] = {
            id: 'tag-2',
            normalizedValue: 'updated',
          };
          return { isOk: () => true, unwrap: () => schema } as Result<
            StorageSchemaV21,
            string
          >;
        });

        expect(result.isOk()).toBe(true);

        // Verify update was applied
        const loadResult = await storageManager.load();
        expect(loadResult.isOk()).toBe(true);
        if (loadResult.isOk()) {
          const schema = loadResult.unwrap();
          expect(schema.tags['tag-1']).toBeDefined();
          expect(schema.tags['tag-2']).toBeDefined();
        }
      });

      it('should rollback on update function error', async () => {
        const initialSchema = StorageSchema.createEmpty();
        initialSchema.tags['tag-1'] = {
          id: 'tag-1',
          normalizedValue: 'initial',
        };

        await storageManager.save(initialSchema);

        const result = await storageManager.atomicUpdate(async () => {
          return {
            isOk: () => false,
            unwrapErr: () => 'Update failed',
          } as Result<StorageSchemaV21, string>;
        });

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.unwrapErr()).toContain('Update failed');
        }

        // Verify original data is intact
        const loadResult = await storageManager.load();
        expect(loadResult.isOk()).toBe(true);
        if (loadResult.isOk()) {
          const schema = loadResult.unwrap();
          expect(schema.tags['tag-1']).toBeDefined();
        }
      });

      it('should rollback on save failure', async () => {
        const initialSchema = StorageSchema.createEmpty();
        await storageManager.save(initialSchema);

        // Force save to fail
        const originalSetItem = mockLocalStorage.setItem;
        mockLocalStorage.setItem.mockImplementation((key: string) => {
          if (key === storageKey) {
            throw new Error('QuotaExceededError');
          }
          return originalSetItem(key);
        });

        const result = await storageManager.atomicUpdate(async (schema) => {
          schema.tags['tag-1'] = {
            id: 'tag-1',
            normalizedValue: 'should-fail',
          };
          return { isOk: () => true, unwrap: () => schema } as Result<
            StorageSchemaV21,
            string
          >;
        });

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.unwrapErr()).toContain('Failed to save updated data');
        }

        mockLocalStorage.setItem.mockImplementation(originalSetItem);

        // Verify rollback worked
        const loadResult = await storageManager.load();
        expect(loadResult.isOk()).toBe(true);
        if (loadResult.isOk()) {
          const schema = loadResult.unwrap();
          expect(schema.tags['tag-1']).toBeUndefined();
        }
      });

      it('should handle rollback failure gracefully', async () => {
        const initialSchema = StorageSchema.createEmpty();
        await storageManager.save(initialSchema);

        let callCount = 0;
        const originalSetItem = mockLocalStorage.setItem;
        mockLocalStorage.setItem.mockImplementation((key: string) => {
          callCount++;
          if (key === storageKey) {
            throw new Error('Storage error');
          }
          return originalSetItem(key);
        });

        const result = await storageManager.atomicUpdate(async (schema) => {
          schema.tags['tag-1'] = {
            id: 'tag-1',
            normalizedValue: 'should-fail',
          };
          return { isOk: () => true, unwrap: () => schema } as Result<
            StorageSchemaV21,
            string
          >;
        });

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.unwrapErr()).toContain('rollback also failed');
        }

        mockLocalStorage.setItem.mockImplementation(originalSetItem);
      });
    });
  });

  describe('error scenarios', () => {
    it('should handle localStorage not available', async () => {
      const originalLocalStorage = global.localStorage;
      // @ts-ignore
      delete global.localStorage;

      const manager = new StorageManager(storageKey);
      const result = await manager.load();

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.unwrapErr()).toContain('localStorage is not available');
      }

      global.localStorage = originalLocalStorage;
    });

    it('should handle async operation errors gracefully', async () => {
      const schema = StorageSchema.createEmpty();

      // Simulate async error in save
      const originalSetItem = mockLocalStorage.setItem;
      mockLocalStorage.setItem.mockImplementationOnce(() => {
        throw new Error('Async operation failed');
      });

      const result = await storageManager.save(schema);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.unwrapErr()).toContain('Failed to save to localStorage');
      }

      mockLocalStorage.setItem.mockImplementation(originalSetItem);
    });
  });
});
