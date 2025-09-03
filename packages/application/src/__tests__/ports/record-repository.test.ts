import { RecordId, TagId, SearchQuery, Ok, Err } from '@misc-poc/shared';
import { Record, DomainError } from '@misc-poc/domain';
import {
  RecordRepository,
  RecordSearchOptions,
  RecordSearchResult,
} from '../../ports/record-repository';

/**
 * Mock implementation of RecordRepository for testing interface contracts
 * This verifies that all required methods exist and have correct signatures
 */
class MockRecordRepository implements RecordRepository {
  async findById(id: RecordId) {
    // Verify method signature and return type
    const result: ReturnType<RecordRepository['findById']> = Ok(null);
    return result;
  }

  async findAll(options?: RecordSearchOptions) {
    const result: RecordSearchResult = {
      records: [],
      total: 0,
      hasMore: false,
    };
    return Ok(result);
  }

  async search(query: SearchQuery, options?: RecordSearchOptions) {
    const result: RecordSearchResult = {
      records: [],
      total: 0,
      hasMore: false,
    };
    return Ok(result);
  }

  async findByTagIds(tagIds: TagId[], options?: RecordSearchOptions) {
    const result: RecordSearchResult = {
      records: [],
      total: 0,
      hasMore: false,
    };
    return Ok(result);
  }

  async findByTagSet(tagIds: Set<TagId>, excludeRecordId?: RecordId) {
    return Ok<Record[], DomainError>([]);
  }

  async save(record: Record) {
    return Ok(record);
  }

  async update(record: Record) {
    return Ok(record);
  }

  async delete(id: RecordId) {
    return Ok<void, DomainError>(undefined);
  }

  async saveBatch(records: Record[]) {
    return Ok(records);
  }

  async deleteAll() {
    return Ok<void, DomainError>(undefined);
  }

  async count() {
    return Ok<number, DomainError>(0);
  }

  async exists(id: RecordId) {
    return Ok<boolean, DomainError>(false);
  }
}

describe('RecordRepository Interface', () => {
  let repository: RecordRepository;

  beforeEach(() => {
    repository = new MockRecordRepository();
  });

  describe('Contract Verification', () => {
    it('should have all required methods', () => {
      expect(typeof repository.findById).toBe('function');
      expect(typeof repository.findAll).toBe('function');
      expect(typeof repository.search).toBe('function');
      expect(typeof repository.findByTagIds).toBe('function');
      expect(typeof repository.findByTagSet).toBe('function');
      expect(typeof repository.save).toBe('function');
      expect(typeof repository.update).toBe('function');
      expect(typeof repository.delete).toBe('function');
      expect(typeof repository.saveBatch).toBe('function');
      expect(typeof repository.deleteAll).toBe('function');
      expect(typeof repository.count).toBe('function');
      expect(typeof repository.exists).toBe('function');
    });

    it('should return Result types for all async operations', async () => {
      const id = RecordId.generate();
      const tagIds = [TagId.generate()];
      const query = new SearchQuery('test');

      // Verify return types are Results
      const findByIdResult = await repository.findById(id);
      expect(findByIdResult.isOk()).toBe(true);

      const findAllResult = await repository.findAll();
      expect(findAllResult.isOk()).toBe(true);

      const searchResult = await repository.search(query);
      expect(searchResult.isOk()).toBe(true);

      const findByTagIdsResult = await repository.findByTagIds(tagIds);
      expect(findByTagIdsResult.isOk()).toBe(true);

      const findByTagSetResult = await repository.findByTagSet(new Set(tagIds));
      expect(findByTagSetResult.isOk()).toBe(true);

      const countResult = await repository.count();
      expect(countResult.isOk()).toBe(true);

      const existsResult = await repository.exists(id);
      expect(existsResult.isOk()).toBe(true);
    });
  });

  describe('Search Options Interface', () => {
    it('should accept valid search options', () => {
      const options: RecordSearchOptions = {
        limit: 10,
        offset: 0,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      // Should compile without errors
      expect(options.limit).toBe(10);
      expect(options.sortBy).toBe('createdAt');
    });

    it('should allow partial search options', () => {
      const options1: RecordSearchOptions = { limit: 10 };
      const options2: RecordSearchOptions = { sortBy: 'updatedAt' };
      const options3: RecordSearchOptions = {};

      expect(options1.limit).toBe(10);
      expect(options2.sortBy).toBe('updatedAt');
      expect(options3).toEqual({});
    });
  });

  describe('Search Result Interface', () => {
    it('should have correct structure for search results', () => {
      const result: RecordSearchResult = {
        records: [],
        total: 0,
        hasMore: false,
      };

      expect(Array.isArray(result.records)).toBe(true);
      expect(typeof result.total).toBe('number');
      expect(typeof result.hasMore).toBe('boolean');
    });
  });
});
