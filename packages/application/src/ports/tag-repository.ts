import { Result, TagId } from '@misc-poc/shared';
import { Tag, DomainError } from '@misc-poc/domain';

export interface TagSearchOptions {
  readonly limit?: number;
  readonly offset?: number;
  readonly sortBy?: 'normalizedValue' | 'usage';
  readonly sortOrder?: 'asc' | 'desc';
}

export interface TagUsageInfo {
  readonly tag: Tag;
  readonly usageCount: number;
}

export interface TagSuggestion {
  readonly tag: Tag;
  readonly matchScore: number;
}

export interface TagRepository {
  /**
   * Find a tag by its unique identifier
   */
  findById(id: TagId): Promise<Result<Tag | null, DomainError>>;

  /**
   * Find a tag by its normalized value
   */
  findByNormalizedValue(
    normalizedValue: string
  ): Promise<Result<Tag | null, DomainError>>;

  /**
   * Find tags by multiple normalized values (for bulk operations)
   */
  findByNormalizedValues(
    normalizedValues: string[]
  ): Promise<Result<Tag[], DomainError>>;

  /**
   * Find all tags
   */
  findAll(options?: TagSearchOptions): Promise<Result<Tag[], DomainError>>;

  /**
   * Find tags with normalized values matching the given prefix
   * Used for auto-completion functionality
   */
  findByPrefix(
    prefix: string,
    limit?: number
  ): Promise<Result<TagSuggestion[], DomainError>>;

  /**
   * Get tag usage information (tags with their usage counts)
   */
  getUsageInfo(
    options?: TagSearchOptions
  ): Promise<Result<TagUsageInfo[], DomainError>>;

  /**
   * Find orphaned tags (tags not referenced by any records)
   */
  findOrphaned(): Promise<Result<Tag[], DomainError>>;

  /**
   * Save a new tag
   */
  save(tag: Tag): Promise<Result<Tag, DomainError>>;

  /**
   * Update an existing tag
   */
  update(tag: Tag): Promise<Result<Tag, DomainError>>;

  /**
   * Delete a tag by its ID
   */
  delete(id: TagId): Promise<Result<void, DomainError>>;

  /**
   * Delete multiple tags by their IDs (for cleanup operations)
   */
  deleteBatch(ids: TagId[]): Promise<Result<void, DomainError>>;

  /**
   * Bulk save multiple tags (for import operations)
   */
  saveBatch(tags: Tag[]): Promise<Result<Tag[], DomainError>>;

  /**
   * Delete all tags (for import operations that replace data)
   */
  deleteAll(): Promise<Result<void, DomainError>>;

  /**
   * Get total count of all tags
   */
  count(): Promise<Result<number, DomainError>>;

  /**
   * Check if a tag exists by normalized value
   */
  existsByNormalizedValue(
    normalizedValue: string
  ): Promise<Result<boolean, DomainError>>;

  /**
   * Check if a tag exists by ID
   */
  exists(id: TagId): Promise<Result<boolean, DomainError>>;

  /**
   * Get usage count for a specific tag
   */
  getUsageCount(id: TagId): Promise<Result<number, DomainError>>;
}
