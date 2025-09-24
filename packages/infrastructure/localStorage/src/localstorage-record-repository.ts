import {
  Result,
  Ok,
  Err,
  RecordId,
  TagId,
  SearchQuery,
  RecordContent,
} from '@misc-poc/shared';
import { Record, DomainError } from '@misc-poc/domain';
import {
  RecordRepository,
  RecordSearchOptions,
  RecordSearchResult,
  TagStatistic,
} from '@misc-poc/application';
import { StorageManager } from './storage-manager';
import { IndexManager } from './index-manager';
import type { StorageSchemaV21, StorageRecordData } from './storage-schema';

export class LocalStorageRecordRepository implements RecordRepository {
  constructor(
    private readonly storageManager: StorageManager,
    private readonly indexManager: IndexManager
  ) {}

  async findById(id: RecordId): Promise<Result<Record | null, DomainError>> {
    try {
      const schema = await this.loadAndValidateSchema();
      const recordData = schema.records[id.toString()];

      if (!recordData) {
        return Ok(null);
      }

      const record = this.mapStorageDataToRecord(recordData);
      return Ok(record);
    } catch (error) {
      return this.handleError('Failed to find record by ID', error);
    }
  }

  async findAll(
    options: RecordSearchOptions = {}
  ): Promise<Result<RecordSearchResult, DomainError>> {
    try {
      const schema = await this.loadAndValidateSchema();
      const allRecords = Object.values(schema.records)
        .map((data) => this.mapStorageDataToRecord(data))
        .filter((record): record is Record => record !== null);

      return this.buildSearchResult(allRecords, options);
    } catch (error) {
      return this.handleError('Failed to find all records', error);
    }
  }

  async search(
    query: SearchQuery,
    options: RecordSearchOptions = {}
  ): Promise<Result<RecordSearchResult, DomainError>> {
    try {
      const schema = await this.loadAndValidateSchema();
      const queryTokens = query.getTokens();

      if (queryTokens.length === 0) {
        return this.findAll(options);
      }

      // Find tag IDs that match query tokens
      const matchingTagIds = new Set<string>();
      for (const token of queryTokens) {
        const tagId = schema.indexes.normalizedToTagId[token];
        if (tagId) {
          matchingTagIds.add(tagId);
        }
      }

      if (matchingTagIds.size === 0) {
        return Ok({
          records: [],
          total: 0,
          hasMore: false,
        });
      }

      // Find records that contain ALL matching tags (AND logic)
      const recordSets = Array.from(matchingTagIds).map(
        (tagId) => new Set(schema.indexes.tagToRecords[tagId] || [])
      );

      // Intersection of all sets (AND logic)
      const matchingRecordIds = recordSets.reduce((intersection, recordSet) => {
        return new Set([...intersection].filter((id) => recordSet.has(id)));
      });

      const matchingRecords = Array.from(matchingRecordIds)
        .map((recordId) => {
          const recordData = schema.records[recordId];
          return recordData ? this.mapStorageDataToRecord(recordData) : null;
        })
        .filter((record): record is Record => record !== null);

      return this.buildSearchResult(matchingRecords, options);
    } catch (error) {
      return this.handleError('Failed to search records', error);
    }
  }

  async findByTagIds(
    tagIds: TagId[],
    options: RecordSearchOptions = {}
  ): Promise<Result<RecordSearchResult, DomainError>> {
    try {
      const schema = await this.loadAndValidateSchema();
      const tagIdStrings = tagIds.map((id) => id.toString());

      const recordIds = new Set<string>();
      for (const tagId of tagIdStrings) {
        const records = schema.indexes.tagToRecords[tagId] || [];
        records.forEach((recordId) => recordIds.add(recordId));
      }

      const matchingRecords = Array.from(recordIds)
        .map((recordId) => {
          const recordData = schema.records[recordId];
          return recordData ? this.mapStorageDataToRecord(recordData) : null;
        })
        .filter((record): record is Record => record !== null);

      return this.buildSearchResult(matchingRecords, options);
    } catch (error) {
      return this.handleError('Failed to find records by tag IDs', error);
    }
  }

  async findByTags(
    tags: string[],
    options: RecordSearchOptions = {}
  ): Promise<Result<RecordSearchResult, DomainError>> {
    try {
      const schema = await this.loadAndValidateSchema();

      if (tags.length === 0) {
        return this.findAll(options);
      }

      // Find tag IDs that match the provided tags using normalized index
      const matchingTagIds = new Set<string>();
      for (const tag of tags) {
        // Tags are already normalized when passed to this method
        const tagId = schema.indexes.normalizedToTagId[tag];
        if (tagId) {
          matchingTagIds.add(tagId);
        }
      }

      if (matchingTagIds.size === 0) {
        return Ok({
          records: [],
          total: 0,
          hasMore: false,
        });
      }

      // Find records that contain ALL matching tags (AND logic)
      const recordSets = Array.from(matchingTagIds).map(
        (tagId) => new Set(schema.indexes.tagToRecords[tagId] || [])
      );

      // Intersection of all sets (AND logic)
      let matchingRecordIds = recordSets[0] || new Set<string>();
      for (let i = 1; i < recordSets.length; i++) {
        const currentSet = recordSets[i] || new Set<string>();
        matchingRecordIds = new Set(
          Array.from(matchingRecordIds).filter((id) => currentSet.has(id))
        );
      }

      const matchingRecords = Array.from(matchingRecordIds)
        .map((recordId) => {
          const recordData = schema.records[recordId];
          return recordData ? this.mapStorageDataToRecord(recordData) : null;
        })
        .filter((record): record is Record => record !== null);

      return this.buildSearchResult(matchingRecords, options);
    } catch (error) {
      return this.handleError('Failed to find records by tags', error);
    }
  }

  async findByTagSet(
    tagIds: Set<TagId>,
    excludeRecordId?: RecordId
  ): Promise<Result<Record[], DomainError>> {
    try {
      const schema = await this.loadAndValidateSchema();
      const tagIdStrings = new Set(
        Array.from(tagIds).map((id) => id.toString())
      );
      const excludeId = excludeRecordId?.toString();

      const matchingRecords: Record[] = [];

      for (const [recordId, recordData] of Object.entries(schema.records)) {
        if (excludeId && recordId === excludeId) {
          continue;
        }

        const recordTagIds = new Set(recordData.tagIds);

        // Check if the record has the exact same tag set
        if (this.setsEqual(recordTagIds, tagIdStrings)) {
          const record = this.mapStorageDataToRecord(recordData);
          if (record) {
            matchingRecords.push(record);
          }
        }
      }

      return Ok(matchingRecords);
    } catch (error) {
      return this.handleError('Failed to find records by tag set', error);
    }
  }

  async save(record: Record): Promise<Result<Record, DomainError>> {
    try {
      const schema = await this.loadAndValidateSchema();

      const recordData = this.mapRecordToStorageData(record);
      schema.records[record.id.toString()] = recordData;

      // Rebuild indexes to ensure consistency
      const updatedSchema = this.indexManager.rebuildIndexes(schema);
      await this.storageManager.save(updatedSchema);

      return Ok(record);
    } catch (error) {
      return this.handleError('Failed to save record', error);
    }
  }

  async update(record: Record): Promise<Result<Record, DomainError>> {
    try {
      const schema = await this.loadAndValidateSchema();
      const recordId = record.id.toString();

      if (!schema.records[recordId]) {
        return Err(new DomainError('RECORD_NOT_FOUND', 'Record not found'));
      }

      const recordData = this.mapRecordToStorageData(record);
      schema.records[recordId] = recordData;

      // Rebuild indexes to ensure consistency
      const updatedSchema = this.indexManager.rebuildIndexes(schema);
      await this.storageManager.save(updatedSchema);

      return Ok(record);
    } catch (error) {
      return this.handleError('Failed to update record', error);
    }
  }

  async delete(id: RecordId): Promise<Result<void, DomainError>> {
    try {
      const schema = await this.loadAndValidateSchema();
      const recordId = id.toString();

      if (!schema.records[recordId]) {
        return Err(new DomainError('RECORD_NOT_FOUND', 'Record not found'));
      }

      delete schema.records[recordId];

      // Rebuild indexes to ensure consistency
      const updatedSchema = this.indexManager.rebuildIndexes(schema);
      await this.storageManager.save(updatedSchema);

      return Ok(undefined);
    } catch (error) {
      return this.handleError('Failed to delete record', error);
    }
  }

  async saveBatch(records: Record[]): Promise<Result<Record[], DomainError>> {
    try {
      const schema = await this.loadAndValidateSchema();

      for (const record of records) {
        const recordData = this.mapRecordToStorageData(record);
        schema.records[record.id.toString()] = recordData;
      }

      // Rebuild indexes to ensure consistency
      const updatedSchema = this.indexManager.rebuildIndexes(schema);
      await this.storageManager.save(updatedSchema);

      return Ok(records);
    } catch (error) {
      return this.handleError('Failed to save record batch', error);
    }
  }

  async deleteBatch(recordIds: RecordId[]): Promise<Result<void, DomainError>> {
    try {
      const schema = await this.loadAndValidateSchema();

      for (const recordId of recordIds) {
        const recordIdStr = recordId.toString();
        if (!schema.records[recordIdStr]) {
          return Err(new DomainError('RECORD_NOT_FOUND', 'Record not found'));
        }
        delete schema.records[recordIdStr];
      }

      // Rebuild indexes to ensure consistency
      const updatedSchema = this.indexManager.rebuildIndexes(schema);
      await this.storageManager.save(updatedSchema);

      return Ok(undefined);
    } catch (error) {
      return this.handleError('Failed to delete record batch', error);
    }
  }

  async deleteAll(): Promise<Result<void, DomainError>> {
    try {
      const schema = await this.loadAndValidateSchema();
      schema.records = {};

      // Rebuild indexes to ensure consistency
      const updatedSchema = this.indexManager.rebuildIndexes(schema);
      await this.storageManager.save(updatedSchema);

      return Ok(undefined);
    } catch (error) {
      return this.handleError('Failed to delete all records', error);
    }
  }

  async count(): Promise<Result<number, DomainError>> {
    try {
      const schema = await this.loadAndValidateSchema();
      const count = Object.keys(schema.records).length;
      return Ok(count);
    } catch (error) {
      return this.handleError('Failed to count records', error);
    }
  }

  async exists(id: RecordId): Promise<Result<boolean, DomainError>> {
    try {
      const schema = await this.loadAndValidateSchema();
      const exists = schema.records[id.toString()] !== undefined;
      return Ok(exists);
    } catch (error) {
      return this.handleError('Failed to check record existence', error);
    }
  }

  async getTagStatistics(): Promise<Result<TagStatistic[], DomainError>> {
    try {
      const schema = await this.loadAndValidateSchema();
      const tagCounts = new Map<string, number>();

      // Count occurrences of each tag across all records
      Object.values(schema.records).forEach((recordData) => {
        recordData.tagIds.forEach((tagId) => {
          tagCounts.set(tagId, (tagCounts.get(tagId) || 0) + 1);
        });
      });

      // Convert to TagStatistic array and sort by count descending, then by tag name
      const statistics: TagStatistic[] = Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => {
          // First sort by count descending
          const countDiff = b.count - a.count;
          if (countDiff !== 0) {
            return countDiff;
          }
          // If counts are equal, sort by tag name ascending
          return a.tag.localeCompare(b.tag);
        });

      return Ok(statistics);
    } catch (error) {
      return this.handleError('Failed to get tag statistics', error);
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

  private mapStorageDataToRecord(data: StorageRecordData): Record | null {
    try {
      const id = new RecordId(data.id);
      const content = new RecordContent(data.content);
      const tagIds = new Set(data.tagIds.map((tagId) => new TagId(tagId)));

      // Handle potentially invalid dates
      let createdAt: Date;
      let updatedAt: Date;

      try {
        createdAt = new Date(data.createdAt);
        updatedAt = new Date(data.updatedAt);

        // Check if dates are valid
        if (isNaN(createdAt.getTime())) {
          createdAt = new Date();
        }
        if (isNaN(updatedAt.getTime())) {
          updatedAt = new Date();
        }
      } catch {
        // Fallback to current date if parsing fails
        const now = new Date();
        createdAt = now;
        updatedAt = now;
      }

      return new Record(id, content, tagIds, createdAt, updatedAt);
    } catch (error) {
      // Log error but continue gracefully
      console.warn('Failed to map storage data to record:', error);
      return null;
    }
  }

  private mapRecordToStorageData(record: Record): StorageRecordData {
    return {
      id: record.id.toString(),
      content: record.content.toString(),
      tagIds: Array.from(record.tagIds).map((tagId) => tagId.toString()),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private buildSearchResult(
    records: Record[],
    options: RecordSearchOptions
  ): Result<RecordSearchResult, DomainError> {
    const {
      limit = Number.MAX_SAFE_INTEGER,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    // Sort records
    const sortedRecords = [...records].sort((a, b) => {
      let comparison = 0;

      if (sortBy === 'createdAt') {
        comparison = a.createdAt.getTime() - b.createdAt.getTime();
      } else if (sortBy === 'updatedAt') {
        comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    const total = sortedRecords.length;
    const paginatedRecords = sortedRecords.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return Ok({
      records: paginatedRecords,
      total,
      hasMore,
    });
  }

  private setsEqual<T>(set1: Set<T>, set2: Set<T>): boolean {
    if (set1.size !== set2.size) {
      return false;
    }

    for (const item of set1) {
      if (!set2.has(item)) {
        return false;
      }
    }

    return true;
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
