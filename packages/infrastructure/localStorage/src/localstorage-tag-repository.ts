import { Result, Ok, Err, TagId } from '@misc-poc/shared';
import { Tag, DomainError } from '@misc-poc/domain';
import {
  TagRepository,
  TagSearchOptions,
  TagUsageInfo,
  TagSuggestion,
} from '@misc-poc/application';
import { StorageManager } from './storage-manager';
import { IndexManager } from './index-manager';
import type { StorageSchemaV21, StorageTagData } from './storage-schema';

export class LocalStorageTagRepository implements TagRepository {
  constructor(
    private readonly storageManager: StorageManager,
    private readonly indexManager: IndexManager
  ) {}

  async findById(id: TagId): Promise<Result<Tag | null, DomainError>> {
    try {
      const schema = await this.loadAndValidateSchema();
      const tagData = schema.tags[id.toString()];

      if (!tagData) {
        return Ok(null);
      }

      const tag = this.mapStorageDataToTag(tagData);
      return Ok(tag);
    } catch (error) {
      return this.handleError('Failed to find tag by ID', error);
    }
  }

  async findByNormalizedValue(
    normalizedValue: string
  ): Promise<Result<Tag | null, DomainError>> {
    try {
      const schema = await this.loadAndValidateSchema();
      const tagId = schema.indexes.normalizedToTagId[normalizedValue];

      if (!tagId) {
        return Ok(null);
      }

      const tagData = schema.tags[tagId];
      if (!tagData) {
        return Ok(null);
      }

      const tag = this.mapStorageDataToTag(tagData);
      return Ok(tag);
    } catch (error) {
      return this.handleError('Failed to find tag by normalized value', error);
    }
  }

  async findByNormalizedValues(
    normalizedValues: string[]
  ): Promise<Result<Tag[], DomainError>> {
    try {
      const schema = await this.loadAndValidateSchema();
      const tags: Tag[] = [];

      for (const normalizedValue of normalizedValues) {
        const tagId = schema.indexes.normalizedToTagId[normalizedValue];
        if (tagId) {
          const tagData = schema.tags[tagId];
          if (tagData) {
            const tag = this.mapStorageDataToTag(tagData);
            if (tag) {
              tags.push(tag);
            }
          }
        }
      }

      return Ok(tags);
    } catch (error) {
      return this.handleError(
        'Failed to find tags by normalized values',
        error
      );
    }
  }

  async findAll(
    options: TagSearchOptions = {}
  ): Promise<Result<Tag[], DomainError>> {
    try {
      const schema = await this.loadAndValidateSchema();
      let tags = Object.values(schema.tags)
        .map((data) => this.mapStorageDataToTag(data))
        .filter((tag): tag is Tag => tag !== null);

      // Apply sorting
      tags = this.sortTags(tags, schema, options);

      // Apply pagination
      const { limit = tags.length, offset = 0 } = options;
      const paginatedTags = tags.slice(offset, offset + limit);

      return Ok(paginatedTags);
    } catch (error) {
      return this.handleError('Failed to find all tags', error);
    }
  }

  async findByPrefix(
    prefix: string,
    limit: number = 10
  ): Promise<Result<TagSuggestion[], DomainError>> {
    try {
      const schema = await this.loadAndValidateSchema();
      const suggestions: TagSuggestion[] = [];

      for (const [normalizedValue, tagId] of Object.entries(
        schema.indexes.normalizedToTagId
      )) {
        if (normalizedValue.startsWith(prefix.toLowerCase())) {
          const tagData = schema.tags[tagId];
          if (tagData) {
            const tag = this.mapStorageDataToTag(tagData);
            if (tag) {
              const matchScore = this.calculateMatchScore(
                normalizedValue,
                prefix
              );
              suggestions.push({ tag, matchScore });
            }
          }
        }
      }

      // Sort by match score (descending) and then by normalized value (ascending)
      suggestions.sort((a, b) => {
        if (a.matchScore !== b.matchScore) {
          return b.matchScore - a.matchScore;
        }
        return a.tag.normalizedValue.localeCompare(b.tag.normalizedValue);
      });

      return Ok(suggestions.slice(0, limit));
    } catch (error) {
      return this.handleError('Failed to find tags by prefix', error);
    }
  }

  async getUsageInfo(
    options: TagSearchOptions = {}
  ): Promise<Result<TagUsageInfo[], DomainError>> {
    try {
      const schema = await this.loadAndValidateSchema();
      const usageInfos: TagUsageInfo[] = [];

      for (const [tagId, tagData] of Object.entries(schema.tags)) {
        const tag = this.mapStorageDataToTag(tagData);
        if (tag) {
          const usageCount = (schema.indexes.tagToRecords[tagId] || []).length;
          usageInfos.push({ tag, usageCount });
        }
      }

      // Sort by usage or tag properties
      const sortedUsageInfos = this.sortUsageInfos(usageInfos, options);

      // Apply pagination
      const { limit = sortedUsageInfos.length, offset = 0 } = options;
      const paginatedUsageInfos = sortedUsageInfos.slice(
        offset,
        offset + limit
      );

      return Ok(paginatedUsageInfos);
    } catch (error) {
      return this.handleError('Failed to get usage info', error);
    }
  }

  async findOrphaned(): Promise<Result<Tag[], DomainError>> {
    try {
      const schema = await this.loadAndValidateSchema();
      const orphanedTags: Tag[] = [];

      for (const [tagId, tagData] of Object.entries(schema.tags)) {
        const recordIds = schema.indexes.tagToRecords[tagId];
        if (!recordIds || recordIds.length === 0) {
          const tag = this.mapStorageDataToTag(tagData);
          if (tag) {
            orphanedTags.push(tag);
          }
        }
      }

      return Ok(orphanedTags);
    } catch (error) {
      return this.handleError('Failed to find orphaned tags', error);
    }
  }

  async save(tag: Tag): Promise<Result<Tag, DomainError>> {
    try {
      const schema = await this.loadAndValidateSchema();

      // Check for duplicate normalized values (but allow same tag to be saved)
      const existingTagId =
        schema.indexes.normalizedToTagId[tag.normalizedValue];
      if (existingTagId && existingTagId !== tag.id.toString()) {
        return Err(
          new DomainError(
            'DUPLICATE_TAG',
            'Tag with this normalized value already exists'
          )
        );
      }

      const tagData = this.mapTagToStorageData(tag);
      schema.tags[tag.id.toString()] = tagData;

      // Rebuild indexes to ensure consistency
      const updatedSchema = this.indexManager.rebuildIndexes(schema);
      await this.storageManager.save(updatedSchema);

      return Ok(tag);
    } catch (error) {
      return this.handleError('Failed to save tag', error);
    }
  }

  async update(tag: Tag): Promise<Result<Tag, DomainError>> {
    try {
      const schema = await this.loadAndValidateSchema();
      const tagId = tag.id.toString();

      if (!schema.tags[tagId]) {
        return Err(new DomainError('TAG_NOT_FOUND', 'Tag not found'));
      }

      // Check for duplicate normalized values (but allow same tag to be updated)
      const existingTagId =
        schema.indexes.normalizedToTagId[tag.normalizedValue];
      if (existingTagId && existingTagId !== tagId) {
        return Err(
          new DomainError(
            'DUPLICATE_TAG',
            'Tag with this normalized value already exists'
          )
        );
      }

      const tagData = this.mapTagToStorageData(tag);
      schema.tags[tagId] = tagData;

      // Rebuild indexes to ensure consistency
      const updatedSchema = this.indexManager.rebuildIndexes(schema);
      await this.storageManager.save(updatedSchema);

      return Ok(tag);
    } catch (error) {
      return this.handleError('Failed to update tag', error);
    }
  }

  async delete(id: TagId): Promise<Result<void, DomainError>> {
    try {
      const schema = await this.loadAndValidateSchema();
      const tagId = id.toString();

      if (!schema.tags[tagId]) {
        return Err(new DomainError('TAG_NOT_FOUND', 'Tag not found'));
      }

      delete schema.tags[tagId];

      // Rebuild indexes to ensure consistency
      const updatedSchema = this.indexManager.rebuildIndexes(schema);
      await this.storageManager.save(updatedSchema);

      return Ok(undefined);
    } catch (error) {
      return this.handleError('Failed to delete tag', error);
    }
  }

  async deleteBatch(ids: TagId[]): Promise<Result<void, DomainError>> {
    try {
      const schema = await this.loadAndValidateSchema();

      for (const id of ids) {
        const tagId = id.toString();
        if (schema.tags[tagId]) {
          delete schema.tags[tagId];
        }
      }

      // Rebuild indexes to ensure consistency
      const updatedSchema = this.indexManager.rebuildIndexes(schema);
      await this.storageManager.save(updatedSchema);

      return Ok(undefined);
    } catch (error) {
      return this.handleError('Failed to delete tag batch', error);
    }
  }

  async saveBatch(tags: Tag[]): Promise<Result<Tag[], DomainError>> {
    try {
      const schema = await this.loadAndValidateSchema();

      // Check for duplicates within the batch and with existing tags
      const normalizedValues = new Set<string>();
      for (const tag of tags) {
        if (normalizedValues.has(tag.normalizedValue)) {
          return Err(
            new DomainError(
              'DUPLICATE_TAGS_IN_BATCH',
              'Duplicate normalized values in batch'
            )
          );
        }
        normalizedValues.add(tag.normalizedValue);

        const existingTagId =
          schema.indexes.normalizedToTagId[tag.normalizedValue];
        if (existingTagId && existingTagId !== tag.id.toString()) {
          return Err(
            new DomainError(
              'DUPLICATE_TAG',
              `Tag with normalized value '${tag.normalizedValue}' already exists`
            )
          );
        }
      }

      // Save all tags
      for (const tag of tags) {
        const tagData = this.mapTagToStorageData(tag);
        schema.tags[tag.id.toString()] = tagData;
      }

      // Rebuild indexes to ensure consistency
      const updatedSchema = this.indexManager.rebuildIndexes(schema);
      await this.storageManager.save(updatedSchema);

      return Ok(tags);
    } catch (error) {
      return this.handleError('Failed to save tag batch', error);
    }
  }

  async deleteAll(): Promise<Result<void, DomainError>> {
    try {
      const schema = await this.loadAndValidateSchema();
      schema.tags = {};

      // Rebuild indexes to ensure consistency
      const updatedSchema = this.indexManager.rebuildIndexes(schema);
      await this.storageManager.save(updatedSchema);

      return Ok(undefined);
    } catch (error) {
      return this.handleError('Failed to delete all tags', error);
    }
  }

  async count(): Promise<Result<number, DomainError>> {
    try {
      const schema = await this.loadAndValidateSchema();
      const count = Object.keys(schema.tags).length;
      return Ok(count);
    } catch (error) {
      return this.handleError('Failed to count tags', error);
    }
  }

  async existsByNormalizedValue(
    normalizedValue: string
  ): Promise<Result<boolean, DomainError>> {
    try {
      const schema = await this.loadAndValidateSchema();
      const exists =
        schema.indexes.normalizedToTagId[normalizedValue] !== undefined;
      return Ok(exists);
    } catch (error) {
      return this.handleError(
        'Failed to check tag existence by normalized value',
        error
      );
    }
  }

  async exists(id: TagId): Promise<Result<boolean, DomainError>> {
    try {
      const schema = await this.loadAndValidateSchema();
      const exists = schema.tags[id.toString()] !== undefined;
      return Ok(exists);
    } catch (error) {
      return this.handleError('Failed to check tag existence', error);
    }
  }

  async getUsageCount(id: TagId): Promise<Result<number, DomainError>> {
    try {
      const schema = await this.loadAndValidateSchema();
      const tagId = id.toString();
      const recordIds = schema.indexes.tagToRecords[tagId] || [];
      return Ok(recordIds.length);
    } catch (error) {
      return this.handleError('Failed to get usage count', error);
    }
  }

  private async loadAndValidateSchema(): Promise<StorageSchemaV21> {
    const schema = await this.storageManager.load();

    // Check index consistency and rebuild if needed
    if (!this.indexManager.checkConsistency(schema)) {
      return this.indexManager.rebuildIndexes(schema);
    }

    return schema;
  }

  private mapStorageDataToTag(data: StorageTagData): Tag | null {
    try {
      const id = new TagId(data.id);
      return new Tag(id, data.normalizedValue);
    } catch (error) {
      // Log error but continue gracefully
      console.warn('Failed to map storage data to tag:', error);
      return null;
    }
  }

  private mapTagToStorageData(tag: Tag): StorageTagData {
    return {
      id: tag.id.toString(),
      normalizedValue: tag.normalizedValue,
    };
  }

  private sortTags(
    tags: Tag[],
    schema: StorageSchemaV21,
    options: TagSearchOptions
  ): Tag[] {
    const { sortBy = 'normalizedValue', sortOrder = 'asc' } = options;

    return [...tags].sort((a, b) => {
      let comparison = 0;

      if (sortBy === 'normalizedValue') {
        comparison = a.normalizedValue.localeCompare(b.normalizedValue);
      } else if (sortBy === 'usage') {
        const usageA = (schema.indexes.tagToRecords[a.id.toString()] || [])
          .length;
        const usageB = (schema.indexes.tagToRecords[b.id.toString()] || [])
          .length;
        comparison = usageA - usageB;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  private sortUsageInfos(
    usageInfos: TagUsageInfo[],
    options: TagSearchOptions
  ): TagUsageInfo[] {
    const { sortBy = 'normalizedValue', sortOrder = 'asc' } = options;

    return [...usageInfos].sort((a, b) => {
      let comparison = 0;

      if (sortBy === 'normalizedValue') {
        comparison = a.tag.normalizedValue.localeCompare(b.tag.normalizedValue);
      } else if (sortBy === 'usage') {
        comparison = a.usageCount - b.usageCount;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  private calculateMatchScore(normalizedValue: string, prefix: string): number {
    if (normalizedValue === prefix.toLowerCase()) {
      return 1.0; // Exact match
    }

    if (normalizedValue.startsWith(prefix.toLowerCase())) {
      // Score based on how much of the string matches
      return prefix.length / normalizedValue.length;
    }

    return 0; // No match (shouldn't happen in this context)
  }

  private handleError(
    message: string,
    error: unknown
  ): Result<never, DomainError> {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error(`${message}:`, error);
    return Err(new DomainError('STORAGE_ERROR', `${message}: ${errorMessage}`));
  }
}
