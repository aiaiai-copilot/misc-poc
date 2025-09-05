import {
  RecordId,
  TagId,
  SearchQuery,
  RecordContent,
  Ok,
  Err,
  Result,
} from '@misc-poc/shared';
import { Record, Tag, DomainError } from '@misc-poc/domain';
import { UnitOfWork } from '@misc-poc/application';
import { LocalStorageUnitOfWork } from '../localstorage-unit-of-work';
import { StorageManager } from '../storage-manager';
import { IndexManager } from '../index-manager';
import type { StorageSchemaV21 } from '../storage-schema';

describe('LocalStorageUnitOfWork', () => {
  let unitOfWork: LocalStorageUnitOfWork;
  let mockStorageManager: jest.Mocked<StorageManager>;
  let mockIndexManager: jest.Mocked<IndexManager>;
  let mockSchema: StorageSchemaV21;
  let backupSchema: StorageSchemaV21;

  // Test UUIDs
  const testRecordId1 = '550e8400-e29b-41d4-a716-446655440001';
  const testRecordId2 = '550e8400-e29b-41d4-a716-446655440002';
  const testTagId1 = '550e8400-e29b-41d4-a716-446655440101';
  const testTagId2 = '550e8400-e29b-41d4-a716-446655440102';

  beforeEach(() => {
    mockStorageManager = {
      load: jest.fn(),
      save: jest.fn(),
    } as jest.Mocked<StorageManager>;

    mockIndexManager = {
      rebuildIndexes: jest.fn(),
      checkConsistency: jest.fn(),
    } as jest.Mocked<IndexManager>;

    mockSchema = {
      version: '2.1' as const,
      records: {
        [testRecordId1]: {
          id: testRecordId1,
          content: 'Test record 1',
          tagIds: [testTagId1],
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
        },
      },
      tags: {
        [testTagId1]: {
          id: testTagId1,
          normalizedValue: 'test',
        },
      },
      indexes: {
        normalizedToTagId: {
          test: testTagId1,
        },
        tagToRecords: {
          [testTagId1]: [testRecordId1],
        },
      },
    };

    backupSchema = JSON.parse(JSON.stringify(mockSchema));

    mockStorageManager.load.mockResolvedValue(mockSchema);
    mockIndexManager.checkConsistency.mockReturnValue(true);
    mockIndexManager.rebuildIndexes.mockImplementation((schema) => schema);

    unitOfWork = new LocalStorageUnitOfWork(
      mockStorageManager,
      mockIndexManager
    );
  });

  describe('UnitOfWork Interface Compliance', () => {
    it('should implement UnitOfWork interface', () => {
      expect(unitOfWork).toBeInstanceOf(LocalStorageUnitOfWork);
      expect(typeof unitOfWork.begin).toBe('function');
      expect(typeof unitOfWork.commit).toBe('function');
      expect(typeof unitOfWork.rollback).toBe('function');
      expect(typeof unitOfWork.execute).toBe('function');
      expect(typeof unitOfWork.isActive).toBe('function');
      expect(typeof unitOfWork.dispose).toBe('function');
    });

    it('should provide access to repositories after begin', async () => {
      await unitOfWork.begin();

      expect(unitOfWork.records).toBeDefined();
      expect(unitOfWork.tags).toBeDefined();
      expect(typeof unitOfWork.records.save).toBe('function');
      expect(typeof unitOfWork.tags.save).toBe('function');
    });

    it('should not be active initially', () => {
      expect(unitOfWork.isActive()).toBe(false);
    });
  });

  describe('Transaction Management', () => {
    describe('begin()', () => {
      it('should successfully begin a transaction', async () => {
        const result = await unitOfWork.begin();

        expect(result.isOk()).toBe(true);
        expect(unitOfWork.isActive()).toBe(true);
        expect(mockStorageManager.load).toHaveBeenCalledTimes(1);
      });

      it('should create a backup when beginning transaction', async () => {
        await unitOfWork.begin();

        // Verify that load was called to create backup
        expect(mockStorageManager.load).toHaveBeenCalledTimes(1);
        expect(unitOfWork.isActive()).toBe(true);
      });

      it('should be idempotent - multiple calls should not fail', async () => {
        const result1 = await unitOfWork.begin();
        const result2 = await unitOfWork.begin();

        expect(result1.isOk()).toBe(true);
        expect(result2.isOk()).toBe(true);
        expect(unitOfWork.isActive()).toBe(true);
      });

      it('should handle storage load errors', async () => {
        const error = new Error('Storage load failed');
        mockStorageManager.load.mockRejectedValue(error);

        const result = await unitOfWork.begin();

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error).toBeInstanceOf(DomainError);
          expect(result.error.message).toContain('Failed to begin transaction');
        }
        expect(unitOfWork.isActive()).toBe(false);
      });
    });

    describe('commit()', () => {
      it('should successfully commit when transaction is active', async () => {
        await unitOfWork.begin();

        const result = await unitOfWork.commit();

        expect(result.isOk()).toBe(true);
        expect(unitOfWork.isActive()).toBe(false);
        expect(mockStorageManager.save).toHaveBeenCalledTimes(1);
      });

      it('should be a no-op when no transaction is active', async () => {
        const result = await unitOfWork.commit();

        expect(result.isOk()).toBe(true);
        expect(mockStorageManager.save).not.toHaveBeenCalled();
      });

      it('should handle save errors during commit', async () => {
        await unitOfWork.begin();
        mockStorageManager.save.mockRejectedValue(new Error('Save failed'));

        const result = await unitOfWork.commit();

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error).toBeInstanceOf(DomainError);
          expect(result.error.message).toContain(
            'Failed to commit transaction'
          );
        }
        expect(unitOfWork.isActive()).toBe(false);
      });

      it('should clear working data after successful commit', async () => {
        await unitOfWork.begin();

        // Make some changes through repositories
        const newRecord = new Record(
          new RecordId(testRecordId2),
          new RecordContent('New record'),
          new Set([new TagId(testTagId1)]),
          new Date(),
          new Date()
        );
        await unitOfWork.records.save(newRecord);

        await unitOfWork.commit();

        // Mock the storage manager to return updated schema with the new record
        const updatedSchema = {
          ...mockSchema,
          records: {
            ...mockSchema.records,
            [testRecordId2]: {
              id: testRecordId2,
              content: 'New record',
              tagIds: [testTagId1],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          },
        };
        mockStorageManager.load.mockResolvedValue(updatedSchema);

        // Start a new transaction and verify changes were persisted
        await unitOfWork.begin();
        const found = await unitOfWork.records.findById(
          new RecordId(testRecordId2)
        );
        expect(found.isOk()).toBe(true);
        expect(found.unwrap()).not.toBeNull();
      });
    });

    describe('rollback()', () => {
      it('should successfully rollback when transaction is active', async () => {
        await unitOfWork.begin();

        const result = await unitOfWork.rollback();

        expect(result.isOk()).toBe(true);
        expect(unitOfWork.isActive()).toBe(false);
        expect(mockStorageManager.save).not.toHaveBeenCalled();
      });

      it('should be a no-op when no transaction is active', async () => {
        const result = await unitOfWork.rollback();

        expect(result.isOk()).toBe(true);
        expect(unitOfWork.isActive()).toBe(false);
      });

      it('should restore data to backup state', async () => {
        await unitOfWork.begin();

        // Make changes that should be rolled back
        const newRecord = new Record(
          new RecordId(testRecordId2),
          new RecordContent('New record to rollback'),
          new Set([new TagId(testTagId1)]),
          new Date(),
          new Date()
        );
        await unitOfWork.records.save(newRecord);

        // Verify changes are visible within transaction
        const foundBefore = await unitOfWork.records.findById(
          new RecordId(testRecordId2)
        );
        expect(foundBefore.isOk()).toBe(true);
        expect(foundBefore.unwrap()).not.toBeNull();

        // Rollback
        await unitOfWork.rollback();

        // Start new transaction and verify changes were rolled back
        await unitOfWork.begin();
        const foundAfter = await unitOfWork.records.findById(
          new RecordId(testRecordId2)
        );
        expect(foundAfter.isOk()).toBe(true);
        expect(foundAfter.unwrap()).toBeNull();
      });
    });

    describe('execute()', () => {
      it('should execute operation within transaction and commit on success', async () => {
        const operation = jest.fn().mockResolvedValue(Ok('success'));

        const result = await unitOfWork.execute(operation);

        expect(result.isOk()).toBe(true);
        expect(result.unwrap()).toBe('success');
        expect(operation).toHaveBeenCalledWith(unitOfWork);
        expect(unitOfWork.isActive()).toBe(false);
        expect(mockStorageManager.save).toHaveBeenCalledTimes(1);
      });

      it('should rollback transaction on operation failure', async () => {
        const operation = jest
          .fn()
          .mockResolvedValue(
            Err(new DomainError('TEST_ERROR', 'Operation failed'))
          );

        const result = await unitOfWork.execute(operation);

        expect(result.isErr()).toBe(true);
        expect(operation).toHaveBeenCalledWith(unitOfWork);
        expect(unitOfWork.isActive()).toBe(false);
        expect(mockStorageManager.save).not.toHaveBeenCalled();
      });

      it('should rollback transaction on operation exception', async () => {
        const operation = jest
          .fn()
          .mockRejectedValue(new Error('Unexpected error'));

        await expect(unitOfWork.execute(operation)).rejects.toThrow(
          'Unexpected error'
        );
        expect(unitOfWork.isActive()).toBe(false);
        expect(mockStorageManager.save).not.toHaveBeenCalled();
      });

      it('should make changes visible within the operation', async () => {
        const operation = async (
          uow: UnitOfWork
        ): Promise<Result<string, DomainError>> => {
          // Add a new record
          const newRecord = new Record(
            new RecordId(testRecordId2),
            new RecordContent('Test within transaction'),
            new Set([new TagId(testTagId1)]),
            new Date(),
            new Date()
          );

          const saveResult = await uow.records.save(newRecord);
          if (saveResult.isErr()) return saveResult;

          // Verify it's visible within the same transaction
          const findResult = await uow.records.findById(
            new RecordId(testRecordId2)
          );
          if (findResult.isErr()) return findResult;

          const found = findResult.unwrap();
          expect(found).not.toBeNull();
          expect(found?.id.toString()).toBe(testRecordId2);

          return Ok('operation completed');
        };

        const result = await unitOfWork.execute(operation);

        expect(result.isOk()).toBe(true);
        expect(result.unwrap()).toBe('operation completed');
      });
    });

    describe('dispose()', () => {
      it('should clean up resources and deactivate transaction', async () => {
        await unitOfWork.begin();
        expect(unitOfWork.isActive()).toBe(true);

        await unitOfWork.dispose();

        expect(unitOfWork.isActive()).toBe(false);
      });

      it('should be safe to call multiple times', async () => {
        await unitOfWork.begin();

        await unitOfWork.dispose();
        await unitOfWork.dispose();

        expect(unitOfWork.isActive()).toBe(false);
      });
    });
  });

  describe('Repository Integration', () => {
    it('should provide transactional repositories that work on working data', async () => {
      await unitOfWork.begin();

      const newRecord = new Record(
        new RecordId(testRecordId2),
        new RecordContent('Transactional record'),
        new Set([new TagId(testTagId1)]),
        new Date(),
        new Date()
      );

      // Save through unit of work repository
      const saveResult = await unitOfWork.records.save(newRecord);
      expect(saveResult.isOk()).toBe(true);

      // Find through unit of work repository
      const findResult = await unitOfWork.records.findById(
        new RecordId(testRecordId2)
      );
      expect(findResult.isOk()).toBe(true);
      expect(findResult.unwrap()).not.toBeNull();

      // Should not be saved to storage yet
      expect(mockStorageManager.save).not.toHaveBeenCalled();
    });

    it('should maintain consistency between record and tag repositories', async () => {
      await unitOfWork.begin();

      const newTag = new Tag(new TagId(testTagId2), 'newtag');
      const newRecord = new Record(
        new RecordId(testRecordId2),
        new RecordContent('Record with new tag'),
        new Set([new TagId(testTagId2)]),
        new Date(),
        new Date()
      );

      await unitOfWork.tags.save(newTag);
      await unitOfWork.records.save(newRecord);

      // Verify cross-repository consistency
      const tagResult = await unitOfWork.tags.findById(new TagId(testTagId2));
      const recordResult = await unitOfWork.records.findById(
        new RecordId(testRecordId2)
      );

      expect(tagResult.isOk() && tagResult.unwrap()).not.toBeNull();
      expect(recordResult.isOk() && recordResult.unwrap()).not.toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle concurrent access gracefully', async () => {
      // This is a basic test - real concurrent access would need more sophisticated mocking
      const uow1 = new LocalStorageUnitOfWork(
        mockStorageManager,
        mockIndexManager
      );
      const uow2 = new LocalStorageUnitOfWork(
        mockStorageManager,
        mockIndexManager
      );

      await uow1.begin();
      await uow2.begin();

      expect(uow1.isActive()).toBe(true);
      expect(uow2.isActive()).toBe(true);

      await uow1.dispose();
      await uow2.dispose();
    });

    it('should handle invalid schema gracefully', async () => {
      mockStorageManager.load.mockResolvedValue(null as any);

      const result = await unitOfWork.begin();

      expect(result.isErr()).toBe(true);
    });
  });

  describe('Transaction Isolation', () => {
    it('should isolate changes from external modifications', async () => {
      await unitOfWork.begin();

      // Simulate external change to storage
      const externalChange = {
        ...mockSchema,
        records: {
          ...mockSchema.records,
          [testRecordId2]: {
            id: testRecordId2,
            content: 'External change',
            tagIds: [testTagId1],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      };
      mockStorageManager.load.mockResolvedValue(externalChange);

      // Unit of work should work with its backup, not the externally modified data
      const findResult = await unitOfWork.records.findById(
        new RecordId(testRecordId2)
      );
      expect(findResult.isOk()).toBe(true);
      expect(findResult.unwrap()).toBeNull(); // Should not see external change
    });
  });
});
