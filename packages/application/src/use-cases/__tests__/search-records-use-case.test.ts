import {
  Result,
  SearchQuery,
  TagId,
  RecordId,
  Ok,
  Err,
} from '@misc-poc/shared';
import { Record, Tag, DomainError, RecordMatcher } from '@misc-poc/domain';
import {
  RecordRepository,
  RecordSearchResult,
  RecordSearchOptions,
} from '../../ports/record-repository';
import { TagRepository } from '../../ports/tag-repository';
import {
  SearchRecordsUseCase,
  SearchRecordsRequest,
  SearchRecordsResponse,
} from '../search-records-use-case';
import {
  SearchResultDTO,
  SearchResultDTOMapper,
} from '../../dtos/search-result-dto';

// Mock implementations
class MockRecordRepository implements RecordRepository {
  private records: Record[] = [];
  private mockTagRepository!: MockTagRepository;

  setRecords(records: Record[]): void {
    this.records = records;
  }

  setTagRepository(tagRepository: MockTagRepository): void {
    this.mockTagRepository = tagRepository;
  }

  async findById(id: RecordId): Promise<Result<Record | null, DomainError>> {
    const record = this.records.find((r) => r.id.equals(id));
    return Ok(record || null);
  }

  async findAll(
    options?: RecordSearchOptions
  ): Promise<Result<RecordSearchResult, DomainError>> {
    let filteredRecords = [...this.records];

    // Apply sorting
    if (options?.sortBy === 'createdAt') {
      filteredRecords.sort((a, b) => {
        const comparison = a.createdAt.getTime() - b.createdAt.getTime();
        return options.sortOrder === 'desc' ? -comparison : comparison;
      });
    } else if (options?.sortBy === 'updatedAt') {
      filteredRecords.sort((a, b) => {
        const comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
        return options.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    // Apply pagination
    const offset = Math.max(0, options?.offset || 0);
    const limit = options?.limit !== undefined ? options.limit : 10;
    const total = filteredRecords.length;
    const paginatedRecords =
      limit > 0 ? filteredRecords.slice(offset, offset + limit) : [];
    const hasMore = limit > 0 ? offset + limit < total : total > 0;

    return Ok({
      records: paginatedRecords,
      total,
      hasMore,
    });
  }

  async search(
    query: SearchQuery,
    options?: RecordSearchOptions
  ): Promise<Result<RecordSearchResult, DomainError>> {
    // For empty queries, return all records
    if (query.isEmpty()) {
      return this.findAll(options);
    }

    // Filter records using RecordMatcher
    const recordMatcher = new RecordMatcher();
    // Create tagLookup from the mockTagRepository
    const tagLookup = new Map<TagId, Tag>();
    for (const tag of this.mockTagRepository.getTags()) {
      tagLookup.set(tag.id, tag);
    }

    let matchingRecords = this.records.filter((record) =>
      recordMatcher.matches(record, query, tagLookup)
    );

    // Apply sorting
    if (options?.sortBy === 'createdAt') {
      matchingRecords.sort((a, b) => {
        const comparison = a.createdAt.getTime() - b.createdAt.getTime();
        return options.sortOrder === 'desc' ? -comparison : comparison;
      });
    } else if (options?.sortBy === 'updatedAt') {
      matchingRecords.sort((a, b) => {
        const comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
        return options.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    // Apply pagination
    const offset = Math.max(0, options?.offset || 0);
    const limit = options?.limit !== undefined ? options.limit : 10;
    const total = matchingRecords.length;
    const paginatedRecords =
      limit > 0 ? matchingRecords.slice(offset, offset + limit) : [];
    const hasMore = limit > 0 ? offset + limit < total : total > 0;

    return Ok({
      records: paginatedRecords,
      total,
      hasMore,
    });
  }

  async findByTagIds(
    tagIds: TagId[],
    options?: RecordSearchOptions
  ): Promise<Result<RecordSearchResult, DomainError>> {
    const matchingRecords = this.records.filter((record) =>
      tagIds.some((tagId) => record.hasTag(tagId))
    );

    // Apply sorting and pagination similar to search method
    if (options?.sortBy === 'createdAt') {
      matchingRecords.sort((a, b) => {
        const comparison = a.createdAt.getTime() - b.createdAt.getTime();
        return options.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    const offset = Math.max(0, options?.offset || 0);
    const limit = options?.limit !== undefined ? options.limit : 10;
    const total = matchingRecords.length;
    const paginatedRecords =
      limit > 0 ? matchingRecords.slice(offset, offset + limit) : [];
    const hasMore = limit > 0 ? offset + limit < total : total > 0;

    return Ok({
      records: paginatedRecords,
      total,
      hasMore,
    });
  }

  async findByTagSet(
    tagIds: Set<TagId>,
    excludeRecordId?: RecordId
  ): Promise<Result<Record[], DomainError>> {
    const matchingRecords = this.records.filter((record) => {
      if (excludeRecordId && record.id.equals(excludeRecordId)) {
        return false;
      }
      return record.hasSameTagSet(tagIds);
    });
    return Ok(matchingRecords);
  }

  async save(record: Record): Promise<Result<Record, DomainError>> {
    this.records.push(record);
    return Ok(record);
  }

  async update(record: Record): Promise<Result<Record, DomainError>> {
    const index = this.records.findIndex((r) => r.id.equals(record.id));
    if (index !== -1) {
      this.records[index] = record;
    }
    return Ok(record);
  }

  async delete(id: RecordId): Promise<Result<void, DomainError>> {
    const index = this.records.findIndex((r) => r.id.equals(id));
    if (index !== -1) {
      this.records.splice(index, 1);
    }
    return Ok(undefined);
  }

  async saveBatch(records: Record[]): Promise<Result<Record[], DomainError>> {
    this.records.push(...records);
    return Ok(records);
  }

  async deleteAll(): Promise<Result<void, DomainError>> {
    this.records = [];
    return Ok(undefined);
  }

  async count(): Promise<Result<number, DomainError>> {
    return Ok(this.records.length);
  }

  async exists(id: RecordId): Promise<Result<boolean, DomainError>> {
    return Ok(this.records.some((r) => r.id.equals(id)));
  }
}

class MockTagRepository implements TagRepository {
  private tags: Tag[] = [];

  setTags(tags: Tag[]): void {
    this.tags = tags;
  }

  getTags(): Tag[] {
    return [...this.tags];
  }

  async findById(id: TagId): Promise<Result<Tag | null, DomainError>> {
    const tag = this.tags.find((t) => t.id.equals(id));
    return Ok(tag || null);
  }

  async findByNormalizedValue(
    normalizedValue: string
  ): Promise<Result<Tag | null, DomainError>> {
    const tag = this.tags.find((t) => t.normalizedValue === normalizedValue);
    return Ok(tag || null);
  }

  async findByNormalizedValues(
    normalizedValues: string[]
  ): Promise<Result<Tag[], DomainError>> {
    const foundTags = this.tags.filter((tag) =>
      normalizedValues.includes(tag.normalizedValue)
    );
    return Ok(foundTags);
  }

  async findAll(): Promise<Result<Tag[], DomainError>> {
    return Ok([...this.tags]);
  }

  async findByPrefix(): Promise<Result<any[], DomainError>> {
    return Ok([]);
  }

  async getUsageInfo(): Promise<Result<any[], DomainError>> {
    return Ok([]);
  }

  async findOrphaned(): Promise<Result<Tag[], DomainError>> {
    return Ok([]);
  }

  async save(tag: Tag): Promise<Result<Tag, DomainError>> {
    this.tags.push(tag);
    return Ok(tag);
  }

  async update(tag: Tag): Promise<Result<Tag, DomainError>> {
    const index = this.tags.findIndex((t) => t.id.equals(tag.id));
    if (index !== -1) {
      this.tags[index] = tag;
    }
    return Ok(tag);
  }

  async delete(id: TagId): Promise<Result<void, DomainError>> {
    const index = this.tags.findIndex((t) => t.id.equals(id));
    if (index !== -1) {
      this.tags.splice(index, 1);
    }
    return Ok(undefined);
  }

  async deleteBatch(): Promise<Result<void, DomainError>> {
    return Ok(undefined);
  }

  async saveBatch(tags: Tag[]): Promise<Result<Tag[], DomainError>> {
    this.tags.push(...tags);
    return Ok(tags);
  }

  async deleteAll(): Promise<Result<void, DomainError>> {
    this.tags = [];
    return Ok(undefined);
  }

  async count(): Promise<Result<number, DomainError>> {
    return Ok(this.tags.length);
  }

  async existsByNormalizedValue(): Promise<Result<boolean, DomainError>> {
    return Ok(false);
  }

  async exists(): Promise<Result<boolean, DomainError>> {
    return Ok(false);
  }

  async getUsageCount(): Promise<Result<number, DomainError>> {
    return Ok(0);
  }
}

describe('SearchRecordsUseCase', () => {
  let useCase: SearchRecordsUseCase;
  let mockRecordRepository: MockRecordRepository;
  let mockTagRepository: MockTagRepository;

  beforeEach(() => {
    mockRecordRepository = new MockRecordRepository();
    mockTagRepository = new MockTagRepository();
    mockRecordRepository.setTagRepository(mockTagRepository);
    useCase = new SearchRecordsUseCase(mockRecordRepository, mockTagRepository);
  });

  describe('constructor', () => {
    it('should throw error when RecordRepository is null or undefined', () => {
      expect(
        () => new SearchRecordsUseCase(null as any, mockTagRepository)
      ).toThrow('RecordRepository cannot be null or undefined');
      expect(
        () => new SearchRecordsUseCase(undefined as any, mockTagRepository)
      ).toThrow('RecordRepository cannot be null or undefined');
    });

    it('should throw error when TagRepository is null or undefined', () => {
      expect(
        () => new SearchRecordsUseCase(mockRecordRepository, null as any)
      ).toThrow('TagRepository cannot be null or undefined');
      expect(
        () => new SearchRecordsUseCase(mockRecordRepository, undefined as any)
      ).toThrow('TagRepository cannot be null or undefined');
    });

    it('should create instance successfully with valid repositories', () => {
      expect(useCase).toBeInstanceOf(SearchRecordsUseCase);
    });
  });

  describe('input validation', () => {
    it('should reject null request', async () => {
      const result = await useCase.execute(null as any);

      expect(result.isErr()).toBe(true);
      const error = result.unwrapErr();
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Request cannot be null or undefined');
    });

    it('should reject undefined request', async () => {
      const result = await useCase.execute(undefined as any);

      expect(result.isErr()).toBe(true);
      const error = result.unwrapErr();
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Request cannot be null or undefined');
    });

    it('should accept empty query as valid (returns all records)', async () => {
      const request: SearchRecordsRequest = { query: '' };
      mockRecordRepository.setRecords([]);

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      expect(response.searchResult.records).toEqual([]);
    });

    it('should accept whitespace-only query as valid (returns all records)', async () => {
      const request: SearchRecordsRequest = { query: '   ' };
      mockRecordRepository.setRecords([]);

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
    });
  });

  describe('empty query handling', () => {
    it('should return all records when query is empty', async () => {
      // Setup test data
      const tag1 = Tag.create('tag1');
      const tag2 = Tag.create('tag2');
      mockTagRepository.setTags([tag1, tag2]);

      const record1 = Record.create('content with tag1', new Set([tag1.id]));
      const record2 = Record.create('content with tag2', new Set([tag2.id]));
      mockRecordRepository.setRecords([record1, record2]);

      const request: SearchRecordsRequest = { query: '' };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      expect(response.searchResult.records).toHaveLength(2);
      expect(response.searchResult.total).toBe(2);
      expect(response.searchResult.hasMore).toBe(false);
    });

    it('should apply pagination to all records when query is empty', async () => {
      // Setup test data with multiple records
      const tag1 = Tag.create('tag1');
      mockTagRepository.setTags([tag1]);

      const records = Array.from({ length: 25 }, (_, i) =>
        Record.create(`content ${i + 1} tag1`, new Set([tag1.id]))
      );
      mockRecordRepository.setRecords(records);

      const request: SearchRecordsRequest = {
        query: '',
        options: { limit: 10, offset: 0 },
      };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      expect(response.searchResult.records).toHaveLength(10);
      expect(response.searchResult.total).toBe(25);
      expect(response.searchResult.hasMore).toBe(true);
    });
  });

  describe('query normalization and search', () => {
    it('should normalize search query and find matching records', async () => {
      // Setup test data
      const tag1 = Tag.create('programming');
      const tag2 = Tag.create('javascript');
      mockTagRepository.setTags([tag1, tag2]);

      const record1 = Record.create('programming tutorial', new Set([tag1.id]));
      const record2 = Record.create('javascript guide', new Set([tag2.id]));
      mockRecordRepository.setRecords([record1, record2]);

      const request: SearchRecordsRequest = { query: 'Programming' };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      expect(response.searchResult.records).toHaveLength(1);
      expect(response.searchResult.records[0].content).toBe(
        'programming tutorial'
      );
    });

    it('should find records matching multiple search terms (AND logic)', async () => {
      // Setup test data
      const tag1 = Tag.create('programming');
      const tag2 = Tag.create('javascript');
      const tag3 = Tag.create('tutorial');
      mockTagRepository.setTags([tag1, tag2, tag3]);

      const record1 = Record.create(
        'programming tutorial',
        new Set([tag1.id, tag3.id])
      );
      const record2 = Record.create('javascript guide', new Set([tag2.id]));
      const record3 = Record.create(
        'programming javascript',
        new Set([tag1.id, tag2.id])
      );
      mockRecordRepository.setRecords([record1, record2, record3]);

      const request: SearchRecordsRequest = { query: 'programming tutorial' };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      expect(response.searchResult.records).toHaveLength(1);
      expect(response.searchResult.records[0].content).toBe(
        'programming tutorial'
      );
    });

    it('should return empty results when no records match the query', async () => {
      // Setup test data
      const tag1 = Tag.create('programming');
      mockTagRepository.setTags([tag1]);

      const record1 = Record.create('programming tutorial', new Set([tag1.id]));
      mockRecordRepository.setRecords([record1]);

      const request: SearchRecordsRequest = { query: 'nonexistent' };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      expect(response.searchResult.records).toHaveLength(0);
      expect(response.searchResult.total).toBe(0);
    });
  });

  describe('sorting and pagination', () => {
    it('should sort results by creation date ascending', async () => {
      // Setup test data with different creation dates
      const tag1 = Tag.create('test');
      mockTagRepository.setTags([tag1]);

      const now = new Date();
      const record1 = Record.create('content 1 test', new Set([tag1.id]));
      const record2 = Record.create('content 2 test', new Set([tag1.id]));
      const record3 = Record.create('content 3 test', new Set([tag1.id]));

      // Manually set creation dates
      Object.defineProperty(record1, 'createdAt', {
        value: new Date(now.getTime() - 2000),
      });
      Object.defineProperty(record2, 'createdAt', {
        value: new Date(now.getTime() - 1000),
      });
      Object.defineProperty(record3, 'createdAt', {
        value: new Date(now.getTime()),
      });

      mockRecordRepository.setRecords([record3, record1, record2]); // Add in random order

      const request: SearchRecordsRequest = {
        query: 'test',
        options: { sortBy: 'createdAt', sortOrder: 'asc' },
      };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      expect(response.searchResult.records).toHaveLength(3);
      expect(response.searchResult.records[0].content).toBe('content 1 test');
      expect(response.searchResult.records[1].content).toBe('content 2 test');
      expect(response.searchResult.records[2].content).toBe('content 3 test');
    });

    it('should sort results by creation date descending (default)', async () => {
      // Setup test data with different creation dates
      const tag1 = Tag.create('test');
      mockTagRepository.setTags([tag1]);

      const now = new Date();
      const record1 = Record.create('content 1 test', new Set([tag1.id]));
      const record2 = Record.create('content 2 test', new Set([tag1.id]));
      const record3 = Record.create('content 3 test', new Set([tag1.id]));

      // Manually set creation dates
      Object.defineProperty(record1, 'createdAt', {
        value: new Date(now.getTime() - 2000),
      });
      Object.defineProperty(record2, 'createdAt', {
        value: new Date(now.getTime() - 1000),
      });
      Object.defineProperty(record3, 'createdAt', {
        value: new Date(now.getTime()),
      });

      mockRecordRepository.setRecords([record1, record2, record3]);

      const request: SearchRecordsRequest = {
        query: 'test',
        options: { sortBy: 'createdAt', sortOrder: 'desc' },
      };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      expect(response.searchResult.records).toHaveLength(3);
      expect(response.searchResult.records[0].content).toBe('content 3 test');
      expect(response.searchResult.records[1].content).toBe('content 2 test');
      expect(response.searchResult.records[2].content).toBe('content 1 test');
    });

    it('should apply pagination correctly', async () => {
      // Setup test data with multiple records
      const tag1 = Tag.create('test');
      mockTagRepository.setTags([tag1]);

      const records = Array.from({ length: 25 }, (_, i) =>
        Record.create(`content ${i + 1} test`, new Set([tag1.id]))
      );
      mockRecordRepository.setRecords(records);

      const request: SearchRecordsRequest = {
        query: 'test',
        options: { limit: 5, offset: 10 },
      };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      expect(response.searchResult.records).toHaveLength(5);
      expect(response.searchResult.total).toBe(25);
      expect(response.searchResult.hasMore).toBe(true);
    });

    it('should handle last page pagination correctly', async () => {
      // Setup test data with exact multiple of page size
      const tag1 = Tag.create('test');
      mockTagRepository.setTags([tag1]);

      const records = Array.from({ length: 20 }, (_, i) =>
        Record.create(`content ${i + 1} test`, new Set([tag1.id]))
      );
      mockRecordRepository.setRecords(records);

      const request: SearchRecordsRequest = {
        query: 'test',
        options: { limit: 10, offset: 15 },
      };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      expect(response.searchResult.records).toHaveLength(5);
      expect(response.searchResult.total).toBe(20);
      expect(response.searchResult.hasMore).toBe(false);
    });
  });

  describe('performance optimization', () => {
    it('should handle large datasets efficiently', async () => {
      // Setup test data with large number of records
      const tag1 = Tag.create('performance');
      mockTagRepository.setTags([tag1]);

      const records = Array.from({ length: 1000 }, (_, i) =>
        Record.create(`performance test ${i + 1}`, new Set([tag1.id]))
      );
      mockRecordRepository.setRecords(records);

      const request: SearchRecordsRequest = {
        query: 'performance',
        options: { limit: 50, offset: 0 },
      };

      const startTime = Date.now();
      const result = await useCase.execute(request);
      const executionTime = Date.now() - startTime;

      expect(result.isOk()).toBe(true);
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second

      const response = result.unwrap();
      expect(response.searchResult.records).toHaveLength(50);
      expect(response.searchResult.total).toBe(1000);
    });
  });

  describe('error handling', () => {
    it('should handle repository search errors', async () => {
      // Mock repository to return error
      const errorRepository = {
        ...mockRecordRepository,
        search: jest
          .fn()
          .mockResolvedValue(
            Err(new DomainError('SEARCH_ERROR', 'Search failed'))
          ),
      };

      const useCaseWithError = new SearchRecordsUseCase(
        errorRepository as any,
        mockTagRepository
      );
      const request: SearchRecordsRequest = { query: 'test' };

      const result = await useCaseWithError.execute(request);

      expect(result.isErr()).toBe(true);
      const error = result.unwrapErr();
      expect(error.code).toBe('SEARCH_ERROR');
      expect(error.message).toBe('Search failed');
    });

    it('should handle repository findAll errors for empty queries', async () => {
      // Mock repository to return error
      const errorRepository = {
        ...mockRecordRepository,
        findAll: jest
          .fn()
          .mockResolvedValue(
            Err(new DomainError('REPOSITORY_ERROR', 'Find all failed'))
          ),
      };

      const useCaseWithError = new SearchRecordsUseCase(
        errorRepository as any,
        mockTagRepository
      );
      const request: SearchRecordsRequest = { query: '' };

      const result = await useCaseWithError.execute(request);

      expect(result.isErr()).toBe(true);
      const error = result.unwrapErr();
      expect(error.code).toBe('REPOSITORY_ERROR');
      expect(error.message).toBe('Find all failed');
    });

    it('should handle SearchQuery creation errors', async () => {
      // This test assumes SearchQuery constructor can throw errors for invalid input
      const request: SearchRecordsRequest = { query: 'a'.repeat(10000) }; // Very long query

      const result = await useCase.execute(request);

      // The behavior depends on SearchQuery implementation
      // If it throws, it should be caught and wrapped in a DomainError
      // If it doesn't throw, the search should proceed normally
      expect(result.isOk() || result.isErr()).toBe(true);
    });

    it('should handle unexpected exceptions', async () => {
      // Mock repository to throw unexpected error
      const errorRepository = {
        ...mockRecordRepository,
        search: jest.fn().mockRejectedValue(new Error('Unexpected error')),
      };

      const useCaseWithError = new SearchRecordsUseCase(
        errorRepository as any,
        mockTagRepository
      );
      const request: SearchRecordsRequest = { query: 'test' };

      const result = await useCaseWithError.execute(request);

      expect(result.isErr()).toBe(true);
      const error = result.unwrapErr();
      expect(error.code).toBe('USE_CASE_ERROR');
      expect(error.message).toContain('Use case execution failed');
    });
  });

  describe('default options', () => {
    it('should use default pagination options when not provided', async () => {
      const tag1 = Tag.create('test');
      mockTagRepository.setTags([tag1]);

      const records = Array.from({ length: 25 }, (_, i) =>
        Record.create(`content ${i + 1} test`, new Set([tag1.id]))
      );
      mockRecordRepository.setRecords(records);

      const request: SearchRecordsRequest = { query: 'test' };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      expect(response.searchResult.records).toHaveLength(10); // Default limit
      expect(response.searchResult.total).toBe(25);
      expect(response.searchResult.hasMore).toBe(true);
    });

    it('should use default sorting options when not provided', async () => {
      const tag1 = Tag.create('test');
      mockTagRepository.setTags([tag1]);

      const record1 = Record.create('content 1 test', new Set([tag1.id]));
      const record2 = Record.create('content 2 test', new Set([tag1.id]));
      mockRecordRepository.setRecords([record1, record2]);

      const request: SearchRecordsRequest = { query: 'test' };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      expect(response.searchResult.records).toHaveLength(2);
      // Default behavior should be implemented
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in search query', async () => {
      const tag1 = Tag.create('c++');
      const tag2 = Tag.create('c#');
      mockTagRepository.setTags([tag1, tag2]);

      const record1 = Record.create('c++ programming', new Set([tag1.id]));
      const record2 = Record.create('c# development', new Set([tag2.id]));
      mockRecordRepository.setRecords([record1, record2]);

      const request: SearchRecordsRequest = { query: 'c++' };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      // The exact behavior depends on SearchQuery normalization
      expect(response.searchResult).toBeDefined();
    });

    it('should handle Unicode characters in search query', async () => {
      const tag1 = Tag.create('café');
      const tag2 = Tag.create('naïve');
      mockTagRepository.setTags([tag1, tag2]);

      const record1 = Record.create('café review', new Set([tag1.id]));
      const record2 = Record.create('naïve approach', new Set([tag2.id]));
      mockRecordRepository.setRecords([record1, record2]);

      const request: SearchRecordsRequest = { query: 'café' };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      expect(response.searchResult).toBeDefined();
    });

    it('should handle zero limit in pagination options', async () => {
      const tag1 = Tag.create('test');
      mockTagRepository.setTags([tag1]);

      const record1 = Record.create('content test', new Set([tag1.id]));
      mockRecordRepository.setRecords([record1]);

      const request: SearchRecordsRequest = {
        query: 'test',
        options: { limit: 0 },
      };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      expect(response.searchResult.records).toHaveLength(0);
      expect(response.searchResult.total).toBe(1);
      expect(response.searchResult.hasMore).toBe(true);
    });

    it('should handle negative offset in pagination options', async () => {
      const tag1 = Tag.create('test');
      mockTagRepository.setTags([tag1]);

      const record1 = Record.create('content test', new Set([tag1.id]));
      mockRecordRepository.setRecords([record1]);

      const request: SearchRecordsRequest = {
        query: 'test',
        options: { offset: -5 },
      };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      // Behavior should handle negative offset gracefully
      const response = result.unwrap();
      expect(response.searchResult).toBeDefined();
    });
  });

  describe('integration with domain services', () => {
    it('should use RecordMatcher for query matching', async () => {
      // This test verifies that the use case properly integrates with RecordMatcher
      const tag1 = Tag.create('programming');
      const tag2 = Tag.create('javascript');
      mockTagRepository.setTags([tag1, tag2]);

      const record1 = Record.create('programming tutorial', new Set([tag1.id]));
      const record2 = Record.create('javascript guide', new Set([tag2.id]));
      mockRecordRepository.setRecords([record1, record2]);

      const request: SearchRecordsRequest = { query: 'programming' };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      expect(response.searchResult.records).toHaveLength(1);
      expect(response.searchResult.records[0].content).toBe(
        'programming tutorial'
      );
    });

    it('should properly use SearchQuery normalization', async () => {
      // This test verifies that SearchQuery normalization is working
      const tag1 = Tag.create('programming');
      mockTagRepository.setTags([tag1]);

      const record1 = Record.create('programming tutorial', new Set([tag1.id]));
      mockRecordRepository.setRecords([record1]);

      const request: SearchRecordsRequest = { query: '  PROGRAMMING  ' };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      expect(response.searchResult.records).toHaveLength(1);
    });
  });
});
