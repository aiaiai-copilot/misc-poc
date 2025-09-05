import { IndexManager } from '../index-manager';
import { StorageSchema, type StorageSchemaV21 } from '../storage-schema';

describe('IndexManager', () => {
  let indexManager: IndexManager;
  let mockSchema: StorageSchemaV21;

  beforeEach(() => {
    indexManager = new IndexManager();

    // Create a mock schema with test data
    mockSchema = {
      version: '2.1',
      tags: {
        tag1: { id: 'tag1', normalizedValue: 'javascript' },
        tag2: { id: 'tag2', normalizedValue: 'typescript' },
        tag3: { id: 'tag3', normalizedValue: 'react' },
        tag4: { id: 'tag4', normalizedValue: 'nodejs' },
      },
      records: {
        rec1: {
          id: 'rec1',
          content: 'Learning JavaScript basics',
          tagIds: ['tag1'],
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        },
        rec2: {
          id: 'rec2',
          content: 'TypeScript and React tutorial',
          tagIds: ['tag2', 'tag3'],
          createdAt: '2023-01-02T00:00:00Z',
          updatedAt: '2023-01-02T00:00:00Z',
        },
        rec3: {
          id: 'rec3',
          content: 'Node.js backend development',
          tagIds: ['tag4', 'tag1'],
          createdAt: '2023-01-03T00:00:00Z',
          updatedAt: '2023-01-03T00:00:00Z',
        },
      },
      indexes: {
        normalizedToTagId: {
          javascript: 'tag1',
          typescript: 'tag2',
          react: 'tag3',
          nodejs: 'tag4',
        },
        tagToRecords: {
          tag1: ['rec1', 'rec3'],
          tag2: ['rec2'],
          tag3: ['rec2'],
          tag4: ['rec3'],
        },
      },
    };
  });

  describe('initialization', () => {
    it('should create a new IndexManager instance', () => {
      expect(indexManager).toBeInstanceOf(IndexManager);
    });
  });

  describe('rebuildIndexes', () => {
    it('should rebuild both normalizedToTagId and tagToRecords indexes correctly', () => {
      // Start with corrupted/empty indexes
      const corruptedSchema: StorageSchemaV21 = {
        ...mockSchema,
        indexes: {
          normalizedToTagId: {},
          tagToRecords: {},
        },
      };

      const rebuiltSchema = indexManager.rebuildIndexes(corruptedSchema);

      expect(rebuiltSchema.indexes.normalizedToTagId).toEqual({
        javascript: 'tag1',
        typescript: 'tag2',
        react: 'tag3',
        nodejs: 'tag4',
      });

      expect(rebuiltSchema.indexes.tagToRecords).toEqual({
        tag1: ['rec1', 'rec3'],
        tag2: ['rec2'],
        tag3: ['rec2'],
        tag4: ['rec3'],
      });
    });

    it('should handle empty schema gracefully', () => {
      const emptySchema = StorageSchema.createEmpty();
      const rebuiltSchema = indexManager.rebuildIndexes(emptySchema);

      expect(rebuiltSchema.indexes.normalizedToTagId).toEqual({});
      expect(rebuiltSchema.indexes.tagToRecords).toEqual({});
    });

    it('should remove orphaned tags from indexes during rebuild', () => {
      const schemaWithOrphanedTags: StorageSchemaV21 = {
        ...mockSchema,
        tags: {
          tag1: { id: 'tag1', normalizedValue: 'javascript' },
          tag2: { id: 'tag2', normalizedValue: 'typescript' },
          // tag3 and tag4 removed, but still referenced in indexes and records
        },
        records: {
          rec1: {
            id: 'rec1',
            content: 'Learning JavaScript basics',
            tagIds: ['tag1'],
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z',
          },
          rec2: {
            id: 'rec2',
            content: 'TypeScript tutorial',
            tagIds: ['tag2', 'tag3'], // tag3 is orphaned
            createdAt: '2023-01-02T00:00:00Z',
            updatedAt: '2023-01-02T00:00:00Z',
          },
        },
      };

      const rebuiltSchema = indexManager.rebuildIndexes(schemaWithOrphanedTags);

      expect(rebuiltSchema.indexes.normalizedToTagId).toEqual({
        javascript: 'tag1',
        typescript: 'tag2',
      });
      expect(rebuiltSchema.indexes.tagToRecords).toEqual({
        tag1: ['rec1'],
        tag2: ['rec2'],
      });
    });

    it('should remove duplicate record IDs from tagToRecords index', () => {
      const schemaWithDuplicates: StorageSchemaV21 = {
        ...mockSchema,
        records: {
          rec1: {
            id: 'rec1',
            content: 'Learning JavaScript basics',
            tagIds: ['tag1', 'tag1'], // Duplicate tag reference
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z',
          },
        },
      };

      const rebuiltSchema = indexManager.rebuildIndexes(schemaWithDuplicates);

      expect(rebuiltSchema.indexes.tagToRecords['tag1']).toEqual(['rec1']);
      expect(rebuiltSchema.indexes.tagToRecords['tag1'].length).toBe(1);
    });

    it('should preserve original schema structure while rebuilding indexes', () => {
      const originalSchema = JSON.parse(JSON.stringify(mockSchema));
      const rebuiltSchema = indexManager.rebuildIndexes(mockSchema);

      expect(rebuiltSchema.version).toBe(originalSchema.version);
      expect(rebuiltSchema.tags).toEqual(originalSchema.tags);
      expect(rebuiltSchema.records).toEqual(originalSchema.records);
    });

    it('should handle schema with no records but with tags', () => {
      const schemaNoRecords: StorageSchemaV21 = {
        version: '2.1',
        tags: {
          tag1: { id: 'tag1', normalizedValue: 'javascript' },
          tag2: { id: 'tag2', normalizedValue: 'typescript' },
        },
        records: {},
        indexes: {
          normalizedToTagId: {},
          tagToRecords: {},
        },
      };

      const rebuiltSchema = indexManager.rebuildIndexes(schemaNoRecords);

      expect(rebuiltSchema.indexes.normalizedToTagId).toEqual({
        javascript: 'tag1',
        typescript: 'tag2',
      });
      expect(rebuiltSchema.indexes.tagToRecords).toEqual({});
    });
  });

  describe('checkConsistency', () => {
    it('should return true for consistent indexes', () => {
      const isConsistent = indexManager.checkConsistency(mockSchema);
      expect(isConsistent).toBe(true);
    });

    it('should return false when normalizedToTagId index is inconsistent', () => {
      const inconsistentSchema: StorageSchemaV21 = {
        ...mockSchema,
        indexes: {
          ...mockSchema.indexes,
          normalizedToTagId: {
            javascript: 'tag1',
            'wrong-normalized': 'tag2', // Should be 'typescript'
            react: 'tag3',
            nodejs: 'tag4',
          },
        },
      };

      const isConsistent = indexManager.checkConsistency(inconsistentSchema);
      expect(isConsistent).toBe(false);
    });

    it('should return false when normalizedToTagId points to non-existent tag', () => {
      const inconsistentSchema: StorageSchemaV21 = {
        ...mockSchema,
        indexes: {
          ...mockSchema.indexes,
          normalizedToTagId: {
            javascript: 'tag1',
            typescript: 'non-existent-tag',
            react: 'tag3',
            nodejs: 'tag4',
          },
        },
      };

      const isConsistent = indexManager.checkConsistency(inconsistentSchema);
      expect(isConsistent).toBe(false);
    });

    it('should return false when tagToRecords index points to non-existent tag', () => {
      const inconsistentSchema: StorageSchemaV21 = {
        ...mockSchema,
        indexes: {
          ...mockSchema.indexes,
          tagToRecords: {
            ...mockSchema.indexes.tagToRecords,
            'non-existent-tag': ['rec1'],
          },
        },
      };

      const isConsistent = indexManager.checkConsistency(inconsistentSchema);
      expect(isConsistent).toBe(false);
    });

    it('should return false when tagToRecords index points to non-existent record', () => {
      const inconsistentSchema: StorageSchemaV21 = {
        ...mockSchema,
        indexes: {
          ...mockSchema.indexes,
          tagToRecords: {
            ...mockSchema.indexes.tagToRecords,
            tag1: ['rec1', 'non-existent-record'],
          },
        },
      };

      const isConsistent = indexManager.checkConsistency(inconsistentSchema);
      expect(isConsistent).toBe(false);
    });

    it('should return false when record tagIds do not match tagToRecords index', () => {
      const inconsistentSchema: StorageSchemaV21 = {
        ...mockSchema,
        indexes: {
          ...mockSchema.indexes,
          tagToRecords: {
            tag1: ['rec1', 'rec3'],
            tag2: ['rec2'],
            tag3: ['rec2'],
            tag4: ['rec3', 'rec2'], // rec2 should not be here
          },
        },
      };

      const isConsistent = indexManager.checkConsistency(inconsistentSchema);
      expect(isConsistent).toBe(false);
    });

    it('should return false when missing index entries for existing tags', () => {
      const inconsistentSchema: StorageSchemaV21 = {
        ...mockSchema,
        indexes: {
          normalizedToTagId: {
            javascript: 'tag1',
            // Missing entries for tag2, tag3, tag4
          },
          tagToRecords: {
            tag1: ['rec1', 'rec3'],
            // Missing entries for tag2, tag3, tag4
          },
        },
      };

      const isConsistent = indexManager.checkConsistency(inconsistentSchema);
      expect(isConsistent).toBe(false);
    });

    it('should return true for empty schema', () => {
      const emptySchema = StorageSchema.createEmpty();
      const isConsistent = indexManager.checkConsistency(emptySchema);
      expect(isConsistent).toBe(true);
    });

    it('should handle schema with empty indexes gracefully', () => {
      const schemaEmptyIndexes: StorageSchemaV21 = {
        ...mockSchema,
        indexes: {
          normalizedToTagId: {},
          tagToRecords: {},
        },
      };

      const isConsistent = indexManager.checkConsistency(schemaEmptyIndexes);
      expect(isConsistent).toBe(false); // Should be false because tags exist but indexes are empty
    });
  });

  describe('optimizeForSearch', () => {
    it('should optimize normalizedToTagId index for fast lookups', () => {
      const optimizedSchema = indexManager.optimizeForSearch(mockSchema);

      // Should maintain the same data but potentially reorganized
      expect(optimizedSchema.indexes.normalizedToTagId).toEqual(
        mockSchema.indexes.normalizedToTagId
      );
      expect(
        Object.keys(optimizedSchema.indexes.normalizedToTagId)
      ).toHaveLength(4);
    });

    it('should optimize tagToRecords index for efficient searching', () => {
      const optimizedSchema = indexManager.optimizeForSearch(mockSchema);

      // Should maintain the same data but potentially reorganized
      expect(optimizedSchema.indexes.tagToRecords).toEqual(
        mockSchema.indexes.tagToRecords
      );
    });

    it('should sort record IDs in tagToRecords for consistent ordering', () => {
      const unorderedSchema: StorageSchemaV21 = {
        ...mockSchema,
        indexes: {
          ...mockSchema.indexes,
          tagToRecords: {
            tag1: ['rec3', 'rec1'], // Unordered
            tag2: ['rec2'],
            tag3: ['rec2'],
            tag4: ['rec3'],
          },
        },
      };

      const optimizedSchema = indexManager.optimizeForSearch(unorderedSchema);

      expect(optimizedSchema.indexes.tagToRecords['tag1']).toEqual([
        'rec1',
        'rec3',
      ]); // Should be sorted
    });

    it('should handle empty schema optimization', () => {
      const emptySchema = StorageSchema.createEmpty();
      const optimizedSchema = indexManager.optimizeForSearch(emptySchema);

      expect(optimizedSchema).toEqual(emptySchema);
    });

    it('should preserve all non-index data during optimization', () => {
      const optimizedSchema = indexManager.optimizeForSearch(mockSchema);

      expect(optimizedSchema.version).toBe(mockSchema.version);
      expect(optimizedSchema.tags).toEqual(mockSchema.tags);
      expect(optimizedSchema.records).toEqual(mockSchema.records);
    });
  });

  describe('repairCorruption', () => {
    it('should repair corrupted indexes by rebuilding them', () => {
      const corruptedSchema: StorageSchemaV21 = {
        ...mockSchema,
        indexes: {
          normalizedToTagId: {
            'wrong-key': 'wrong-value',
          },
          tagToRecords: {
            'wrong-tag': ['wrong-record'],
          },
        },
      };

      const repairedSchema = indexManager.repairCorruption(corruptedSchema);

      expect(repairedSchema.indexes.normalizedToTagId).toEqual({
        javascript: 'tag1',
        typescript: 'tag2',
        react: 'tag3',
        nodejs: 'tag4',
      });

      expect(repairedSchema.indexes.tagToRecords).toEqual({
        tag1: ['rec1', 'rec3'],
        tag2: ['rec2'],
        tag3: ['rec2'],
        tag4: ['rec3'],
      });
    });

    it('should verify consistency after repair', () => {
      const corruptedSchema: StorageSchemaV21 = {
        ...mockSchema,
        indexes: {
          normalizedToTagId: {},
          tagToRecords: {},
        },
      };

      const repairedSchema = indexManager.repairCorruption(corruptedSchema);
      const isConsistent = indexManager.checkConsistency(repairedSchema);

      expect(isConsistent).toBe(true);
    });

    it('should handle already consistent schema gracefully', () => {
      const repairedSchema = indexManager.repairCorruption(mockSchema);

      expect(repairedSchema).toEqual(mockSchema);
    });

    it('should clean up orphaned references during repair', () => {
      const schemaWithOrphans: StorageSchemaV21 = {
        ...mockSchema,
        tags: {
          tag1: { id: 'tag1', normalizedValue: 'javascript' },
        },
        records: {
          rec1: {
            id: 'rec1',
            content: 'Learning JavaScript basics',
            tagIds: ['tag1', 'orphaned-tag'], // orphaned-tag doesn't exist
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z',
          },
        },
        indexes: {
          normalizedToTagId: {
            javascript: 'tag1',
            orphaned: 'orphaned-tag', // Orphaned entry
          },
          tagToRecords: {
            tag1: ['rec1'],
            'orphaned-tag': ['rec1'], // Orphaned entry
          },
        },
      };

      const repairedSchema = indexManager.repairCorruption(schemaWithOrphans);

      expect(repairedSchema.indexes.normalizedToTagId).toEqual({
        javascript: 'tag1',
      });
      expect(repairedSchema.indexes.tagToRecords).toEqual({
        tag1: ['rec1'],
      });
    });
  });

  describe('getIndexStatistics', () => {
    it('should return correct statistics for indexes', () => {
      const stats = indexManager.getIndexStatistics(mockSchema);

      expect(stats).toEqual({
        totalTags: 4,
        totalRecords: 3,
        normalizedToTagIdEntries: 4,
        tagToRecordsEntries: 4,
        averageRecordsPerTag: 1.25, // (2 + 1 + 1 + 1) / 4 = 1.25 (tag1: 2 records, others: 1 each)
        maxRecordsPerTag: 2,
        minRecordsPerTag: 1,
        orphanedTagCount: 0,
        orphanedRecordCount: 0,
      });
    });

    it('should calculate statistics correctly for empty schema', () => {
      const emptySchema = StorageSchema.createEmpty();
      const stats = indexManager.getIndexStatistics(emptySchema);

      expect(stats).toEqual({
        totalTags: 0,
        totalRecords: 0,
        normalizedToTagIdEntries: 0,
        tagToRecordsEntries: 0,
        averageRecordsPerTag: 0,
        maxRecordsPerTag: 0,
        minRecordsPerTag: 0,
        orphanedTagCount: 0,
        orphanedRecordCount: 0,
      });
    });

    it('should detect orphaned tags in statistics', () => {
      const schemaWithOrphans: StorageSchemaV21 = {
        ...mockSchema,
        tags: {
          ...mockSchema.tags,
          'orphaned-tag': { id: 'orphaned-tag', normalizedValue: 'orphaned' },
        },
        indexes: {
          ...mockSchema.indexes,
          normalizedToTagId: {
            ...mockSchema.indexes.normalizedToTagId,
            orphaned: 'orphaned-tag',
          },
        },
      };

      const stats = indexManager.getIndexStatistics(schemaWithOrphans);
      expect(stats.orphanedTagCount).toBe(1);
    });

    it('should handle schema with varying records per tag', () => {
      const varyingSchema: StorageSchemaV21 = {
        ...mockSchema,
        indexes: {
          ...mockSchema.indexes,
          tagToRecords: {
            tag1: ['rec1'], // 1 record
            tag2: ['rec2', 'rec3'], // 2 records
            tag3: ['rec1', 'rec2', 'rec3'], // 3 records
            tag4: [], // 0 records
          },
        },
      };

      const stats = indexManager.getIndexStatistics(varyingSchema);
      expect(stats.maxRecordsPerTag).toBe(3);
      expect(stats.minRecordsPerTag).toBe(0);
      expect(stats.averageRecordsPerTag).toBe(1.5); // (1 + 2 + 3 + 0) / 4 = 1.5
    });
  });

  describe('performance optimization', () => {
    it('should handle large datasets efficiently', () => {
      // Create a large schema for performance testing
      const largeSchema = StorageSchema.createEmpty();

      // Add 1000 tags and 5000 records for performance testing
      for (let i = 0; i < 1000; i++) {
        const tagId = `tag${i}`;
        largeSchema.tags[tagId] = {
          id: tagId,
          normalizedValue: `tag-${i}`,
        };
        largeSchema.indexes.normalizedToTagId[`tag-${i}`] = tagId;
      }

      for (let i = 0; i < 5000; i++) {
        const recordId = `rec${i}`;
        const tagIds = [`tag${i % 1000}`]; // Each record has one tag
        largeSchema.records[recordId] = {
          id: recordId,
          content: `Record ${i} content`,
          tagIds,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        };

        // Update tagToRecords index
        for (const tagId of tagIds) {
          if (!largeSchema.indexes.tagToRecords[tagId]) {
            largeSchema.indexes.tagToRecords[tagId] = [];
          }
          largeSchema.indexes.tagToRecords[tagId].push(recordId);
        }
      }

      const startTime = performance.now();
      const rebuiltSchema = indexManager.rebuildIndexes(largeSchema);
      const endTime = performance.now();

      expect(Object.keys(rebuiltSchema.indexes.normalizedToTagId)).toHaveLength(
        1000
      );
      expect(Object.keys(rebuiltSchema.indexes.tagToRecords)).toHaveLength(
        1000
      );
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should maintain performance during consistency checks on large datasets', () => {
      // Use the same large schema as above but simplified for testing
      const largeSchema = StorageSchema.createEmpty();

      for (let i = 0; i < 100; i++) {
        const tagId = `tag${i}`;
        largeSchema.tags[tagId] = {
          id: tagId,
          normalizedValue: `tag-${i}`,
        };
        largeSchema.indexes.normalizedToTagId[`tag-${i}`] = tagId;
        largeSchema.indexes.tagToRecords[tagId] = [`rec${i}`];
      }

      for (let i = 0; i < 100; i++) {
        const recordId = `rec${i}`;
        largeSchema.records[recordId] = {
          id: recordId,
          content: `Record ${i} content`,
          tagIds: [`tag${i}`],
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        };
      }

      const startTime = performance.now();
      const isConsistent = indexManager.checkConsistency(largeSchema);
      const endTime = performance.now();

      expect(isConsistent).toBe(true);
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });
  });

  describe('error handling', () => {
    it('should handle null or undefined schema gracefully', () => {
      expect(() => indexManager.rebuildIndexes(null as any)).not.toThrow();
      expect(() =>
        indexManager.checkConsistency(undefined as any)
      ).not.toThrow();
      expect(() => indexManager.optimizeForSearch(null as any)).not.toThrow();
      expect(() =>
        indexManager.repairCorruption(undefined as any)
      ).not.toThrow();
    });

    it('should handle malformed schema objects', () => {
      const malformedSchema = {
        version: '2.1',
        // Missing required properties
      } as any;

      expect(() => indexManager.rebuildIndexes(malformedSchema)).not.toThrow();
      expect(() =>
        indexManager.checkConsistency(malformedSchema)
      ).not.toThrow();
    });

    it('should handle circular references gracefully', () => {
      const circularSchema: any = {
        version: '2.1',
        tags: {},
        records: {},
        indexes: {
          normalizedToTagId: {},
          tagToRecords: {},
        },
      };
      // Create circular reference
      circularSchema.circular = circularSchema;

      expect(() => indexManager.rebuildIndexes(circularSchema)).not.toThrow();
      expect(() => indexManager.checkConsistency(circularSchema)).not.toThrow();
    });
  });

  describe('integration with StorageSchema', () => {
    it('should work correctly with schemas created by StorageSchema.createEmpty()', () => {
      const emptySchema = StorageSchema.createEmpty();

      const rebuiltSchema = indexManager.rebuildIndexes(emptySchema);
      const isConsistent = indexManager.checkConsistency(rebuiltSchema);
      const optimizedSchema = indexManager.optimizeForSearch(rebuiltSchema);
      const repairedSchema = indexManager.repairCorruption(optimizedSchema);

      expect(isConsistent).toBe(true);
      expect(StorageSchema.isValid(rebuiltSchema)).toBe(true);
      expect(StorageSchema.isValid(optimizedSchema)).toBe(true);
      expect(StorageSchema.isValid(repairedSchema)).toBe(true);
    });

    it('should maintain schema validity after all operations', () => {
      const rebuiltSchema = indexManager.rebuildIndexes(mockSchema);
      const optimizedSchema = indexManager.optimizeForSearch(rebuiltSchema);
      const repairedSchema = indexManager.repairCorruption(optimizedSchema);

      expect(StorageSchema.isValid(rebuiltSchema)).toBe(true);
      expect(StorageSchema.isValid(optimizedSchema)).toBe(true);
      expect(StorageSchema.isValid(repairedSchema)).toBe(true);
    });
  });
});
