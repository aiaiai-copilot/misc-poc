import { TagId, Ok } from '@misc-poc/shared';
import { Tag, DomainError } from '@misc-poc/domain';
import {
  TagRepository,
  TagSearchOptions,
  TagUsageInfo,
  TagSuggestion,
} from '../../ports/tag-repository';

/**
 * Mock implementation of TagRepository for testing interface contracts
 */
class MockTagRepository implements TagRepository {
  async findById(id: TagId) {
    return Ok<Tag | null, DomainError>(null);
  }

  async findByNormalizedValue(normalizedValue: string) {
    return Ok<Tag | null, DomainError>(null);
  }

  async findByNormalizedValues(normalizedValues: string[]) {
    return Ok<Tag[], DomainError>([]);
  }

  async findAll(options?: TagSearchOptions) {
    return Ok<Tag[], DomainError>([]);
  }

  async findByPrefix(prefix: string, limit?: number) {
    return Ok<TagSuggestion[], DomainError>([]);
  }

  async getUsageInfo(options?: TagSearchOptions) {
    return Ok<TagUsageInfo[], DomainError>([]);
  }

  async findOrphaned() {
    return Ok<Tag[], DomainError>([]);
  }

  async save(tag: Tag) {
    return Ok(tag);
  }

  async update(tag: Tag) {
    return Ok(tag);
  }

  async delete(id: TagId) {
    return Ok<void, DomainError>(undefined);
  }

  async deleteBatch(ids: TagId[]) {
    return Ok<void, DomainError>(undefined);
  }

  async saveBatch(tags: Tag[]) {
    return Ok(tags);
  }

  async deleteAll() {
    return Ok<void, DomainError>(undefined);
  }

  async count() {
    return Ok<number, DomainError>(0);
  }

  async existsByNormalizedValue(normalizedValue: string) {
    return Ok<boolean, DomainError>(false);
  }

  async exists(id: TagId) {
    return Ok<boolean, DomainError>(false);
  }

  async getUsageCount(id: TagId) {
    return Ok<number, DomainError>(0);
  }
}

describe('TagRepository Interface', () => {
  let repository: TagRepository;

  beforeEach(() => {
    repository = new MockTagRepository();
  });

  describe('Contract Verification', () => {
    it('should have all required methods', () => {
      expect(typeof repository.findById).toBe('function');
      expect(typeof repository.findByNormalizedValue).toBe('function');
      expect(typeof repository.findByNormalizedValues).toBe('function');
      expect(typeof repository.findAll).toBe('function');
      expect(typeof repository.findByPrefix).toBe('function');
      expect(typeof repository.getUsageInfo).toBe('function');
      expect(typeof repository.findOrphaned).toBe('function');
      expect(typeof repository.save).toBe('function');
      expect(typeof repository.update).toBe('function');
      expect(typeof repository.delete).toBe('function');
      expect(typeof repository.deleteBatch).toBe('function');
      expect(typeof repository.saveBatch).toBe('function');
      expect(typeof repository.deleteAll).toBe('function');
      expect(typeof repository.count).toBe('function');
      expect(typeof repository.existsByNormalizedValue).toBe('function');
      expect(typeof repository.exists).toBe('function');
      expect(typeof repository.getUsageCount).toBe('function');
    });

    it('should return Result types for all async operations', async () => {
      const id = TagId.generate();
      const normalizedValue = 'test';

      // Verify return types are Results
      const findByIdResult = await repository.findById(id);
      expect(findByIdResult.isOk()).toBe(true);

      const findByNormalizedValueResult =
        await repository.findByNormalizedValue(normalizedValue);
      expect(findByNormalizedValueResult.isOk()).toBe(true);

      const findAllResult = await repository.findAll();
      expect(findAllResult.isOk()).toBe(true);

      const findByPrefixResult = await repository.findByPrefix('te');
      expect(findByPrefixResult.isOk()).toBe(true);

      const getUsageInfoResult = await repository.getUsageInfo();
      expect(getUsageInfoResult.isOk()).toBe(true);

      const countResult = await repository.count();
      expect(countResult.isOk()).toBe(true);

      const existsResult = await repository.exists(id);
      expect(existsResult.isOk()).toBe(true);
    });
  });

  describe('Search Options Interface', () => {
    it('should accept valid search options', () => {
      const options: TagSearchOptions = {
        limit: 10,
        offset: 0,
        sortBy: 'normalizedValue',
        sortOrder: 'asc',
      };

      expect(options.limit).toBe(10);
      expect(options.sortBy).toBe('normalizedValue');
    });

    it('should support usage-based sorting', () => {
      const options: TagSearchOptions = {
        sortBy: 'usage',
        sortOrder: 'desc',
      };

      expect(options.sortBy).toBe('usage');
      expect(options.sortOrder).toBe('desc');
    });
  });

  describe('TagUsageInfo Interface', () => {
    it('should have correct structure for tag usage info', () => {
      const tag = Tag.create('test');
      const usageInfo: TagUsageInfo = {
        tag,
        usageCount: 5,
      };

      expect(usageInfo.tag).toBe(tag);
      expect(typeof usageInfo.usageCount).toBe('number');
      expect(usageInfo.usageCount).toBe(5);
    });
  });

  describe('TagSuggestion Interface', () => {
    it('should have correct structure for tag suggestions', () => {
      const tag = Tag.create('test');
      const suggestion: TagSuggestion = {
        tag,
        matchScore: 0.85,
      };

      expect(suggestion.tag).toBe(tag);
      expect(typeof suggestion.matchScore).toBe('number');
      expect(suggestion.matchScore).toBe(0.85);
    });
  });
});
