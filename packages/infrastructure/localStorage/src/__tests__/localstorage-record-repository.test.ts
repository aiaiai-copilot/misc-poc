import {
  RecordId,
  TagId,
  SearchQuery,
  RecordContent,
  Ok,
  Err,
} from '@misc-poc/shared';
import { Record, Tag, DomainError } from '@misc-poc/domain';
import { LocalStorageRecordRepository } from '../localstorage-record-repository';
import { StorageManager } from '../storage-manager';
import { IndexManager } from '../index-manager';
import type { StorageSchemaV21 } from '../storage-schema';

describe('LocalStorageRecordRepository', () => {
  let repository: LocalStorageRecordRepository;
  let mockStorageManager: jest.Mocked<StorageManager>;
  let mockIndexManager: jest.Mocked<IndexManager>;
  let mockSchema: StorageSchemaV21;

  // Test UUIDs
  const testRecordId1 = '550e8400-e29b-41d4-a716-446655440001';
  const testRecordId2 = '550e8400-e29b-41d4-a716-446655440002';
  const testRecordId3 = '550e8400-e29b-41d4-a716-446655440003';
  const testTagId1 = '550e8400-e29b-41d4-a716-446655440101';
  const testTagId2 = '550e8400-e29b-41d4-a716-446655440102';
  const testTagId3 = '550e8400-e29b-41d4-a716-446655440103';

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
      records: {},
      tags: {},
      indexes: {
        normalizedToTagId: {},
        tagToRecords: {},
      },
    };

    repository = new LocalStorageRecordRepository(
      mockStorageManager,
      mockIndexManager
    );

    mockStorageManager.load.mockResolvedValue(mockSchema);
    mockIndexManager.checkConsistency.mockReturnValue(true);
    mockIndexManager.rebuildIndexes.mockReturnValue(mockSchema);
  });

  describe('findById', () => {
    it('should return null when record does not exist', async () => {
      const recordId = new RecordId(testRecordId1);

      const result = await repository.findById(recordId);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBeNull();
    });

    it('should return record when it exists', async () => {
      const recordId = new RecordId(testRecordId1);
      const tagId = new TagId(testTagId1);

      mockSchema.records[testRecordId1] = {
        id: testRecordId1,
        content: 'test content',
        tagIds: [testTagId1],
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      };

      const result = await repository.findById(recordId);

      expect(result.isOk()).toBe(true);
      const record = result.unwrap();
      expect(record).not.toBeNull();
      expect(record!.id.toString()).toBe(testRecordId1);
      expect(record!.content.toString()).toBe('test content');
      expect(Array.from(record!.tagIds)).toEqual([tagId]);
    });

    it('should handle errors gracefully', async () => {
      mockStorageManager.load.mockRejectedValue(new Error('Storage error'));

      const result = await repository.findById(new RecordId(testRecordId1));

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(DomainError);
    });

    it('should handle invalid date gracefully', async () => {
      const recordId = new RecordId(testRecordId1);

      mockSchema.records[testRecordId1] = {
        id: testRecordId1,
        content: 'test content',
        tagIds: [testTagId1],
        createdAt: 'invalid-date',
        updatedAt: 'invalid-date',
      };

      const result = await repository.findById(recordId);

      expect(result.isOk()).toBe(true);
      const record = result.unwrap();
      expect(record).not.toBeNull();
      expect(record!.createdAt).toBeInstanceOf(Date);
      expect(record!.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('findAll', () => {
    it('should return empty array when no records exist', async () => {
      const result = await repository.findAll();

      expect(result.isOk()).toBe(true);
      const searchResult = result.unwrap();
      expect(searchResult.records).toEqual([]);
      expect(searchResult.total).toBe(0);
      expect(searchResult.hasMore).toBe(false);
    });

    it('should return all records', async () => {
      mockSchema.records = {
        [testRecordId1]: {
          id: testRecordId1,
          content: 'content 1',
          tagIds: [testTagId1],
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
        },
        [testRecordId2]: {
          id: testRecordId2,
          content: 'content 2',
          tagIds: [testTagId2],
          createdAt: '2023-01-02T00:00:00.000Z',
          updatedAt: '2023-01-02T00:00:00.000Z',
        },
      };

      const result = await repository.findAll();

      expect(result.isOk()).toBe(true);
      const searchResult = result.unwrap();
      expect(searchResult.records).toHaveLength(2);
      expect(searchResult.total).toBe(2);
    });

    it('should apply pagination', async () => {
      mockSchema.records = {
        [testRecordId1]: {
          id: testRecordId1,
          content: 'content 1',
          tagIds: [],
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
        },
        [testRecordId2]: {
          id: testRecordId2,
          content: 'content 2',
          tagIds: [],
          createdAt: '2023-01-02T00:00:00.000Z',
          updatedAt: '2023-01-02T00:00:00.000Z',
        },
      };

      const result = await repository.findAll({ limit: 1, offset: 1 });

      expect(result.isOk()).toBe(true);
      const searchResult = result.unwrap();
      expect(searchResult.records).toHaveLength(1);
      expect(searchResult.total).toBe(2);
      expect(searchResult.hasMore).toBe(false);
    });

    it('should sort by createdAt descending by default', async () => {
      mockSchema.records = {
        [testRecordId1]: {
          id: testRecordId1,
          content: 'content 1',
          tagIds: [],
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
        },
        [testRecordId2]: {
          id: testRecordId2,
          content: 'content 2',
          tagIds: [],
          createdAt: '2023-01-02T00:00:00.000Z',
          updatedAt: '2023-01-02T00:00:00.000Z',
        },
      };

      const result = await repository.findAll();

      expect(result.isOk()).toBe(true);
      const searchResult = result.unwrap();
      expect(searchResult.records[0].id.toString()).toBe(testRecordId2);
      expect(searchResult.records[1].id.toString()).toBe(testRecordId1);
    });

    it('should sort by updatedAt ascending when specified', async () => {
      mockSchema.records = {
        [testRecordId1]: {
          id: testRecordId1,
          content: 'content 1',
          tagIds: [],
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-03T00:00:00.000Z',
        },
        [testRecordId2]: {
          id: testRecordId2,
          content: 'content 2',
          tagIds: [],
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-02T00:00:00.000Z',
        },
      };

      const result = await repository.findAll({
        sortBy: 'updatedAt',
        sortOrder: 'asc',
      });

      expect(result.isOk()).toBe(true);
      const searchResult = result.unwrap();
      expect(searchResult.records[0].id.toString()).toBe(testRecordId2);
      expect(searchResult.records[1].id.toString()).toBe(testRecordId1);
    });
  });

  describe('search', () => {
    it('should return empty results when no matching tags found', async () => {
      const query = new SearchQuery('nonexistent');

      const result = await repository.search(query);

      expect(result.isOk()).toBe(true);
      const searchResult = result.unwrap();
      expect(searchResult.records).toEqual([]);
      expect(searchResult.total).toBe(0);
    });

    it('should return all records when query is empty', async () => {
      const query = new SearchQuery('');
      mockSchema.records = {
        [testRecordId1]: {
          id: testRecordId1,
          content: 'content 1',
          tagIds: [],
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
        },
      };

      const result = await repository.search(query);

      expect(result.isOk()).toBe(true);
      const searchResult = result.unwrap();
      expect(searchResult.records).toHaveLength(1);
    });

    it('should find records with matching tags', async () => {
      const query = new SearchQuery('tag1');
      mockSchema.indexes.normalizedToTagId = { tag1: testTagId1 };
      mockSchema.indexes.tagToRecords = { [testTagId1]: [testRecordId1] };
      mockSchema.records = {
        [testRecordId1]: {
          id: testRecordId1,
          content: 'content 1',
          tagIds: [testTagId1],
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
        },
      };

      const result = await repository.search(query);

      expect(result.isOk()).toBe(true);
      const searchResult = result.unwrap();
      expect(searchResult.records).toHaveLength(1);
      expect(searchResult.records[0].id.toString()).toBe(testRecordId1);
    });

    it('should apply AND logic for multiple search terms', async () => {
      const query = new SearchQuery('tag1 tag2');
      mockSchema.indexes.normalizedToTagId = {
        tag1: testTagId1,
        tag2: testTagId2,
      };
      mockSchema.indexes.tagToRecords = {
        [testTagId1]: [testRecordId1, testRecordId2],
        [testTagId2]: [testRecordId1],
      };
      mockSchema.records = {
        [testRecordId1]: {
          id: testRecordId1,
          content: 'content 1',
          tagIds: [testTagId1, testTagId2],
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
        },
        [testRecordId2]: {
          id: testRecordId2,
          content: 'content 2',
          tagIds: [testTagId1],
          createdAt: '2023-01-02T00:00:00.000Z',
          updatedAt: '2023-01-02T00:00:00.000Z',
        },
      };

      const result = await repository.search(query);

      expect(result.isOk()).toBe(true);
      const searchResult = result.unwrap();
      expect(searchResult.records).toHaveLength(1);
      expect(searchResult.records[0].id.toString()).toBe(testRecordId1);
    });
  });

  describe('findByTagIds', () => {
    it('should find records with any of the specified tag IDs', async () => {
      const tagIds = [new TagId(testTagId1), new TagId(testTagId2)];

      mockSchema.indexes.tagToRecords = {
        [testTagId1]: [testRecordId1],
        [testTagId2]: [testRecordId2],
      };
      mockSchema.records = {
        [testRecordId1]: {
          id: testRecordId1,
          content: 'content 1',
          tagIds: [testTagId1],
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
        },
        [testRecordId2]: {
          id: testRecordId2,
          content: 'content 2',
          tagIds: [testTagId2],
          createdAt: '2023-01-02T00:00:00.000Z',
          updatedAt: '2023-01-02T00:00:00.000Z',
        },
      };

      const result = await repository.findByTagIds(tagIds);

      expect(result.isOk()).toBe(true);
      const searchResult = result.unwrap();
      expect(searchResult.records).toHaveLength(2);
    });

    it('should return empty results when no records match', async () => {
      const tagIds = [new TagId(testTagId1)];

      const result = await repository.findByTagIds(tagIds);

      expect(result.isOk()).toBe(true);
      const searchResult = result.unwrap();
      expect(searchResult.records).toEqual([]);
    });
  });

  describe('findByTagSet', () => {
    it('should find records with exact tag set match', async () => {
      const tagIds = new Set([new TagId(testTagId1), new TagId(testTagId2)]);

      mockSchema.records = {
        [testRecordId1]: {
          id: testRecordId1,
          content: 'content 1',
          tagIds: [testTagId1, testTagId2],
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
        },
        [testRecordId2]: {
          id: testRecordId2,
          content: 'content 2',
          tagIds: [testTagId1],
          createdAt: '2023-01-02T00:00:00.000Z',
          updatedAt: '2023-01-02T00:00:00.000Z',
        },
      };

      const result = await repository.findByTagSet(tagIds);

      expect(result.isOk()).toBe(true);
      const records = result.unwrap();
      expect(records).toHaveLength(1);
      expect(records[0].id.toString()).toBe(testRecordId1);
    });

    it('should exclude specified record ID', async () => {
      const tagIds = new Set([new TagId(testTagId1)]);
      const excludeId = new RecordId(testRecordId1);

      mockSchema.records = {
        [testRecordId1]: {
          id: testRecordId1,
          content: 'content 1',
          tagIds: [testTagId1],
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
        },
        [testRecordId2]: {
          id: testRecordId2,
          content: 'content 2',
          tagIds: [testTagId1],
          createdAt: '2023-01-02T00:00:00.000Z',
          updatedAt: '2023-01-02T00:00:00.000Z',
        },
      };

      const result = await repository.findByTagSet(tagIds, excludeId);

      expect(result.isOk()).toBe(true);
      const records = result.unwrap();
      expect(records).toHaveLength(1);
      expect(records[0].id.toString()).toBe(testRecordId2);
    });
  });

  describe('save', () => {
    it('should save a new record', async () => {
      const record = new Record(
        new RecordId(testRecordId1),
        new RecordContent('new content'),
        new Set([new TagId(testTagId1)]),
        new Date('2023-01-01T00:00:00.000Z'),
        new Date('2023-01-01T00:00:00.000Z')
      );

      const result = await repository.save(record);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(record);
      expect(mockIndexManager.rebuildIndexes).toHaveBeenCalled();
      expect(mockStorageManager.save).toHaveBeenCalled();
    });

    it('should handle save errors', async () => {
      const record = new Record(
        new RecordId(testRecordId1),
        new RecordContent('new content'),
        new Set(),
        new Date(),
        new Date()
      );
      mockStorageManager.save.mockRejectedValue(new Error('Save error'));

      const result = await repository.save(record);

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(DomainError);
    });
  });

  describe('update', () => {
    it('should update an existing record', async () => {
      mockSchema.records[testRecordId1] = {
        id: testRecordId1,
        content: 'old content',
        tagIds: [testTagId1],
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      };

      const updatedRecord = new Record(
        new RecordId(testRecordId1),
        new RecordContent('updated content'),
        new Set([new TagId(testTagId2)]),
        new Date('2023-01-01T00:00:00.000Z'),
        new Date('2023-01-02T00:00:00.000Z')
      );

      const result = await repository.update(updatedRecord);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(updatedRecord);
      expect(mockIndexManager.rebuildIndexes).toHaveBeenCalled();
      expect(mockStorageManager.save).toHaveBeenCalled();
    });

    it('should return error when record not found', async () => {
      const record = new Record(
        new RecordId(testRecordId1),
        new RecordContent('content'),
        new Set(),
        new Date(),
        new Date()
      );

      const result = await repository.update(record);

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().code).toBe('RECORD_NOT_FOUND');
    });
  });

  describe('delete', () => {
    it('should delete an existing record', async () => {
      mockSchema.records[testRecordId1] = {
        id: testRecordId1,
        content: 'content',
        tagIds: [],
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      };

      const result = await repository.delete(new RecordId(testRecordId1));

      expect(result.isOk()).toBe(true);
      expect(mockIndexManager.rebuildIndexes).toHaveBeenCalled();
      expect(mockStorageManager.save).toHaveBeenCalled();
    });

    it('should return error when record not found', async () => {
      const result = await repository.delete(new RecordId(testRecordId1));

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().code).toBe('RECORD_NOT_FOUND');
    });
  });

  describe('saveBatch', () => {
    it('should save multiple records', async () => {
      const records = [
        new Record(
          new RecordId(testRecordId1),
          new RecordContent('content 1'),
          new Set(),
          new Date(),
          new Date()
        ),
        new Record(
          new RecordId(testRecordId2),
          new RecordContent('content 2'),
          new Set(),
          new Date(),
          new Date()
        ),
      ];

      const result = await repository.saveBatch(records);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual(records);
      expect(mockIndexManager.rebuildIndexes).toHaveBeenCalled();
      expect(mockStorageManager.save).toHaveBeenCalled();
    });
  });

  describe('deleteAll', () => {
    it('should delete all records', async () => {
      mockSchema.records = {
        [testRecordId1]: {
          id: testRecordId1,
          content: 'content 1',
          tagIds: [],
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
        },
      };

      const result = await repository.deleteAll();

      expect(result.isOk()).toBe(true);
      expect(mockIndexManager.rebuildIndexes).toHaveBeenCalled();
      expect(mockStorageManager.save).toHaveBeenCalled();
    });
  });

  describe('count', () => {
    it('should return count of records', async () => {
      mockSchema.records = {
        [testRecordId1]: {
          id: testRecordId1,
          content: 'content 1',
          tagIds: [],
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
        },
        [testRecordId2]: {
          id: testRecordId2,
          content: 'content 2',
          tagIds: [],
          createdAt: '2023-01-02T00:00:00.000Z',
          updatedAt: '2023-01-02T00:00:00.000Z',
        },
      };

      const result = await repository.count();

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(2);
    });

    it('should return 0 when no records exist', async () => {
      const result = await repository.count();

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(0);
    });
  });

  describe('exists', () => {
    it('should return true when record exists', async () => {
      mockSchema.records[testRecordId1] = {
        id: testRecordId1,
        content: 'content',
        tagIds: [],
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      };

      const result = await repository.exists(new RecordId(testRecordId1));

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(true);
    });

    it('should return false when record does not exist', async () => {
      const result = await repository.exists(new RecordId(testRecordId1));

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(false);
    });
  });

  describe('index consistency handling', () => {
    it('should rebuild indexes when consistency check fails', async () => {
      mockIndexManager.checkConsistency.mockReturnValue(false);
      const rebuiltSchema = { ...mockSchema };
      mockIndexManager.rebuildIndexes.mockReturnValue(rebuiltSchema);

      const result = await repository.count();

      expect(result.isOk()).toBe(true);
      expect(mockIndexManager.checkConsistency).toHaveBeenCalled();
      expect(mockIndexManager.rebuildIndexes).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle storage manager errors', async () => {
      mockStorageManager.load.mockRejectedValue(new Error('Storage error'));

      const result = await repository.findById(new RecordId(testRecordId1));

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().code).toBe('STORAGE_ERROR');
    });

    it('should handle non-Error exceptions', async () => {
      mockStorageManager.load.mockRejectedValue('String error');

      const result = await repository.findById(new RecordId(testRecordId1));

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toContain('Unknown error');
    });
  });

  describe('data mapping edge cases', () => {
    it('should handle invalid record data gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      mockSchema.records['invalid-record'] = {
        id: null as any,
        content: 'content',
        tagIds: [],
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      };

      const result = await repository.findAll();

      expect(result.isOk()).toBe(true);
      const searchResult = result.unwrap();
      expect(searchResult.records).toHaveLength(0);

      consoleSpy.mockRestore();
    });

    it('should handle date parsing errors', async () => {
      mockSchema.records[testRecordId1] = {
        id: testRecordId1,
        content: 'content',
        tagIds: [],
        createdAt: 'not-a-date',
        updatedAt: 'also-not-a-date',
      };

      const result = await repository.findById(new RecordId(testRecordId1));

      expect(result.isOk()).toBe(true);
      const record = result.unwrap();
      expect(record).not.toBeNull();
      expect(record!.createdAt).toBeInstanceOf(Date);
      expect(record!.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('findByTags', () => {
    beforeEach(() => {
      // Set up test data
      mockSchema.records = {
        [testRecordId1]: {
          id: testRecordId1,
          content: 'First record',
          tagIds: [testTagId1, testTagId2, testTagId3],
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
        },
        [testRecordId2]: {
          id: testRecordId2,
          content: 'Second record',
          tagIds: [testTagId1, testTagId2],
          createdAt: '2023-01-02T00:00:00.000Z',
          updatedAt: '2023-01-02T00:00:00.000Z',
        },
        [testRecordId3]: {
          id: testRecordId3,
          content: 'Third record',
          tagIds: [testTagId2, testTagId3],
          createdAt: '2023-01-03T00:00:00.000Z',
          updatedAt: '2023-01-03T00:00:00.000Z',
        },
      };

      mockSchema.tags = {
        [testTagId1]: {
          id: testTagId1,
          name: 'Tag1',
          normalizedName: 'tag1',
        },
        [testTagId2]: {
          id: testTagId2,
          name: 'Tag2',
          normalizedName: 'tag2',
        },
        [testTagId3]: {
          id: testTagId3,
          name: 'Tag3',
          normalizedName: 'tag3',
        },
      };

      mockSchema.indexes = {
        normalizedToTagId: {
          tag1: testTagId1,
          tag2: testTagId2,
          tag3: testTagId3,
        },
        tagToRecords: {
          [testTagId1]: [testRecordId1, testRecordId2],
          [testTagId2]: [testRecordId1, testRecordId2, testRecordId3],
          [testTagId3]: [testRecordId1, testRecordId3],
        },
      };

      mockStorageManager.load.mockResolvedValue(mockSchema);
    });

    it('should find records matching all specified tags (AND logic)', async () => {
      // Search for records with both tag1 and tag2 (should match records 1 and 2)
      const result = await repository.findByTags(['tag1', 'tag2']);

      expect(result.isOk()).toBe(true);
      const searchResult = result.unwrap();

      expect(searchResult.records).toHaveLength(2);
      expect(searchResult.total).toBe(2);
      expect(searchResult.hasMore).toBe(false);

      const recordIds = searchResult.records.map((r) => r.id.toString()).sort();
      expect(recordIds).toEqual([testRecordId1, testRecordId2]);
    });

    it('should return empty array when no matches', async () => {
      const result = await repository.findByTags(['nonexistent']);

      expect(result.isOk()).toBe(true);
      const searchResult = result.unwrap();

      expect(searchResult.records).toHaveLength(0);
      expect(searchResult.total).toBe(0);
      expect(searchResult.hasMore).toBe(false);
    });

    it('should return all records when tags array is empty', async () => {
      const result = await repository.findByTags([]);

      expect(result.isOk()).toBe(true);
      const searchResult = result.unwrap();

      expect(searchResult.records).toHaveLength(3);
      expect(searchResult.total).toBe(3);
    });

    it('should handle AND logic correctly with multiple tags', async () => {
      // Search for records with tag1, tag2, and tag3 (should only match record 1)
      const result = await repository.findByTags(['tag1', 'tag2', 'tag3']);

      expect(result.isOk()).toBe(true);
      const searchResult = result.unwrap();

      expect(searchResult.records).toHaveLength(1);
      expect(searchResult.records[0].id.toString()).toBe(testRecordId1);
    });

    it('should return empty when no matching tag IDs found', async () => {
      // Mock scenario where normalized tags don't exist in index
      mockSchema.indexes.normalizedToTagId = {};

      const result = await repository.findByTags(['tag1', 'tag2']);

      expect(result.isOk()).toBe(true);
      const searchResult = result.unwrap();

      expect(searchResult.records).toHaveLength(0);
      expect(searchResult.total).toBe(0);
      expect(searchResult.hasMore).toBe(false);
    });

    it('should support pagination options', async () => {
      const result = await repository.findByTags(['tag2'], {
        limit: 2,
        offset: 1,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.isOk()).toBe(true);
      const searchResult = result.unwrap();

      expect(searchResult.records).toHaveLength(2);
      expect(searchResult.total).toBe(3);
      expect(searchResult.hasMore).toBe(false);
    });

    it('should handle storage manager errors', async () => {
      mockStorageManager.load.mockRejectedValue(new Error('Storage error'));

      const result = await repository.findByTags(['tag1']);

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().code).toBe('STORAGE_ERROR');
    });

    it('should filter invalid record data gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Add invalid record data
      mockSchema.records['invalid'] = {
        id: null as any,
        content: 'invalid',
        tagIds: [testTagId1],
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      };

      mockSchema.indexes.tagToRecords[testTagId1].push('invalid');

      const result = await repository.findByTags(['tag1']);

      expect(result.isOk()).toBe(true);
      const searchResult = result.unwrap();

      // Should only return valid records
      expect(searchResult.records).toHaveLength(2);
      expect(
        searchResult.records.every((r) => r.id.toString() !== 'invalid')
      ).toBe(true);

      consoleSpy.mockRestore();
    });
  });
});
