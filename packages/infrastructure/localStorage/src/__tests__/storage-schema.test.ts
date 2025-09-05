import { StorageSchema } from '../storage-schema';
import { TagId, RecordId } from '@misc-poc/shared';

describe('StorageSchema', () => {
  describe('version 2.1 structure', () => {
    it('should create empty schema with version 2.1', () => {
      const schema = StorageSchema.createEmpty();

      expect(schema.version).toBe('2.1');
      expect(schema.tags).toEqual({});
      expect(schema.records).toEqual({});
      expect(schema.indexes.normalizedToTagId).toEqual({});
      expect(schema.indexes.tagToRecords).toEqual({});
    });

    it('should have tags as objects for O(1) access', () => {
      const schema = StorageSchema.createEmpty();
      const tagId = TagId.generate();

      // Tags should be stored as key-value pairs for O(1) access
      schema.tags[tagId.toString()] = {
        id: tagId.toString(),
        normalizedValue: 'test-tag',
      };

      expect(schema.tags[tagId.toString()]).toBeDefined();
      expect(schema.tags[tagId.toString()].normalizedValue).toBe('test-tag');
    });

    it('should have records as objects for O(1) access', () => {
      const schema = StorageSchema.createEmpty();
      const recordId = RecordId.generate();

      // Records should be stored as key-value pairs for O(1) access
      schema.records[recordId.toString()] = {
        id: recordId.toString(),
        content: 'Test content',
        tagIds: ['tag-1', 'tag-2'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(schema.records[recordId.toString()]).toBeDefined();
      expect(schema.records[recordId.toString()].content).toBe('Test content');
    });

    it('should have normalizedToTagId index for fast tag lookup', () => {
      const schema = StorageSchema.createEmpty();
      const tagId = TagId.generate();
      const normalizedValue = 'test-tag';

      // Index should map normalized tag values to tag IDs
      schema.indexes.normalizedToTagId[normalizedValue] = tagId.toString();

      expect(schema.indexes.normalizedToTagId[normalizedValue]).toBe(
        tagId.toString()
      );
    });

    it('should have tagToRecords index for fast record lookup by tag', () => {
      const schema = StorageSchema.createEmpty();
      const tagId = TagId.generate();
      const recordId1 = RecordId.generate();
      const recordId2 = RecordId.generate();

      // Index should map tag IDs to arrays of record IDs
      schema.indexes.tagToRecords[tagId.toString()] = [
        recordId1.toString(),
        recordId2.toString(),
      ];

      expect(schema.indexes.tagToRecords[tagId.toString()]).toEqual([
        recordId1.toString(),
        recordId2.toString(),
      ]);
    });
  });

  describe('schema validation', () => {
    it('should validate correct schema structure', () => {
      const schema = StorageSchema.createEmpty();

      expect(StorageSchema.isValid(schema)).toBe(true);
    });

    it('should reject null/undefined schema', () => {
      expect(StorageSchema.isValid(null)).toBe(false);
      expect(StorageSchema.isValid(undefined)).toBe(false);
    });

    it('should reject non-object schema', () => {
      expect(StorageSchema.isValid('not an object')).toBe(false);
      expect(StorageSchema.isValid(123)).toBe(false);
      expect(StorageSchema.isValid([])).toBe(false);
    });

    it('should reject schema without version', () => {
      const invalidSchema = {
        tags: {},
        records: {},
        indexes: { normalizedToTagId: {}, tagToRecords: {} },
      };

      expect(StorageSchema.isValid(invalidSchema)).toBe(false);
    });

    it('should reject schema with wrong version', () => {
      const invalidSchema = {
        version: '1.0',
        tags: {},
        records: {},
        indexes: { normalizedToTagId: {}, tagToRecords: {} },
      };

      expect(StorageSchema.isValid(invalidSchema)).toBe(false);
    });

    it('should reject schema with tags as array', () => {
      const invalidSchema = {
        version: '2.1',
        tags: [],
        records: {},
        indexes: { normalizedToTagId: {}, tagToRecords: {} },
      };

      expect(StorageSchema.isValid(invalidSchema)).toBe(false);
    });

    it('should reject schema with records as array', () => {
      const invalidSchema = {
        version: '2.1',
        tags: {},
        records: [],
        indexes: { normalizedToTagId: {}, tagToRecords: {} },
      };

      expect(StorageSchema.isValid(invalidSchema)).toBe(false);
    });

    it('should reject schema missing indexes', () => {
      const invalidSchema = {
        version: '2.1',
        tags: {},
        records: {},
      };

      expect(StorageSchema.isValid(invalidSchema)).toBe(false);
    });

    it('should reject schema with indexes as array', () => {
      const invalidSchema = {
        version: '2.1',
        tags: {},
        records: {},
        indexes: [],
      };

      expect(StorageSchema.isValid(invalidSchema)).toBe(false);
    });

    it('should reject schema with missing normalizedToTagId index', () => {
      const invalidSchema = {
        version: '2.1',
        tags: {},
        records: {},
        indexes: { tagToRecords: {} },
      };

      expect(StorageSchema.isValid(invalidSchema)).toBe(false);
    });

    it('should reject schema with normalizedToTagId index as array', () => {
      const invalidSchema = {
        version: '2.1',
        tags: {},
        records: {},
        indexes: { normalizedToTagId: [], tagToRecords: {} },
      };

      expect(StorageSchema.isValid(invalidSchema)).toBe(false);
    });

    it('should reject schema with missing tagToRecords index', () => {
      const invalidSchema = {
        version: '2.1',
        tags: {},
        records: {},
        indexes: { normalizedToTagId: {} },
      };

      expect(StorageSchema.isValid(invalidSchema)).toBe(false);
    });

    it('should reject schema with tagToRecords index as non-object', () => {
      const invalidSchema = {
        version: '2.1',
        tags: {},
        records: {},
        indexes: { normalizedToTagId: {}, tagToRecords: [] },
      };

      expect(StorageSchema.isValid(invalidSchema)).toBe(false);
    });
  });

  describe('migration support', () => {
    it('should detect if migration is needed', () => {
      const oldSchema = {
        version: '2.0',
        tags: [],
        records: [],
      };

      expect(StorageSchema.needsMigration(oldSchema)).toBe(true);
    });

    it('should not need migration for current version', () => {
      const currentSchema = StorageSchema.createEmpty();

      expect(StorageSchema.needsMigration(currentSchema)).toBe(false);
    });

    it('should need migration for null/undefined schema', () => {
      expect(StorageSchema.needsMigration(null)).toBe(true);
      expect(StorageSchema.needsMigration(undefined)).toBe(true);
    });

    it('should need migration for non-object schema', () => {
      expect(StorageSchema.needsMigration('not object')).toBe(true);
      expect(StorageSchema.needsMigration(123)).toBe(true);
    });

    it('should migrate from version 2.0 array-based to 2.1 object-based', () => {
      const oldSchema = {
        version: '2.0',
        tags: [
          { id: 'tag-1', normalizedValue: 'javascript' },
          { id: 'tag-2', normalizedValue: 'typescript' },
        ],
        records: [
          {
            id: 'record-1',
            content: 'Test content 1',
            tagIds: ['tag-1'],
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
          {
            id: 'record-2',
            content: 'Test content 2',
            tagIds: ['tag-1', 'tag-2'],
            createdAt: '2024-01-02T00:00:00Z',
            updatedAt: '2024-01-02T00:00:00Z',
          },
        ],
      };

      const migratedSchema = StorageSchema.migrate(oldSchema);

      expect(migratedSchema.version).toBe('2.1');
      expect(migratedSchema.tags).toEqual({
        'tag-1': { id: 'tag-1', normalizedValue: 'javascript' },
        'tag-2': { id: 'tag-2', normalizedValue: 'typescript' },
      });
      expect(migratedSchema.records).toEqual({
        'record-1': {
          id: 'record-1',
          content: 'Test content 1',
          tagIds: ['tag-1'],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        'record-2': {
          id: 'record-2',
          content: 'Test content 2',
          tagIds: ['tag-1', 'tag-2'],
          createdAt: '2024-01-02T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
        },
      });
      expect(migratedSchema.indexes.normalizedToTagId).toEqual({
        javascript: 'tag-1',
        typescript: 'tag-2',
      });
      expect(migratedSchema.indexes.tagToRecords).toEqual({
        'tag-1': ['record-1', 'record-2'],
        'tag-2': ['record-2'],
      });
    });

    it('should handle empty migration gracefully', () => {
      const oldSchema = {
        version: '2.0',
        tags: [],
        records: [],
      };

      const migratedSchema = StorageSchema.migrate(oldSchema);

      expect(migratedSchema.version).toBe('2.1');
      expect(migratedSchema.tags).toEqual({});
      expect(migratedSchema.records).toEqual({});
      expect(migratedSchema.indexes.normalizedToTagId).toEqual({});
      expect(migratedSchema.indexes.tagToRecords).toEqual({});
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON', () => {
      const schema = StorageSchema.createEmpty();
      const json = StorageSchema.toJSON(schema);

      expect(typeof json).toBe('string');
      const parsed = JSON.parse(json);
      expect(parsed.version).toBe('2.1');
    });

    it('should deserialize from JSON', () => {
      const schema = StorageSchema.createEmpty();
      const json = StorageSchema.toJSON(schema);
      const deserialized = StorageSchema.fromJSON(json);

      expect(deserialized).toEqual(schema);
    });

    it('should handle deserialization of invalid JSON', () => {
      expect(() => StorageSchema.fromJSON('invalid json')).toThrow(
        'Invalid JSON:'
      );
    });

    it('should handle deserialization of invalid schema', () => {
      const invalidJson = JSON.stringify({ version: '1.0' });

      expect(() => StorageSchema.fromJSON(invalidJson)).toThrow(
        'Invalid storage schema structure'
      );
    });

    it('should handle general JSON parse error', () => {
      const spy = jest.spyOn(JSON, 'parse').mockImplementationOnce(() => {
        throw 'Custom error';
      });

      expect(() => StorageSchema.fromJSON('{"valid": "json"}')).toThrow(
        'Invalid JSON: Unknown error'
      );

      spy.mockRestore();
    });
  });
});
