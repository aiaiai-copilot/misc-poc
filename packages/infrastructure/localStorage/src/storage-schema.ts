export interface StorageTagData {
  id: string;
  normalizedValue: string;
}

export interface StorageRecordData {
  id: string;
  content: string;
  tagIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StorageIndexes {
  normalizedToTagId: Record<string, string>;
  tagToRecords: Record<string, string[]>;
}

export interface StorageSchemaV21 {
  version: '2.1';
  tags: Record<string, StorageTagData>;
  records: Record<string, StorageRecordData>;
  indexes: StorageIndexes;
}

export interface LegacyStorageSchemaV20 {
  version: '2.0';
  tags: StorageTagData[];
  records: StorageRecordData[];
}

export type AnyStorageSchema = StorageSchemaV21 | LegacyStorageSchemaV20;

export class StorageSchema {
  static createEmpty(): StorageSchemaV21 {
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

  static isValid(schema: unknown): schema is StorageSchemaV21 {
    if (!schema || typeof schema !== 'object') {
      return false;
    }

    const s = schema as Record<string, unknown>;

    if (s.version !== '2.1') {
      return false;
    }

    if (!s.tags || typeof s.tags !== 'object' || Array.isArray(s.tags)) {
      return false;
    }

    if (
      !s.records ||
      typeof s.records !== 'object' ||
      Array.isArray(s.records)
    ) {
      return false;
    }

    if (!s.indexes || typeof s.indexes !== 'object') {
      return false;
    }

    const indexes = s.indexes as Record<string, unknown>;
    if (
      !indexes.normalizedToTagId ||
      typeof indexes.normalizedToTagId !== 'object' ||
      Array.isArray(indexes.normalizedToTagId)
    ) {
      return false;
    }

    if (
      !indexes.tagToRecords ||
      typeof indexes.tagToRecords !== 'object' ||
      Array.isArray(indexes.tagToRecords)
    ) {
      return false;
    }

    return true;
  }

  static needsMigration(schema: unknown): boolean {
    if (!schema || typeof schema !== 'object') {
      return true;
    }

    const s = schema as Record<string, unknown>;
    return s.version !== '2.1';
  }

  static migrate(oldSchema: LegacyStorageSchemaV20): StorageSchemaV21 {
    const newSchema = this.createEmpty();

    // Migrate tags from array to object
    if (oldSchema.tags && Array.isArray(oldSchema.tags)) {
      for (const tag of oldSchema.tags) {
        newSchema.tags[tag.id] = {
          id: tag.id,
          normalizedValue: tag.normalizedValue,
        };

        // Build normalizedToTagId index
        newSchema.indexes.normalizedToTagId[tag.normalizedValue] = tag.id;
      }
    }

    // Migrate records from array to object
    if (oldSchema.records && Array.isArray(oldSchema.records)) {
      for (const record of oldSchema.records) {
        newSchema.records[record.id] = {
          id: record.id,
          content: record.content,
          tagIds: record.tagIds,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        };

        // Build tagToRecords index
        for (const tagId of record.tagIds) {
          if (!newSchema.indexes.tagToRecords[tagId]) {
            newSchema.indexes.tagToRecords[tagId] = [];
          }
          newSchema.indexes.tagToRecords[tagId].push(record.id);
        }
      }
    }

    return newSchema;
  }

  static toJSON(schema: StorageSchemaV21): string {
    return JSON.stringify(schema);
  }

  static fromJSON(json: string): StorageSchemaV21 {
    let parsed: unknown;

    try {
      parsed = JSON.parse(json);
    } catch (error) {
      throw new Error(
        `Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    if (!this.isValid(parsed)) {
      throw new Error('Invalid storage schema structure');
    }

    return parsed;
  }
}
