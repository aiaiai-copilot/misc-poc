import { TagCloudBuilder, TagCloudBuilderConfig } from '../tag-cloud-builder';
import { SearchResultDTO } from '../../dtos/search-result-dto';
import { RecordDTO } from '../../dtos/record-dto';
import { TagUsageInfo } from '../../ports/tag-repository';
import { TagCloudItemDTO } from '../../dtos/tag-cloud-item-dto';
import { Tag } from '@misc-poc/domain';
import { TagId } from '@misc-poc/shared';

describe('TagCloudBuilder', () => {
  let builder: TagCloudBuilder;
  let mockTagRepository: {
    getUsageInfo: jest.Mock;
  };

  const createMockRecord = (id: string, tagIds: string[]): RecordDTO => ({
    id,
    content: `Content for ${id}`,
    tagIds,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const createMockTag = (id: string, normalizedValue: string): Tag => {
    return new Tag(new TagId(id), normalizedValue);
  };

  const createMockTagUsageInfo = (
    id: string,
    normalizedValue: string,
    usageCount: number
  ): TagUsageInfo => ({
    tag: createMockTag(id, normalizedValue),
    usageCount,
  });

  // Mock UUIDs for testing
  const mockUUIDs = {
    tag1: '550e8400-e29b-41d4-a716-446655440001',
    tag2: '550e8400-e29b-41d4-a716-446655440002',
    tag3: '550e8400-e29b-41d4-a716-446655440003',
    tag4: '550e8400-e29b-41d4-a716-446655440004',
    tag5: '550e8400-e29b-41d4-a716-446655440005',
  } as const;

  beforeEach(() => {
    mockTagRepository = {
      getUsageInfo: jest.fn(),
    };
    builder = new TagCloudBuilder(mockTagRepository as any);
  });

  describe('constructor', () => {
    it('should create instance with default configuration', () => {
      expect(builder).toBeInstanceOf(TagCloudBuilder);
    });

    it('should accept custom configuration', () => {
      const customBuilder = new TagCloudBuilder(mockTagRepository as any, {
        maxCloudSize: 50,
        minFrequency: 2,
        maxFrequency: 100,
      });
      expect(customBuilder).toBeInstanceOf(TagCloudBuilder);
    });

    it('should throw error for invalid maxCloudSize', () => {
      expect(() => {
        new TagCloudBuilder(mockTagRepository as any, {
          maxCloudSize: 0,
        });
      }).toThrow('maxCloudSize must be greater than 0');
    });

    it('should throw error for invalid frequency range', () => {
      expect(() => {
        new TagCloudBuilder(mockTagRepository as any, {
          minFrequency: 10,
          maxFrequency: 5,
        });
      }).toThrow('maxFrequency must be greater than minFrequency');
    });

    it('should throw error for negative frequency values', () => {
      expect(() => {
        new TagCloudBuilder(mockTagRepository as any, {
          minFrequency: -1,
        });
      }).toThrow('minFrequency must be non-negative');

      expect(() => {
        new TagCloudBuilder(mockTagRepository as any, {
          maxFrequency: -1,
        });
      }).toThrow('maxFrequency must be greater than 0');
    });
  });

  describe('buildFromSearchResult', () => {
    it('should return empty array for empty search results', async () => {
      const searchResult: SearchResultDTO = {
        records: [],
        total: 0,
        hasMore: false,
      };

      const tagCloud = await builder.buildFromSearchResult(searchResult);

      expect(tagCloud).toEqual([]);
    });

    it('should handle null or undefined search results', async () => {
      await expect(builder.buildFromSearchResult(null as any)).rejects.toThrow(
        'SearchResult cannot be null or undefined'
      );
      await expect(
        builder.buildFromSearchResult(undefined as any)
      ).rejects.toThrow('SearchResult cannot be null or undefined');
    });

    it('should aggregate unique tag IDs from search results', async () => {
      const records: RecordDTO[] = [
        createMockRecord('record1', [mockUUIDs.tag1, mockUUIDs.tag2]),
        createMockRecord('record2', [mockUUIDs.tag2, mockUUIDs.tag3]),
        createMockRecord('record3', [
          mockUUIDs.tag1,
          mockUUIDs.tag3,
          mockUUIDs.tag4,
        ]),
      ];

      const searchResult: SearchResultDTO = {
        records,
        total: 3,
        hasMore: false,
      };

      const mockTagUsageInfos: TagUsageInfo[] = [
        createMockTagUsageInfo(mockUUIDs.tag1, 'javascript', 15),
        createMockTagUsageInfo(mockUUIDs.tag2, 'react', 10),
        createMockTagUsageInfo(mockUUIDs.tag3, 'typescript', 8),
        createMockTagUsageInfo(mockUUIDs.tag4, 'nodejs', 5),
      ];

      const mockResult = {
        isOk: () => true,
        isErr: () => false,
        unwrap: () => mockTagUsageInfos,
        unwrapErr: () => new Error('Should not be called'),
      };
      mockTagRepository.getUsageInfo.mockResolvedValue(mockResult);

      const tagCloud = await builder.buildFromSearchResult(searchResult);

      expect(mockTagRepository.getUsageInfo).toHaveBeenCalledWith({
        sortBy: 'usage',
        sortOrder: 'desc',
      });
      expect(tagCloud).toHaveLength(4);
    });

    it('should filter tags by frequency thresholds', async () => {
      const builderWithThresholds = new TagCloudBuilder(
        mockTagRepository as any,
        {
          minFrequency: 6,
          maxFrequency: 20,
        }
      );

      const records: RecordDTO[] = [
        createMockRecord('record1', [
          mockUUIDs.tag1,
          mockUUIDs.tag2,
          mockUUIDs.tag3,
        ]),
      ];

      const searchResult: SearchResultDTO = {
        records,
        total: 1,
        hasMore: false,
      };

      const mockTagUsageInfos: TagUsageInfo[] = [
        createMockTagUsageInfo(mockUUIDs.tag1, 'javascript', 25), // Above max
        createMockTagUsageInfo(mockUUIDs.tag2, 'react', 10), // Within range
        createMockTagUsageInfo(mockUUIDs.tag3, 'typescript', 3), // Below min
      ];

      const mockResult = {
        isOk: () => true,
        isErr: () => false,
        unwrap: () => mockTagUsageInfos,
        unwrapErr: () => new Error('Should not be called'),
      };
      mockTagRepository.getUsageInfo.mockResolvedValue(mockResult);

      const tagCloud =
        await builderWithThresholds.buildFromSearchResult(searchResult);

      expect(tagCloud).toHaveLength(1);
      expect(tagCloud[0].normalizedValue).toBe('react');
    });

    it('should limit results by maxCloudSize', async () => {
      const builderWithLimit = new TagCloudBuilder(mockTagRepository as any, {
        maxCloudSize: 2,
      });

      const records: RecordDTO[] = [
        createMockRecord('record1', [
          mockUUIDs.tag1,
          mockUUIDs.tag2,
          mockUUIDs.tag3,
          mockUUIDs.tag4,
        ]),
      ];

      const searchResult: SearchResultDTO = {
        records,
        total: 1,
        hasMore: false,
      };

      const mockTagUsageInfos: TagUsageInfo[] = [
        createMockTagUsageInfo(mockUUIDs.tag1, 'javascript', 15),
        createMockTagUsageInfo(mockUUIDs.tag2, 'react', 10),
        createMockTagUsageInfo(mockUUIDs.tag3, 'typescript', 8),
        createMockTagUsageInfo(mockUUIDs.tag4, 'nodejs', 5),
      ];

      const mockResult = {
        isOk: () => true,
        isErr: () => false,
        unwrap: () => mockTagUsageInfos,
        unwrapErr: () => new Error('Should not be called'),
      };
      mockTagRepository.getUsageInfo.mockResolvedValue(mockResult);

      const tagCloud =
        await builderWithLimit.buildFromSearchResult(searchResult);

      expect(tagCloud).toHaveLength(2);
      // Should be ordered by usage count (descending)
      expect(tagCloud[0].usageCount).toBe(15);
      expect(tagCloud[1].usageCount).toBe(10);
    });

    it('should sort results by relevance (usage count descending)', async () => {
      const records: RecordDTO[] = [
        createMockRecord('record1', [
          mockUUIDs.tag1,
          mockUUIDs.tag2,
          mockUUIDs.tag3,
        ]),
      ];

      const searchResult: SearchResultDTO = {
        records,
        total: 1,
        hasMore: false,
      };

      const mockTagUsageInfos: TagUsageInfo[] = [
        createMockTagUsageInfo(mockUUIDs.tag2, 'react', 10),
        createMockTagUsageInfo(mockUUIDs.tag1, 'javascript', 15),
        createMockTagUsageInfo(mockUUIDs.tag3, 'typescript', 8),
      ];

      const mockResult = {
        isOk: () => true,
        isErr: () => false,
        unwrap: () => mockTagUsageInfos,
        unwrapErr: () => new Error('Should not be called'),
      };
      mockTagRepository.getUsageInfo.mockResolvedValue(mockResult);

      const tagCloud = await builder.buildFromSearchResult(searchResult);

      expect(tagCloud[0].usageCount).toBe(15); // javascript
      expect(tagCloud[1].usageCount).toBe(10); // react
      expect(tagCloud[2].usageCount).toBe(8); // typescript
    });

    it('should calculate correct weights and visual sizes', async () => {
      const records: RecordDTO[] = [
        createMockRecord('record1', [
          mockUUIDs.tag1,
          mockUUIDs.tag2,
          mockUUIDs.tag3,
        ]),
      ];

      const searchResult: SearchResultDTO = {
        records,
        total: 1,
        hasMore: false,
      };

      const mockTagUsageInfos: TagUsageInfo[] = [
        createMockTagUsageInfo(mockUUIDs.tag1, 'javascript', 20), // Max usage
        createMockTagUsageInfo(mockUUIDs.tag2, 'react', 15), // Middle usage
        createMockTagUsageInfo(mockUUIDs.tag3, 'typescript', 10), // Min usage
      ];

      const mockResult = {
        isOk: () => true,
        isErr: () => false,
        unwrap: () => mockTagUsageInfos,
        unwrapErr: () => new Error('Should not be called'),
      };
      mockTagRepository.getUsageInfo.mockResolvedValue(mockResult);

      const tagCloud = await builder.buildFromSearchResult(searchResult);

      expect(tagCloud[0].weight).toBe(1); // Max weight
      expect(tagCloud[1].weight).toBe(0.5); // Middle weight
      expect(tagCloud[2].weight).toBe(0); // Min weight

      // Test fontSize based on weight
      expect(tagCloud[0].fontSize).toBe('xlarge'); // weight 1
      expect(tagCloud[1].fontSize).toBe('medium'); // weight 0.5
      expect(tagCloud[2].fontSize).toBe('small'); // weight 0
    });

    it('should handle single tag with weight 1', async () => {
      const records: RecordDTO[] = [
        createMockRecord('record1', [mockUUIDs.tag1]),
      ];

      const searchResult: SearchResultDTO = {
        records,
        total: 1,
        hasMore: false,
      };

      const mockTagUsageInfos: TagUsageInfo[] = [
        createMockTagUsageInfo(mockUUIDs.tag1, 'javascript', 10),
      ];

      const mockResult = {
        isOk: () => true,
        isErr: () => false,
        unwrap: () => mockTagUsageInfos,
        unwrapErr: () => new Error('Should not be called'),
      };
      mockTagRepository.getUsageInfo.mockResolvedValue(mockResult);

      const tagCloud = await builder.buildFromSearchResult(searchResult);

      expect(tagCloud).toHaveLength(1);
      expect(tagCloud[0].weight).toBe(1);
      expect(tagCloud[0].fontSize).toBe('xlarge');
    });

    it('should handle repository errors', async () => {
      const records: RecordDTO[] = [
        createMockRecord('record1', [mockUUIDs.tag1]),
      ];

      const searchResult: SearchResultDTO = {
        records,
        total: 1,
        hasMore: false,
      };

      const mockErrorResult = {
        isOk: () => false,
        isErr: () => true,
        unwrap: () => {
          throw new Error('Should not be called');
        },
        unwrapErr: () => new Error('Repository error'),
      };
      mockTagRepository.getUsageInfo.mockResolvedValue(mockErrorResult);

      await expect(builder.buildFromSearchResult(searchResult)).rejects.toThrow(
        'Repository error'
      );
    });

    it('should deduplicate tag IDs from multiple records', async () => {
      const records: RecordDTO[] = [
        createMockRecord('record1', [mockUUIDs.tag1, mockUUIDs.tag2]),
        createMockRecord('record2', [mockUUIDs.tag1, mockUUIDs.tag2]), // Same tags
        createMockRecord('record3', [mockUUIDs.tag1, mockUUIDs.tag3]), // Partial overlap
      ];

      const searchResult: SearchResultDTO = {
        records,
        total: 3,
        hasMore: false,
      };

      const mockTagUsageInfos: TagUsageInfo[] = [
        createMockTagUsageInfo(mockUUIDs.tag1, 'javascript', 15),
        createMockTagUsageInfo(mockUUIDs.tag2, 'react', 10),
        createMockTagUsageInfo(mockUUIDs.tag3, 'typescript', 8),
      ];

      const mockResult = {
        isOk: () => true,
        isErr: () => false,
        unwrap: () => mockTagUsageInfos,
        unwrapErr: () => new Error('Should not be called'),
      };
      mockTagRepository.getUsageInfo.mockResolvedValue(mockResult);

      const tagCloud = await builder.buildFromSearchResult(searchResult);

      expect(tagCloud).toHaveLength(3);
      // Verify that getUsageInfo was called with the right setup
      expect(mockTagRepository.getUsageInfo).toHaveBeenCalledWith({
        sortBy: 'usage',
        sortOrder: 'desc',
      });
    });
  });

  describe('getConfiguration', () => {
    it('should return current configuration', () => {
      const config = builder.getConfiguration();
      expect(config).toEqual({
        maxCloudSize: 30,
        minFrequency: 1,
        maxFrequency: Infinity,
      });
    });

    it('should return custom configuration', () => {
      const customBuilder = new TagCloudBuilder(mockTagRepository as any, {
        maxCloudSize: 50,
        minFrequency: 2,
        maxFrequency: 100,
      });

      const config = customBuilder.getConfiguration();
      expect(config).toEqual({
        maxCloudSize: 50,
        minFrequency: 2,
        maxFrequency: 100,
      });
    });
  });

  describe('updateConfiguration', () => {
    it('should update configuration with valid values', () => {
      builder.updateConfiguration({
        maxCloudSize: 40,
        minFrequency: 3,
        maxFrequency: 50,
      });

      const config = builder.getConfiguration();
      expect(config).toEqual({
        maxCloudSize: 40,
        minFrequency: 3,
        maxFrequency: 50,
      });
    });

    it('should throw error for invalid configuration', () => {
      expect(() => {
        builder.updateConfiguration({
          maxCloudSize: 0,
        });
      }).toThrow('maxCloudSize must be greater than 0');

      expect(() => {
        builder.updateConfiguration({
          minFrequency: 10,
          maxFrequency: 5,
        });
      }).toThrow('maxFrequency must be greater than minFrequency');
    });

    it('should allow partial updates', () => {
      builder.updateConfiguration({
        maxCloudSize: 25,
      });

      const config = builder.getConfiguration();
      expect(config.maxCloudSize).toBe(25);
      expect(config.minFrequency).toBe(1); // Should remain unchanged
      expect(config.maxFrequency).toBe(Infinity); // Should remain unchanged
    });
  });

  describe('edge cases', () => {
    it('should handle records with empty tagIds arrays', async () => {
      const records: RecordDTO[] = [
        createMockRecord('record1', []),
        createMockRecord('record2', [mockUUIDs.tag1]),
      ];

      const searchResult: SearchResultDTO = {
        records,
        total: 2,
        hasMore: false,
      };

      const mockTagUsageInfos: TagUsageInfo[] = [
        createMockTagUsageInfo(mockUUIDs.tag1, 'javascript', 15),
      ];

      const mockResult = {
        isOk: () => true,
        isErr: () => false,
        unwrap: () => mockTagUsageInfos,
        unwrapErr: () => new Error('Should not be called'),
      };
      mockTagRepository.getUsageInfo.mockResolvedValue(mockResult);

      const tagCloud = await builder.buildFromSearchResult(searchResult);

      expect(tagCloud).toHaveLength(1);
      expect(tagCloud[0].normalizedValue).toBe('javascript');
    });

    it('should handle tags with identical usage counts', async () => {
      const records: RecordDTO[] = [
        createMockRecord('record1', [
          mockUUIDs.tag1,
          mockUUIDs.tag2,
          mockUUIDs.tag3,
        ]),
      ];

      const searchResult: SearchResultDTO = {
        records,
        total: 1,
        hasMore: false,
      };

      const mockTagUsageInfos: TagUsageInfo[] = [
        createMockTagUsageInfo(mockUUIDs.tag1, 'javascript', 10),
        createMockTagUsageInfo(mockUUIDs.tag2, 'react', 10),
        createMockTagUsageInfo(mockUUIDs.tag3, 'typescript', 10),
      ];

      const mockResult = {
        isOk: () => true,
        isErr: () => false,
        unwrap: () => mockTagUsageInfos,
        unwrapErr: () => new Error('Should not be called'),
      };
      mockTagRepository.getUsageInfo.mockResolvedValue(mockResult);

      const tagCloud = await builder.buildFromSearchResult(searchResult);

      expect(tagCloud).toHaveLength(3);
      // All should have same weight since usage is identical
      tagCloud.forEach((item) => {
        expect(item.weight).toBe(1); // Single value gets max weight
        expect(item.usageCount).toBe(10);
      });
    });
  });

  describe('visual size calculation', () => {
    it('should calculate correct fontSize based on weight ranges', async () => {
      const records: RecordDTO[] = [
        createMockRecord('record1', [
          mockUUIDs.tag1,
          mockUUIDs.tag2,
          mockUUIDs.tag3,
          mockUUIDs.tag4,
        ]),
      ];

      const searchResult: SearchResultDTO = {
        records,
        total: 1,
        hasMore: false,
      };

      const mockTagUsageInfos: TagUsageInfo[] = [
        createMockTagUsageInfo(mockUUIDs.tag1, 'very-popular', 100), // weight: 1 -> xlarge
        createMockTagUsageInfo(mockUUIDs.tag2, 'popular', 70), // weight: ~0.7 -> large
        createMockTagUsageInfo(mockUUIDs.tag3, 'moderate', 40), // weight: ~0.4 -> medium
        createMockTagUsageInfo(mockUUIDs.tag4, 'rare', 10), // weight: 0 -> small
      ];

      const mockResult = {
        isOk: () => true,
        isErr: () => false,
        unwrap: () => mockTagUsageInfos,
        unwrapErr: () => new Error('Should not be called'),
      };
      mockTagRepository.getUsageInfo.mockResolvedValue(mockResult);

      const tagCloud = await builder.buildFromSearchResult(searchResult);

      expect(tagCloud[0].fontSize).toBe('xlarge'); // weight >= 0.8
      expect(tagCloud[1].fontSize).toBe('large'); // weight >= 0.6
      expect(tagCloud[2].fontSize).toBe('medium'); // weight >= 0.3
      expect(tagCloud[3].fontSize).toBe('small'); // weight < 0.3
    });
  });

  describe('performance with large datasets', () => {
    it('should handle large number of tags efficiently', async () => {
      // Generate UUIDs for large dataset test
      const generateUUID = (index: number): string =>
        `550e8400-e29b-41d4-a716-${String(index).padStart(12, '0')}`;

      const records: RecordDTO[] = Array.from({ length: 100 }, (_, i) =>
        createMockRecord(`record${i}`, [generateUUID(i), generateUUID(i + 100)])
      );

      const searchResult: SearchResultDTO = {
        records,
        total: 100,
        hasMore: false,
      };

      const mockTagUsageInfos: TagUsageInfo[] = Array.from(
        { length: 200 },
        (_, i) =>
          createMockTagUsageInfo(
            generateUUID(i),
            `tag-${i}`,
            Math.floor(Math.random() * 50) + 1
          )
      );

      const mockResult = {
        isOk: () => true,
        isErr: () => false,
        unwrap: () => mockTagUsageInfos,
        unwrapErr: () => new Error('Should not be called'),
      };
      mockTagRepository.getUsageInfo.mockResolvedValue(mockResult);

      const start = Date.now();
      const tagCloud = await builder.buildFromSearchResult(searchResult);
      const duration = Date.now() - start;

      expect(tagCloud).toHaveLength(30); // Limited by default maxCloudSize
      expect(duration).toBeLessThan(100); // Should be fast
    });
  });
});
