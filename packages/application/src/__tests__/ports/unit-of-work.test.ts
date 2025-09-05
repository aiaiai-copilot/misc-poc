import { Ok, Result, RecordId, TagId, SearchQuery } from '@misc-poc/shared';
import { DomainError, Record, Tag } from '@misc-poc/domain';
import { UnitOfWork } from '../../ports/unit-of-work';
import {
  RecordRepository,
  RecordSearchOptions,
  RecordSearchResult,
} from '../../ports/record-repository';
import {
  TagRepository,
  TagSearchOptions,
  TagUsageInfo,
  TagSuggestion,
} from '../../ports/tag-repository';

/**
 * Mock implementations for testing
 */
class MockRecordRepository implements RecordRepository {
  async findById(id: RecordId): Promise<Result<Record | null, DomainError>> {
    return Ok(null);
  }
  async findAll(
    options?: RecordSearchOptions
  ): Promise<Result<RecordSearchResult, DomainError>> {
    return Ok({ records: [], total: 0, hasMore: false });
  }
  async search(
    query: SearchQuery,
    options?: RecordSearchOptions
  ): Promise<Result<RecordSearchResult, DomainError>> {
    return Ok({ records: [], total: 0, hasMore: false });
  }
  async findByTagIds(
    tagIds: TagId[],
    options?: RecordSearchOptions
  ): Promise<Result<RecordSearchResult, DomainError>> {
    return Ok({ records: [], total: 0, hasMore: false });
  }
  async findByTagSet(
    tagIds: Set<TagId>,
    excludeRecordId?: RecordId
  ): Promise<Result<Record[], DomainError>> {
    return Ok([]);
  }
  async save(record: Record): Promise<Result<Record, DomainError>> {
    return Ok(record);
  }
  async update(record: Record): Promise<Result<Record, DomainError>> {
    return Ok(record);
  }
  async delete(id: RecordId): Promise<Result<void, DomainError>> {
    return Ok<void, DomainError>(undefined);
  }
  async saveBatch(records: Record[]): Promise<Result<Record[], DomainError>> {
    return Ok(records);
  }
  async deleteAll(): Promise<Result<void, DomainError>> {
    return Ok<void, DomainError>(undefined);
  }
  async count(): Promise<Result<number, DomainError>> {
    return Ok<number, DomainError>(0);
  }
  async exists(id: RecordId): Promise<Result<boolean, DomainError>> {
    return Ok<boolean, DomainError>(false);
  }
}

class MockTagRepository implements TagRepository {
  async findById(id: TagId): Promise<Result<Tag | null, DomainError>> {
    return Ok(null);
  }
  async findByNormalizedValue(
    normalizedValue: string
  ): Promise<Result<Tag | null, DomainError>> {
    return Ok(null);
  }
  async findByNormalizedValues(
    normalizedValues: string[]
  ): Promise<Result<Tag[], DomainError>> {
    return Ok([]);
  }
  async findAll(
    options?: TagSearchOptions
  ): Promise<Result<Tag[], DomainError>> {
    return Ok([]);
  }
  async findByPrefix(
    prefix: string,
    limit?: number
  ): Promise<Result<TagSuggestion[], DomainError>> {
    return Ok([]);
  }
  async getUsageInfo(
    options?: TagSearchOptions
  ): Promise<Result<TagUsageInfo[], DomainError>> {
    return Ok([]);
  }
  async findOrphaned(): Promise<Result<Tag[], DomainError>> {
    return Ok([]);
  }
  async save(tag: Tag): Promise<Result<Tag, DomainError>> {
    return Ok(tag);
  }
  async update(tag: Tag): Promise<Result<Tag, DomainError>> {
    return Ok(tag);
  }
  async delete(id: TagId): Promise<Result<void, DomainError>> {
    return Ok<void, DomainError>(undefined);
  }
  async deleteBatch(ids: TagId[]): Promise<Result<void, DomainError>> {
    return Ok<void, DomainError>(undefined);
  }
  async saveBatch(tags: Tag[]): Promise<Result<Tag[], DomainError>> {
    return Ok(tags);
  }
  async deleteAll(): Promise<Result<void, DomainError>> {
    return Ok<void, DomainError>(undefined);
  }
  async count(): Promise<Result<number, DomainError>> {
    return Ok<number, DomainError>(0);
  }
  async existsByNormalizedValue(
    normalizedValue: string
  ): Promise<Result<boolean, DomainError>> {
    return Ok<boolean, DomainError>(false);
  }
  async exists(id: TagId): Promise<Result<boolean, DomainError>> {
    return Ok<boolean, DomainError>(false);
  }
  async getUsageCount(id: TagId): Promise<Result<number, DomainError>> {
    return Ok<number, DomainError>(0);
  }
}

/**
 * Mock implementation of UnitOfWork for testing interface contracts
 */
class MockUnitOfWork implements UnitOfWork {
  readonly records: RecordRepository;
  readonly tags: TagRepository;
  private _isActive = false;

  constructor() {
    this.records = new MockRecordRepository();
    this.tags = new MockTagRepository();
  }

  async begin(): Promise<Result<void, DomainError>> {
    this._isActive = true;
    return Ok<void, DomainError>(undefined);
  }

  async commit(): Promise<Result<void, DomainError>> {
    this._isActive = false;
    return Ok<void, DomainError>(undefined);
  }

  async rollback(): Promise<Result<void, DomainError>> {
    this._isActive = false;
    return Ok<void, DomainError>(undefined);
  }

  async execute<T>(
    operation: (uow: UnitOfWork) => Promise<Result<T, DomainError>>
  ): Promise<Result<T, DomainError>> {
    await this.begin();
    try {
      const result = await operation(this);
      if (result.isOk()) {
        await this.commit();
      } else {
        await this.rollback();
      }
      return result;
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }

  isActive(): boolean {
    return this._isActive;
  }

  async dispose(): Promise<void> {
    this._isActive = false;
  }
}

describe('UnitOfWork Interface', () => {
  let unitOfWork: UnitOfWork;

  beforeEach((): void => {
    unitOfWork = new MockUnitOfWork();
  });

  describe('Contract Verification', () => {
    it('should have all required methods', (): void => {
      expect(typeof unitOfWork.begin).toBe('function');
      expect(typeof unitOfWork.commit).toBe('function');
      expect(typeof unitOfWork.rollback).toBe('function');
      expect(typeof unitOfWork.execute).toBe('function');
      expect(typeof unitOfWork.isActive).toBe('function');
      expect(typeof unitOfWork.dispose).toBe('function');
    });

    it('should have repository properties', (): void => {
      expect(unitOfWork.records).toBeDefined();
      expect(unitOfWork.tags).toBeDefined();
      expect(typeof unitOfWork.records.save).toBe('function');
      expect(typeof unitOfWork.tags.save).toBe('function');
    });

    it('should return Result types for transaction operations', async (): Promise<void> => {
      const beginResult = await unitOfWork.begin();
      expect(beginResult.isOk()).toBe(true);

      const commitResult = await unitOfWork.commit();
      expect(commitResult.isOk()).toBe(true);

      const rollbackResult = await unitOfWork.rollback();
      expect(rollbackResult.isOk()).toBe(true);
    });

    it('should track transaction state correctly', async (): Promise<void> => {
      expect(unitOfWork.isActive()).toBe(false);

      await unitOfWork.begin();
      expect(unitOfWork.isActive()).toBe(true);

      await unitOfWork.commit();
      expect(unitOfWork.isActive()).toBe(false);
    });

    it('should handle transaction execution', async (): Promise<void> => {
      const operation = async (
        uow: UnitOfWork
      ): Promise<Result<string, DomainError>> => {
        expect(uow.isActive()).toBe(true);
        return Ok('success');
      };

      const result = await unitOfWork.execute(operation);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('success');
      expect(unitOfWork.isActive()).toBe(false);
    });
  });

  describe('Repository Access', () => {
    it('should provide access to record repository', (): void => {
      expect(unitOfWork.records).toBeInstanceOf(MockRecordRepository);
    });

    it('should provide access to tag repository', (): void => {
      expect(unitOfWork.tags).toBeInstanceOf(MockTagRepository);
    });
  });

  describe('Resource Management', () => {
    it('should allow disposal of resources', async (): Promise<void> => {
      await unitOfWork.begin();
      expect(unitOfWork.isActive()).toBe(true);

      await unitOfWork.dispose();
      expect(unitOfWork.isActive()).toBe(false);
    });
  });
});
