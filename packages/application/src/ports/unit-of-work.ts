import { Result } from '@misc-poc/shared';
import { DomainError } from '@misc-poc/domain';
import { RecordRepository } from './record-repository';
import { TagRepository } from './tag-repository';

export interface UnitOfWork {
  /**
   * Get the record repository for this unit of work
   */
  readonly records: RecordRepository;

  /**
   * Get the tag repository for this unit of work
   */
  readonly tags: TagRepository;

  /**
   * Begin a new transaction
   * Multiple calls to begin() should be idempotent
   */
  begin(): Promise<Result<void, DomainError>>;

  /**
   * Commit all changes made within the transaction
   * If no transaction is active, this should be a no-op
   */
  commit(): Promise<Result<void, DomainError>>;

  /**
   * Rollback all changes made within the transaction
   * If no transaction is active, this should be a no-op
   */
  rollback(): Promise<Result<void, DomainError>>;

  /**
   * Execute a function within a transaction
   * The transaction is automatically committed if the function succeeds
   * The transaction is automatically rolled back if the function fails
   */
  execute<T>(
    operation: (uow: UnitOfWork) => Promise<Result<T, DomainError>>
  ): Promise<Result<T, DomainError>>;

  /**
   * Check if a transaction is currently active
   */
  isActive(): boolean;

  /**
   * Release any resources held by this unit of work
   * Should be called when done with the unit of work
   */
  dispose(): Promise<void>;
}
