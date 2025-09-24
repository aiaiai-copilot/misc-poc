import { Result, RecordId, TagId, SearchQuery } from '@misc-poc/shared';
import { Record, DomainError } from '@misc-poc/domain';

export interface RecordSearchOptions {
  readonly limit?: number;
  readonly offset?: number;
  readonly sortBy?: 'createdAt' | 'updatedAt';
  readonly sortOrder?: 'asc' | 'desc';
}

export interface RecordSearchResult {
  readonly records: Record[];
  readonly total: number;
  readonly hasMore: boolean;
}

export interface RecordRepository {
  /**
   * Find a record by its unique identifier
   */
  findById(id: RecordId): Promise<Result<Record | null, DomainError>>;

  /**
   * Find all records
   */
  findAll(
    options?: RecordSearchOptions
  ): Promise<Result<RecordSearchResult, DomainError>>;

  /**
   * Search records using a search query
   */
  search(
    query: SearchQuery,
    options?: RecordSearchOptions
  ): Promise<Result<RecordSearchResult, DomainError>>;

  /**
   * Find records that contain any of the specified tag IDs
   */
  findByTagIds(
    tagIds: TagId[],
    options?: RecordSearchOptions
  ): Promise<Result<RecordSearchResult, DomainError>>;

  /**
   * Find records that contain ALL of the specified tags (AND logic)
   */
  findByTags(
    tags: string[],
    options?: RecordSearchOptions
  ): Promise<Result<RecordSearchResult, DomainError>>;

  /**
   * Find records that match the exact same tag set (for duplicate checking)
   */
  findByTagSet(
    tagIds: Set<TagId>,
    excludeRecordId?: RecordId
  ): Promise<Result<Record[], DomainError>>;

  /**
   * Save a new record
   */
  save(record: Record): Promise<Result<Record, DomainError>>;

  /**
   * Update an existing record
   */
  update(record: Record): Promise<Result<Record, DomainError>>;

  /**
   * Delete a record by its ID
   */
  delete(id: RecordId): Promise<Result<void, DomainError>>;

  /**
   * Bulk save multiple records (for import operations)
   */
  saveBatch(records: Record[]): Promise<Result<Record[], DomainError>>;

  /**
   * Delete all records (for import operations that replace data)
   */
  deleteAll(): Promise<Result<void, DomainError>>;

  /**
   * Get total count of all records
   */
  count(): Promise<Result<number, DomainError>>;

  /**
   * Check if a record exists by ID
   */
  exists(id: RecordId): Promise<Result<boolean, DomainError>>;
}
