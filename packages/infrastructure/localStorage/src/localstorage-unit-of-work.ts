import { Result, Ok, Err } from '@misc-poc/shared';
import { DomainError } from '@misc-poc/domain';
import {
  UnitOfWork,
  RecordRepository,
  TagRepository,
} from '@misc-poc/application';
import { StorageManager } from './storage-manager';
import { IndexManager } from './index-manager';
import { LocalStorageRecordRepository } from './localstorage-record-repository';
import { LocalStorageTagRepository } from './localstorage-tag-repository';
import type { StorageSchemaV21 } from './storage-schema';

interface StorageManagerLike {
  load(): Promise<StorageSchemaV21>;
  save(schema: StorageSchemaV21): Promise<void>;
}

export class LocalStorageUnitOfWork implements UnitOfWork {
  private _isActive = false;
  private workingSchema: StorageSchemaV21 | null = null;
  private recordRepository: RecordRepository | null = null;
  private tagRepository: TagRepository | null = null;
  private workingStorageManager: WorkingStorageManager | null = null;

  constructor(
    private readonly storageManager: StorageManager,
    private readonly indexManager: IndexManager
  ) {}

  get records(): RecordRepository {
    if (!this.recordRepository) {
      if (!this.workingStorageManager) {
        throw new Error('Transaction not active. Call begin() first.');
      }
      this.recordRepository = new LocalStorageRecordRepository(
        this.workingStorageManager as unknown as StorageManager,
        this.indexManager
      );
    }
    return this.recordRepository;
  }

  get tags(): TagRepository {
    if (!this.tagRepository) {
      if (!this.workingStorageManager) {
        throw new Error('Transaction not active. Call begin() first.');
      }
      this.tagRepository = new LocalStorageTagRepository(
        this.workingStorageManager as unknown as StorageManager,
        this.indexManager
      );
    }
    return this.tagRepository;
  }

  async begin(): Promise<Result<void, DomainError>> {
    try {
      if (this._isActive) {
        return Ok(undefined);
      }

      // Load current state and create working copy
      const currentSchema = await this.storageManager.load();

      // Validate schema
      if (!currentSchema) {
        return Err(
          new DomainError(
            'TRANSACTION_ERROR',
            'Failed to begin transaction: Invalid schema'
          )
        );
      }

      this.workingSchema = this.deepClone(currentSchema);

      // Create working storage manager
      this.workingStorageManager = new WorkingStorageManager(
        this.workingSchema
      );

      // Reset repositories to use working storage
      this.recordRepository = null;
      this.tagRepository = null;

      this._isActive = true;
      return Ok(undefined);
    } catch (error) {
      this._isActive = false;
      this.cleanup();
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return Err(
        new DomainError(
          'TRANSACTION_ERROR',
          `Failed to begin transaction: ${errorMessage}`
        )
      );
    }
  }

  async commit(): Promise<Result<void, DomainError>> {
    try {
      if (!this._isActive || !this.workingSchema) {
        return Ok(undefined);
      }

      // Save working schema to persistent storage
      await this.storageManager.save(this.workingSchema);

      // Clean up transaction state
      this._isActive = false;
      this.cleanup();

      return Ok(undefined);
    } catch (error) {
      // Transaction failed, clean up
      this._isActive = false;
      this.cleanup();
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return Err(
        new DomainError(
          'TRANSACTION_ERROR',
          `Failed to commit transaction: ${errorMessage}`
        )
      );
    }
  }

  async rollback(): Promise<Result<void, DomainError>> {
    try {
      if (!this._isActive) {
        return Ok(undefined);
      }

      // Just clean up - don't save working schema
      this._isActive = false;
      this.cleanup();

      return Ok(undefined);
    } catch (error) {
      this._isActive = false;
      this.cleanup();
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return Err(
        new DomainError(
          'TRANSACTION_ERROR',
          `Failed to rollback transaction: ${errorMessage}`
        )
      );
    }
  }

  async execute<T>(
    operation: (uow: UnitOfWork) => Promise<Result<T, DomainError>>
  ): Promise<Result<T, DomainError>> {
    const beginResult = await this.begin();
    if (beginResult.isErr()) {
      return Err(beginResult.unwrapErr());
    }

    try {
      const result = await operation(this);
      if (result.isOk()) {
        const commitResult = await this.commit();
        if (commitResult.isErr()) {
          return Err(commitResult.unwrapErr());
        }
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
    this.cleanup();
  }

  private cleanup(): void {
    this.workingSchema = null;
    this.recordRepository = null;
    this.tagRepository = null;
    this.workingStorageManager = null;
  }

  private deepClone(obj: StorageSchemaV21): StorageSchemaV21 {
    return JSON.parse(JSON.stringify(obj));
  }
}

/**
 * Working storage manager that operates on in-memory schema
 * instead of localStorage during transaction
 */
class WorkingStorageManager implements StorageManagerLike {
  constructor(private workingSchema: StorageSchemaV21) {}

  async load(): Promise<StorageSchemaV21> {
    // Return working copy during transaction
    return this.workingSchema;
  }

  async save(schema: StorageSchemaV21): Promise<void> {
    // Update working copy during transaction
    this.workingSchema.records = schema.records;
    this.workingSchema.tags = schema.tags;
    this.workingSchema.indexes = schema.indexes;
  }
}
