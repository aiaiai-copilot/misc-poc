import { TagId, Ok, Err } from '@misc-poc/shared';
import { Tag, DomainError } from '@misc-poc/domain';
import { LocalStorageTagRepository } from '../localstorage-tag-repository';
import { StorageManager } from '../storage-manager';
import { IndexManager } from '../index-manager';
import type { StorageSchemaV21 } from '../storage-schema';

describe('LocalStorageTagRepository', () => {
  let repository: LocalStorageTagRepository;
  let mockStorageManager: jest.Mocked<StorageManager>;
  let mockIndexManager: jest.Mocked<IndexManager>;
  let mockSchema: StorageSchemaV21;

  // Test UUIDs
  const testTagId1 = '550e8400-e29b-41d4-a716-446655440101';
  const testTagId2 = '550e8400-e29b-41d4-a716-446655440102';
  const testTagId3 = '550e8400-e29b-41d4-a716-446655440103';
  const testRecordId1 = '550e8400-e29b-41d4-a716-446655440001';
  const testRecordId2 = '550e8400-e29b-41d4-a716-446655440002';
  const testRecordId3 = '550e8400-e29b-41d4-a716-446655440003';

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

    repository = new LocalStorageTagRepository(
      mockStorageManager,
      mockIndexManager
    );

    mockStorageManager.load.mockResolvedValue(mockSchema);
    mockIndexManager.checkConsistency.mockReturnValue(true);
    mockIndexManager.rebuildIndexes.mockReturnValue(mockSchema);
  });

  describe('findById', () => {
    it('should return null when tag does not exist', async () => {
      const tagId = new TagId(testTagId1);

      const result = await repository.findById(tagId);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBeNull();
    });

    it('should return tag when it exists', async () => {
      const tagId = new TagId(testTagId1);

      mockSchema.tags[testTagId1] = {
        id: testTagId1,
        normalizedValue: 'test-tag',
      };

      const result = await repository.findById(tagId);

      expect(result.isOk()).toBe(true);
      const tag = result.unwrap();
      expect(tag).not.toBeNull();
      expect(tag!.id.toString()).toBe(testTagId1);
      expect(tag!.normalizedValue).toBe('test-tag');
    });

    it('should handle errors gracefully', async () => {
      mockStorageManager.load.mockRejectedValue(new Error('Storage error'));

      const result = await repository.findById(new TagId(testTagId1));

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(DomainError);
    });
  });

  describe('findByNormalizedValue', () => {
    it('should return null when tag does not exist', async () => {
      const result = await repository.findByNormalizedValue('non-existent');

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBeNull();
    });

    it('should return tag when it exists', async () => {
      mockSchema.indexes.normalizedToTagId['test-tag'] = testTagId1;
      mockSchema.tags[testTagId1] = {
        id: testTagId1,
        normalizedValue: 'test-tag',
      };

      const result = await repository.findByNormalizedValue('test-tag');

      expect(result.isOk()).toBe(true);
      const tag = result.unwrap();
      expect(tag).not.toBeNull();
      expect(tag!.normalizedValue).toBe('test-tag');
    });

    it('should handle missing tag data gracefully', async () => {
      mockSchema.indexes.normalizedToTagId['test-tag'] = testTagId1;

      const result = await repository.findByNormalizedValue('test-tag');

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBeNull();
    });
  });

  describe('findByNormalizedValues', () => {
    it('should return empty array when no tags exist', async () => {
      const result = await repository.findByNormalizedValues(['non-existent']);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual([]);
    });

    it('should return matching tags', async () => {
      mockSchema.indexes.normalizedToTagId = {
        tag1: testTagId1,
        tag2: testTagId2,
      };
      mockSchema.tags = {
        [testTagId1]: { id: testTagId1, normalizedValue: 'tag1' },
        [testTagId2]: { id: testTagId2, normalizedValue: 'tag2' },
      };

      const result = await repository.findByNormalizedValues([
        'tag1',
        'tag2',
        'non-existent',
      ]);

      expect(result.isOk()).toBe(true);
      const tags = result.unwrap();
      expect(tags).toHaveLength(2);
      expect(tags.map((t) => t.normalizedValue)).toEqual(['tag1', 'tag2']);
    });

    it('should filter out invalid tag data', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      mockSchema.indexes.normalizedToTagId = {
        'valid-tag': testTagId1,
        'invalid-tag': testTagId2,
      };
      mockSchema.tags = {
        [testTagId1]: { id: testTagId1, normalizedValue: 'valid-tag' },
        [testTagId2]: { id: null as any, normalizedValue: 'invalid-tag' },
      };

      const result = await repository.findByNormalizedValues([
        'valid-tag',
        'invalid-tag',
      ]);

      expect(result.isOk()).toBe(true);
      const tags = result.unwrap();
      expect(tags).toHaveLength(1);
      expect(tags[0].normalizedValue).toBe('valid-tag');

      consoleSpy.mockRestore();
    });
  });

  describe('findAll', () => {
    it('should return empty array when no tags exist', async () => {
      const result = await repository.findAll();

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual([]);
    });

    it('should return all tags', async () => {
      mockSchema.tags = {
        [testTagId1]: { id: testTagId1, normalizedValue: 'tag1' },
        [testTagId2]: { id: testTagId2, normalizedValue: 'tag2' },
      };

      const result = await repository.findAll();

      expect(result.isOk()).toBe(true);
      const tags = result.unwrap();
      expect(tags).toHaveLength(2);
    });

    it('should apply pagination', async () => {
      mockSchema.tags = {
        [testTagId1]: { id: testTagId1, normalizedValue: 'tag1' },
        [testTagId2]: { id: testTagId2, normalizedValue: 'tag2' },
        [testTagId3]: { id: testTagId3, normalizedValue: 'tag3' },
      };

      const result = await repository.findAll({ limit: 2, offset: 1 });

      expect(result.isOk()).toBe(true);
      const tags = result.unwrap();
      expect(tags).toHaveLength(2);
    });

    it('should sort by normalized value ascending by default', async () => {
      mockSchema.tags = {
        [testTagId1]: { id: testTagId1, normalizedValue: 'zebra' },
        [testTagId2]: { id: testTagId2, normalizedValue: 'alpha' },
      };

      const result = await repository.findAll();

      expect(result.isOk()).toBe(true);
      const tags = result.unwrap();
      expect(tags[0].normalizedValue).toBe('alpha');
      expect(tags[1].normalizedValue).toBe('zebra');
    });

    it('should sort by usage when specified', async () => {
      mockSchema.tags = {
        [testTagId1]: { id: testTagId1, normalizedValue: 'tag1' },
        [testTagId2]: { id: testTagId2, normalizedValue: 'tag2' },
      };
      mockSchema.indexes.tagToRecords = {
        [testTagId1]: [testRecordId1],
        [testTagId2]: [testRecordId1, testRecordId2],
      };

      const result = await repository.findAll({
        sortBy: 'usage',
        sortOrder: 'desc',
      });

      expect(result.isOk()).toBe(true);
      const tags = result.unwrap();
      expect(tags[0].normalizedValue).toBe('tag2');
      expect(tags[1].normalizedValue).toBe('tag1');
    });
  });

  describe('findByPrefix', () => {
    it('should return empty array when no matches', async () => {
      const result = await repository.findByPrefix('xyz');

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual([]);
    });

    it('should return matching suggestions', async () => {
      mockSchema.indexes.normalizedToTagId = {
        javascript: testTagId1,
        java: testTagId2,
        python: testTagId3,
      };
      mockSchema.tags = {
        [testTagId1]: { id: testTagId1, normalizedValue: 'javascript' },
        [testTagId2]: { id: testTagId2, normalizedValue: 'java' },
        [testTagId3]: { id: testTagId3, normalizedValue: 'python' },
      };

      const result = await repository.findByPrefix('java');

      expect(result.isOk()).toBe(true);
      const suggestions = result.unwrap();
      expect(suggestions).toHaveLength(2);
      expect(suggestions.map((s) => s.tag.normalizedValue)).toEqual([
        'java',
        'javascript',
      ]);
    });

    it('should limit results', async () => {
      mockSchema.indexes.normalizedToTagId = {
        javascript: testTagId1,
        java: testTagId2,
        jakarta: testTagId3,
      };
      mockSchema.tags = {
        [testTagId1]: { id: testTagId1, normalizedValue: 'javascript' },
        [testTagId2]: { id: testTagId2, normalizedValue: 'java' },
        [testTagId3]: { id: testTagId3, normalizedValue: 'jakarta' },
      };

      const result = await repository.findByPrefix('ja', 2);

      expect(result.isOk()).toBe(true);
      const suggestions = result.unwrap();
      expect(suggestions).toHaveLength(2);
    });

    it('should calculate match scores correctly', async () => {
      mockSchema.indexes.normalizedToTagId = {
        java: testTagId1,
        javascript: testTagId2,
      };
      mockSchema.tags = {
        [testTagId1]: { id: testTagId1, normalizedValue: 'java' },
        [testTagId2]: { id: testTagId2, normalizedValue: 'javascript' },
      };

      const result = await repository.findByPrefix('java');

      expect(result.isOk()).toBe(true);
      const suggestions = result.unwrap();
      expect(suggestions[0].tag.normalizedValue).toBe('java');
      expect(suggestions[0].matchScore).toBe(1.0);
      expect(suggestions[1].tag.normalizedValue).toBe('javascript');
      expect(suggestions[1].matchScore).toBe(4 / 10);
    });

    it('should handle case insensitivity', async () => {
      mockSchema.indexes.normalizedToTagId = {
        javascript: testTagId1,
      };
      mockSchema.tags = {
        [testTagId1]: { id: testTagId1, normalizedValue: 'javascript' },
      };

      const result = await repository.findByPrefix('JAVA');

      expect(result.isOk()).toBe(true);
      const suggestions = result.unwrap();
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].tag.normalizedValue).toBe('javascript');
    });
  });

  describe('getUsageInfo', () => {
    it('should return usage info for all tags', async () => {
      mockSchema.tags = {
        [testTagId1]: { id: testTagId1, normalizedValue: 'tag1' },
        [testTagId2]: { id: testTagId2, normalizedValue: 'tag2' },
      };
      mockSchema.indexes.tagToRecords = {
        [testTagId1]: [testRecordId1, testRecordId2],
        [testTagId2]: [testRecordId1],
      };

      const result = await repository.getUsageInfo();

      expect(result.isOk()).toBe(true);
      const usageInfos = result.unwrap();
      expect(usageInfos).toHaveLength(2);
      expect(
        usageInfos.find((u) => u.tag.normalizedValue === 'tag1')?.usageCount
      ).toBe(2);
      expect(
        usageInfos.find((u) => u.tag.normalizedValue === 'tag2')?.usageCount
      ).toBe(1);
    });

    it('should handle tags with no usage', async () => {
      mockSchema.tags = {
        [testTagId1]: { id: testTagId1, normalizedValue: 'unused-tag' },
      };

      const result = await repository.getUsageInfo();

      expect(result.isOk()).toBe(true);
      const usageInfos = result.unwrap();
      expect(usageInfos).toHaveLength(1);
      expect(usageInfos[0].usageCount).toBe(0);
    });

    it('should apply pagination to usage info', async () => {
      mockSchema.tags = {
        [testTagId1]: { id: testTagId1, normalizedValue: 'tag1' },
        [testTagId2]: { id: testTagId2, normalizedValue: 'tag2' },
        [testTagId3]: { id: testTagId3, normalizedValue: 'tag3' },
      };

      const result = await repository.getUsageInfo({ limit: 2, offset: 1 });

      expect(result.isOk()).toBe(true);
      const usageInfos = result.unwrap();
      expect(usageInfos).toHaveLength(2);
    });

    it('should sort usage info by usage count', async () => {
      mockSchema.tags = {
        [testTagId1]: { id: testTagId1, normalizedValue: 'popular' },
        [testTagId2]: { id: testTagId2, normalizedValue: 'unpopular' },
      };
      mockSchema.indexes.tagToRecords = {
        [testTagId1]: [testRecordId1, testRecordId2, testRecordId3],
        [testTagId2]: [testRecordId1],
      };

      const result = await repository.getUsageInfo({
        sortBy: 'usage',
        sortOrder: 'desc',
      });

      expect(result.isOk()).toBe(true);
      const usageInfos = result.unwrap();
      expect(usageInfos[0].tag.normalizedValue).toBe('popular');
      expect(usageInfos[1].tag.normalizedValue).toBe('unpopular');
    });
  });

  describe('findOrphaned', () => {
    it('should find tags with no records', async () => {
      mockSchema.tags = {
        [testTagId1]: { id: testTagId1, normalizedValue: 'used-tag' },
        [testTagId2]: { id: testTagId2, normalizedValue: 'orphaned-tag' },
      };
      mockSchema.indexes.tagToRecords = {
        [testTagId1]: [testRecordId1],
      };

      const result = await repository.findOrphaned();

      expect(result.isOk()).toBe(true);
      const orphanedTags = result.unwrap();
      expect(orphanedTags).toHaveLength(1);
      expect(orphanedTags[0].normalizedValue).toBe('orphaned-tag');
    });

    it('should return empty array when no orphaned tags', async () => {
      mockSchema.tags = {
        [testTagId1]: { id: testTagId1, normalizedValue: 'used-tag' },
      };
      mockSchema.indexes.tagToRecords = {
        [testTagId1]: [testRecordId1],
      };

      const result = await repository.findOrphaned();

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual([]);
    });
  });

  describe('save', () => {
    it('should save a new tag', async () => {
      const tag = new Tag(new TagId(testTagId1), 'new-tag-value');

      const result = await repository.save(tag);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(tag);
      expect(mockIndexManager.rebuildIndexes).toHaveBeenCalled();
      expect(mockStorageManager.save).toHaveBeenCalled();
    });

    it('should reject duplicate normalized values', async () => {
      mockSchema.indexes.normalizedToTagId['existing-tag'] = testTagId1;
      const tag = new Tag(new TagId(testTagId2), 'existing-tag');

      const result = await repository.save(tag);

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().code).toBe('DUPLICATE_TAG');
    });

    it('should allow saving the same tag', async () => {
      mockSchema.indexes.normalizedToTagId['existing-tag'] = testTagId1;
      const tag = new Tag(new TagId(testTagId1), 'existing-tag');

      const result = await repository.save(tag);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(tag);
    });

    it('should handle save errors', async () => {
      const tag = new Tag(new TagId(testTagId1), 'new-value');
      mockStorageManager.save.mockRejectedValue(new Error('Save error'));

      const result = await repository.save(tag);

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(DomainError);
    });
  });

  describe('update', () => {
    it('should update an existing tag', async () => {
      mockSchema.tags[testTagId1] = {
        id: testTagId1,
        normalizedValue: 'old-value',
      };
      const tag = new Tag(new TagId(testTagId1), 'new-value');

      const result = await repository.update(tag);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(tag);
      expect(mockIndexManager.rebuildIndexes).toHaveBeenCalled();
      expect(mockStorageManager.save).toHaveBeenCalled();
    });

    it('should return error when tag not found', async () => {
      const tag = new Tag(new TagId(testTagId1), 'value');

      const result = await repository.update(tag);

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().code).toBe('TAG_NOT_FOUND');
    });

    it('should reject duplicate normalized values during update', async () => {
      mockSchema.tags = {
        [testTagId1]: { id: testTagId1, normalizedValue: 'tag1' },
        [testTagId2]: { id: testTagId2, normalizedValue: 'tag2' },
      };
      mockSchema.indexes.normalizedToTagId = {
        tag1: testTagId1,
        tag2: testTagId2,
      };
      const tag = new Tag(new TagId(testTagId1), 'tag2');

      const result = await repository.update(tag);

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().code).toBe('DUPLICATE_TAG');
    });
  });

  describe('delete', () => {
    it('should delete an existing tag', async () => {
      mockSchema.tags[testTagId1] = {
        id: testTagId1,
        normalizedValue: 'existing-tag',
      };

      const result = await repository.delete(new TagId(testTagId1));

      expect(result.isOk()).toBe(true);
      expect(mockIndexManager.rebuildIndexes).toHaveBeenCalled();
      expect(mockStorageManager.save).toHaveBeenCalled();
    });

    it('should return error when tag not found', async () => {
      const result = await repository.delete(new TagId(testTagId1));

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().code).toBe('TAG_NOT_FOUND');
    });
  });

  describe('deleteBatch', () => {
    it('should delete multiple tags', async () => {
      mockSchema.tags = {
        [testTagId1]: { id: testTagId1, normalizedValue: 'tag1' },
        [testTagId2]: { id: testTagId2, normalizedValue: 'tag2' },
        [testTagId3]: { id: testTagId3, normalizedValue: 'tag3' },
      };

      const result = await repository.deleteBatch([
        new TagId(testTagId1),
        new TagId(testTagId2),
        new TagId('550e8400-e29b-41d4-a716-446655440999'),
      ]);

      expect(result.isOk()).toBe(true);
      expect(mockIndexManager.rebuildIndexes).toHaveBeenCalled();
      expect(mockStorageManager.save).toHaveBeenCalled();
    });
  });

  describe('saveBatch', () => {
    it('should save multiple tags', async () => {
      const tags = [
        new Tag(new TagId(testTagId1), 'tag1'),
        new Tag(new TagId(testTagId2), 'tag2'),
      ];

      const result = await repository.saveBatch(tags);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual(tags);
      expect(mockIndexManager.rebuildIndexes).toHaveBeenCalled();
      expect(mockStorageManager.save).toHaveBeenCalled();
    });

    it('should reject duplicates within batch', async () => {
      const tags = [
        new Tag(new TagId(testTagId1), 'duplicate-tag'),
        new Tag(new TagId(testTagId2), 'duplicate-tag'),
      ];

      const result = await repository.saveBatch(tags);

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().code).toBe('DUPLICATE_TAGS_IN_BATCH');
    });

    it('should reject duplicates with existing tags', async () => {
      mockSchema.indexes.normalizedToTagId['existing-tag'] = testTagId1;
      const tags = [new Tag(new TagId(testTagId2), 'existing-tag')];

      const result = await repository.saveBatch(tags);

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().code).toBe('DUPLICATE_TAG');
    });

    it('should allow updating existing tags in batch', async () => {
      mockSchema.indexes.normalizedToTagId['existing-tag'] = testTagId1;
      const tags = [new Tag(new TagId(testTagId1), 'existing-tag')];

      const result = await repository.saveBatch(tags);

      expect(result.isOk()).toBe(true);
    });
  });

  describe('deleteAll', () => {
    it('should delete all tags', async () => {
      mockSchema.tags = {
        [testTagId1]: { id: testTagId1, normalizedValue: 'tag1' },
        [testTagId2]: { id: testTagId2, normalizedValue: 'tag2' },
      };

      const result = await repository.deleteAll();

      expect(result.isOk()).toBe(true);
      expect(mockIndexManager.rebuildIndexes).toHaveBeenCalled();
      expect(mockStorageManager.save).toHaveBeenCalled();
    });
  });

  describe('count', () => {
    it('should return count of tags', async () => {
      mockSchema.tags = {
        [testTagId1]: { id: testTagId1, normalizedValue: 'tag1' },
        [testTagId2]: { id: testTagId2, normalizedValue: 'tag2' },
      };

      const result = await repository.count();

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(2);
    });

    it('should return 0 when no tags exist', async () => {
      const result = await repository.count();

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(0);
    });
  });

  describe('existsByNormalizedValue', () => {
    it('should return true when tag exists', async () => {
      mockSchema.indexes.normalizedToTagId['existing-tag'] = testTagId1;

      const result = await repository.existsByNormalizedValue('existing-tag');

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(true);
    });

    it('should return false when tag does not exist', async () => {
      const result = await repository.existsByNormalizedValue('non-existent');

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true when tag exists', async () => {
      mockSchema.tags[testTagId1] = {
        id: testTagId1,
        normalizedValue: 'existing-tag',
      };

      const result = await repository.exists(new TagId(testTagId1));

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(true);
    });

    it('should return false when tag does not exist', async () => {
      const result = await repository.exists(new TagId(testTagId1));

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(false);
    });
  });

  describe('getUsageCount', () => {
    it('should return usage count for tag', async () => {
      mockSchema.indexes.tagToRecords[testTagId1] = [
        testRecordId1,
        testRecordId2,
      ];

      const result = await repository.getUsageCount(new TagId(testTagId1));

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(2);
    });

    it('should return 0 for unused tag', async () => {
      const result = await repository.getUsageCount(new TagId(testTagId1));

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(0);
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

      const result = await repository.findById(new TagId(testTagId1));

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().code).toBe('STORAGE_ERROR');
    });

    it('should handle non-Error exceptions', async () => {
      mockStorageManager.load.mockRejectedValue('String error');

      const result = await repository.findById(new TagId(testTagId1));

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toContain('Unknown error');
    });
  });

  describe('data mapping edge cases', () => {
    it('should handle invalid tag data gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      mockSchema.tags['invalid-tag'] = {
        id: null as any,
        normalizedValue: 'invalid',
      };

      const result = await repository.findAll();

      expect(result.isOk()).toBe(true);
      const tags = result.unwrap();
      expect(tags).toHaveLength(0);

      consoleSpy.mockRestore();
    });
  });

  describe('private helper methods', () => {
    it('should calculate exact match score as 1.0', async () => {
      mockSchema.indexes.normalizedToTagId['exact'] = testTagId1;
      mockSchema.tags[testTagId1] = {
        id: testTagId1,
        normalizedValue: 'exact',
      };

      const result = await repository.findByPrefix('exact');

      expect(result.isOk()).toBe(true);
      const suggestions = result.unwrap();
      expect(suggestions[0].matchScore).toBe(1.0);
    });

    it('should sort usage infos correctly', async () => {
      mockSchema.tags = {
        [testTagId1]: { id: testTagId1, normalizedValue: 'zebra' },
        [testTagId2]: { id: testTagId2, normalizedValue: 'alpha' },
      };

      const result = await repository.getUsageInfo({
        sortBy: 'normalizedValue',
      });

      expect(result.isOk()).toBe(true);
      const usageInfos = result.unwrap();
      expect(usageInfos[0].tag.normalizedValue).toBe('alpha');
      expect(usageInfos[1].tag.normalizedValue).toBe('zebra');
    });
  });
});
