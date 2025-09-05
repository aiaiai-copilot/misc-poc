import type { StorageSchemaV21 } from './storage-schema';

export interface IndexStatistics {
  totalTags: number;
  totalRecords: number;
  normalizedToTagIdEntries: number;
  tagToRecordsEntries: number;
  averageRecordsPerTag: number;
  maxRecordsPerTag: number;
  minRecordsPerTag: number;
  orphanedTagCount: number;
  orphanedRecordCount: number;
}

/**
 * IndexManager manages and optimizes search indexes for localStorage operations.
 * It handles index rebuilding, consistency checking, performance optimization,
 * and corruption recovery for the normalizedToTagId and tagToRecords indexes.
 */
export class IndexManager {
  /**
   * Rebuilds both normalizedToTagId and tagToRecords indexes from scratch.
   * This is useful for repairing corrupted indexes or migrating data.
   */
  rebuildIndexes(schema: StorageSchemaV21): StorageSchemaV21 {
    if (!schema || typeof schema !== 'object') {
      return this.createEmptySchema();
    }

    const rebuiltSchema: StorageSchemaV21 = {
      ...schema,
      indexes: {
        normalizedToTagId: {},
        tagToRecords: {},
      },
    };

    // Ensure we have valid collections
    const tags = schema.tags || {};
    const records = schema.records || {};

    // Rebuild normalizedToTagId index
    for (const [tagId, tag] of Object.entries(tags)) {
      if (tag && typeof tag === 'object' && tag.normalizedValue) {
        rebuiltSchema.indexes.normalizedToTagId[tag.normalizedValue] = tagId;
      }
    }

    // Rebuild tagToRecords index
    for (const [recordId, record] of Object.entries(records)) {
      if (record && Array.isArray(record.tagIds)) {
        for (const tagId of record.tagIds) {
          // Only add if the tag actually exists
          if (tags[tagId]) {
            if (!rebuiltSchema.indexes.tagToRecords[tagId]) {
              rebuiltSchema.indexes.tagToRecords[tagId] = [];
            }
            rebuiltSchema.indexes.tagToRecords[tagId].push(recordId);
          }
        }
      }
    }

    // Remove duplicates from tagToRecords arrays
    for (const [tagId, recordIds] of Object.entries(
      rebuiltSchema.indexes.tagToRecords
    )) {
      rebuiltSchema.indexes.tagToRecords[tagId] = [...new Set(recordIds)];
    }

    return rebuiltSchema;
  }

  /**
   * Checks if the indexes are consistent with the actual data.
   * Returns true if indexes are accurate, false otherwise.
   */
  checkConsistency(schema: StorageSchemaV21): boolean {
    if (!schema || typeof schema !== 'object') {
      return false;
    }

    const { tags = {}, records = {}, indexes } = schema;

    if (!indexes || typeof indexes !== 'object') {
      return false;
    }

    const { normalizedToTagId = {}, tagToRecords = {} } = indexes;

    // Check normalizedToTagId index consistency
    for (const [normalizedValue, tagId] of Object.entries(normalizedToTagId)) {
      const tag = tags[tagId];
      if (!tag || tag.normalizedValue !== normalizedValue) {
        return false;
      }
    }

    // Verify all tags have corresponding index entries
    for (const [tagId, tag] of Object.entries(tags)) {
      if (!tag || !tag.normalizedValue) {
        continue;
      }

      if (normalizedToTagId[tag.normalizedValue] !== tagId) {
        return false;
      }
    }

    // Check tagToRecords index consistency
    for (const [tagId, recordIds] of Object.entries(tagToRecords)) {
      const tag = tags[tagId];
      if (!tag) {
        return false;
      }

      if (!Array.isArray(recordIds)) {
        return false;
      }

      for (const recordId of recordIds) {
        const record = records[recordId];
        if (
          !record ||
          !Array.isArray(record.tagIds) ||
          !record.tagIds.includes(tagId)
        ) {
          return false;
        }
      }
    }

    // Verify all record-tag relationships are indexed
    for (const [recordId, record] of Object.entries(records)) {
      if (!record || !Array.isArray(record.tagIds)) {
        continue;
      }

      for (const tagId of record.tagIds) {
        if (!tags[tagId]) {
          continue; // Skip orphaned tag references
        }

        const indexedRecords = tagToRecords[tagId] || [];
        if (!indexedRecords.includes(recordId)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Optimizes indexes for search performance.
   * Sorts arrays and reorganizes data structures for efficient lookups.
   */
  optimizeForSearch(schema: StorageSchemaV21): StorageSchemaV21 {
    if (!schema || typeof schema !== 'object') {
      return this.createEmptySchema();
    }

    const optimizedSchema: StorageSchemaV21 = {
      ...schema,
      indexes: {
        normalizedToTagId: { ...(schema.indexes?.normalizedToTagId || {}) },
        tagToRecords: {},
      },
    };

    // Optimize tagToRecords by sorting record IDs for consistent ordering
    const tagToRecords = schema.indexes?.tagToRecords || {};
    for (const [tagId, recordIds] of Object.entries(tagToRecords)) {
      if (Array.isArray(recordIds)) {
        optimizedSchema.indexes.tagToRecords[tagId] = [...recordIds].sort();
      }
    }

    return optimizedSchema;
  }

  /**
   * Repairs corrupted indexes by rebuilding them from the source data.
   * Also performs optimization after repair.
   */
  repairCorruption(schema: StorageSchemaV21): StorageSchemaV21 {
    if (!schema || typeof schema !== 'object') {
      return this.createEmptySchema();
    }

    // First, rebuild the indexes
    const rebuiltSchema = this.rebuildIndexes(schema);

    // Then optimize them for search performance
    const optimizedSchema = this.optimizeForSearch(rebuiltSchema);

    return optimizedSchema;
  }

  /**
   * Provides statistics about the indexes for monitoring and debugging.
   */
  getIndexStatistics(schema: StorageSchemaV21): IndexStatistics {
    if (!schema || typeof schema !== 'object') {
      return this.getEmptyStatistics();
    }

    const { tags = {}, records = {}, indexes } = schema;
    const { normalizedToTagId = {}, tagToRecords = {} } = indexes || {};

    const totalTags = Object.keys(tags).length;
    const totalRecords = Object.keys(records).length;
    const normalizedToTagIdEntries = Object.keys(normalizedToTagId).length;
    const tagToRecordsEntries = Object.keys(tagToRecords).length;

    // Calculate records per tag statistics
    const recordCounts = Object.values(tagToRecords)
      .filter((recordIds) => Array.isArray(recordIds))
      .map((recordIds) => recordIds.length);

    const maxRecordsPerTag =
      recordCounts.length > 0 ? Math.max(...recordCounts) : 0;
    const minRecordsPerTag =
      recordCounts.length > 0 ? Math.min(...recordCounts) : 0;
    const averageRecordsPerTag =
      recordCounts.length > 0
        ? recordCounts.reduce((sum, count) => sum + count, 0) /
          recordCounts.length
        : 0;

    // Count orphaned tags (tags that exist but have no records)
    let orphanedTagCount = 0;
    for (const tagId of Object.keys(tags)) {
      const recordIds = tagToRecords[tagId];
      if (!recordIds || recordIds.length === 0) {
        orphanedTagCount++;
      }
    }

    // Count orphaned records (would require more complex analysis of actual data vs indexes)
    const orphanedRecordCount = 0;

    return {
      totalTags,
      totalRecords,
      normalizedToTagIdEntries,
      tagToRecordsEntries,
      averageRecordsPerTag,
      maxRecordsPerTag,
      minRecordsPerTag,
      orphanedTagCount,
      orphanedRecordCount,
    };
  }

  /**
   * Creates an empty schema structure for error handling.
   */
  private createEmptySchema(): StorageSchemaV21 {
    return {
      version: '2.1',
      tags: {},
      records: {},
      indexes: {
        normalizedToTagId: {},
        tagToRecords: {},
      },
    };
  }

  /**
   * Creates empty statistics for error handling.
   */
  private getEmptyStatistics(): IndexStatistics {
    return {
      totalTags: 0,
      totalRecords: 0,
      normalizedToTagIdEntries: 0,
      tagToRecordsEntries: 0,
      averageRecordsPerTag: 0,
      maxRecordsPerTag: 0,
      minRecordsPerTag: 0,
      orphanedTagCount: 0,
      orphanedRecordCount: 0,
    };
  }
}
