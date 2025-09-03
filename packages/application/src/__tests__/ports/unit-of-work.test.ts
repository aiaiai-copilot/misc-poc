import { Ok } from '@misc-poc/shared';
import { DomainError } from '@misc-poc/domain';
import { UnitOfWork } from '../../ports/unit-of-work';
import { RecordRepository } from '../../ports/record-repository';
import { TagRepository } from '../../ports/tag-repository';

/**
 * Mock implementations for testing
 */
class MockRecordRepository implements RecordRepository {
  async findById() {
    return Ok(null);
  }
  async findAll() {
    return Ok({ records: [], total: 0, hasMore: false });
  }
  async search() {
    return Ok({ records: [], total: 0, hasMore: false });
  }
  async findByTagIds() {
    return Ok({ records: [], total: 0, hasMore: false });
  }
  async findByTagSet() {
    return Ok([]);
  }
  async save(record: any) {
    return Ok(record);
  }
  async update(record: any) {
    return Ok(record);
  }
  async delete() {
    return Ok<void, DomainError>(undefined);
  }
  async saveBatch(records: any[]) {
    return Ok(records);
  }
  async deleteAll() {
    return Ok<void, DomainError>(undefined);
  }
  async count() {
    return Ok<number, DomainError>(0);
  }
  async exists() {
    return Ok<boolean, DomainError>(false);
  }
}

class MockTagRepository implements TagRepository {
  async findById() {
    return Ok(null);
  }
  async findByNormalizedValue() {
    return Ok(null);
  }
  async findByNormalizedValues() {
    return Ok([]);
  }
  async findAll() {
    return Ok([]);
  }
  async findByPrefix() {
    return Ok([]);
  }
  async getUsageInfo() {
    return Ok([]);
  }
  async findOrphaned() {
    return Ok([]);
  }
  async save(tag: any) {
    return Ok(tag);
  }
  async update(tag: any) {
    return Ok(tag);
  }
  async delete() {
    return Ok<void, DomainError>(undefined);
  }
  async deleteBatch() {
    return Ok<void, DomainError>(undefined);
  }
  async saveBatch(tags: any[]) {
    return Ok(tags);
  }
  async deleteAll() {
    return Ok<void, DomainError>(undefined);
  }
  async count() {
    return Ok<number, DomainError>(0);
  }
  async existsByNormalizedValue() {
    return Ok<boolean, DomainError>(false);
  }
  async exists() {
    return Ok<boolean, DomainError>(false);
  }
  async getUsageCount() {
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

  async begin() {
    this._isActive = true;
    return Ok<void, DomainError>(undefined);
  }

  async commit() {
    this._isActive = false;
    return Ok<void, DomainError>(undefined);
  }

  async rollback() {
    this._isActive = false;
    return Ok<void, DomainError>(undefined);
  }

  async execute<T>(operation: (uow: UnitOfWork) => Promise<any>) {
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

  isActive() {
    return this._isActive;
  }

  async dispose() {
    this._isActive = false;
  }
}

describe('UnitOfWork Interface', () => {
  let unitOfWork: UnitOfWork;

  beforeEach(() => {
    unitOfWork = new MockUnitOfWork();
  });

  describe('Contract Verification', () => {
    it('should have all required methods', () => {
      expect(typeof unitOfWork.begin).toBe('function');
      expect(typeof unitOfWork.commit).toBe('function');
      expect(typeof unitOfWork.rollback).toBe('function');
      expect(typeof unitOfWork.execute).toBe('function');
      expect(typeof unitOfWork.isActive).toBe('function');
      expect(typeof unitOfWork.dispose).toBe('function');
    });

    it('should have repository properties', () => {
      expect(unitOfWork.records).toBeDefined();
      expect(unitOfWork.tags).toBeDefined();
      expect(typeof unitOfWork.records.save).toBe('function');
      expect(typeof unitOfWork.tags.save).toBe('function');
    });

    it('should return Result types for transaction operations', async () => {
      const beginResult = await unitOfWork.begin();
      expect(beginResult.isOk()).toBe(true);

      const commitResult = await unitOfWork.commit();
      expect(commitResult.isOk()).toBe(true);

      const rollbackResult = await unitOfWork.rollback();
      expect(rollbackResult.isOk()).toBe(true);
    });

    it('should track transaction state correctly', async () => {
      expect(unitOfWork.isActive()).toBe(false);

      await unitOfWork.begin();
      expect(unitOfWork.isActive()).toBe(true);

      await unitOfWork.commit();
      expect(unitOfWork.isActive()).toBe(false);
    });

    it('should handle transaction execution', async () => {
      const operation = async (uow: UnitOfWork) => {
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
    it('should provide access to record repository', () => {
      expect(unitOfWork.records).toBeInstanceOf(MockRecordRepository);
    });

    it('should provide access to tag repository', () => {
      expect(unitOfWork.tags).toBeInstanceOf(MockTagRepository);
    });
  });

  describe('Resource Management', () => {
    it('should allow disposal of resources', async () => {
      await unitOfWork.begin();
      expect(unitOfWork.isActive()).toBe(true);

      await unitOfWork.dispose();
      expect(unitOfWork.isActive()).toBe(false);
    });
  });
});
