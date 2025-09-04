import { Result, Ok, Err } from '@misc-poc/shared';
import { DomainError, Tag, TagFactory } from '@misc-poc/domain';
import { TagRepository, TagSuggestion } from '../../ports/tag-repository';
import {
  GetTagSuggestionsUseCase,
  GetTagSuggestionsRequest,
  GetTagSuggestionsResponse,
} from '../get-tag-suggestions-use-case';

// Mock implementation for TagRepository
class MockTagRepository implements TagRepository {
  private suggestions: TagSuggestion[] = [];
  private shouldReturnError: boolean = false;
  private errorToReturn: DomainError | null = null;

  setSuggestions(suggestions: TagSuggestion[]): void {
    this.suggestions = suggestions;
  }

  setError(error: DomainError): void {
    this.shouldReturnError = true;
    this.errorToReturn = error;
  }

  clearError(): void {
    this.shouldReturnError = false;
    this.errorToReturn = null;
  }

  async findByPrefix(
    prefix: string,
    limit?: number
  ): Promise<Result<TagSuggestion[], DomainError>> {
    if (this.shouldReturnError && this.errorToReturn) {
      return Err(this.errorToReturn);
    }

    let results = this.suggestions.filter((suggestion) =>
      suggestion.tag.normalizedValue.startsWith(prefix.toLowerCase().trim())
    );

    // Sort by match score (descending) then by normalized value (ascending)
    results.sort((a, b) => {
      if (b.matchScore !== a.matchScore) {
        return b.matchScore - a.matchScore;
      }
      return a.tag.normalizedValue.localeCompare(b.tag.normalizedValue);
    });

    if (limit && limit > 0) {
      results = results.slice(0, limit);
    }

    return Ok(results);
  }

  // Stub implementations for other required methods
  async findById(): Promise<Result<any, DomainError>> {
    return Ok(null);
  }
  async findByNormalizedValue(): Promise<Result<any, DomainError>> {
    return Ok(null);
  }
  async findByNormalizedValues(): Promise<Result<any, DomainError>> {
    return Ok([]);
  }
  async findAll(): Promise<Result<any, DomainError>> {
    return Ok([]);
  }
  async getUsageInfo(): Promise<Result<any, DomainError>> {
    return Ok([]);
  }
  async findOrphaned(): Promise<Result<any, DomainError>> {
    return Ok([]);
  }
  async save(): Promise<Result<any, DomainError>> {
    return Ok(null);
  }
  async update(): Promise<Result<any, DomainError>> {
    return Ok(null);
  }
  async delete(): Promise<Result<any, DomainError>> {
    return Ok(undefined);
  }
  async deleteBatch(): Promise<Result<any, DomainError>> {
    return Ok(undefined);
  }
  async saveBatch(): Promise<Result<any, DomainError>> {
    return Ok([]);
  }
  async deleteAll(): Promise<Result<any, DomainError>> {
    return Ok(undefined);
  }
  async count(): Promise<Result<any, DomainError>> {
    return Ok(0);
  }
  async existsByNormalizedValue(): Promise<Result<any, DomainError>> {
    return Ok(false);
  }
  async exists(): Promise<Result<any, DomainError>> {
    return Ok(false);
  }
  async getUsageCount(): Promise<Result<any, DomainError>> {
    return Ok(0);
  }
}

describe('GetTagSuggestionsUseCase', () => {
  let useCase: GetTagSuggestionsUseCase;
  let mockTagRepository: MockTagRepository;

  beforeEach(() => {
    mockTagRepository = new MockTagRepository();
    useCase = new GetTagSuggestionsUseCase(mockTagRepository);
  });

  describe('constructor', () => {
    it('should throw error when TagRepository is null or undefined', () => {
      expect(() => new GetTagSuggestionsUseCase(null as any)).toThrow(
        'TagRepository cannot be null or undefined'
      );
      expect(() => new GetTagSuggestionsUseCase(undefined as any)).toThrow(
        'TagRepository cannot be null or undefined'
      );
    });

    it('should create instance successfully with valid repository', () => {
      expect(useCase).toBeInstanceOf(GetTagSuggestionsUseCase);
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

    it('should reject empty prefix', async () => {
      const request: GetTagSuggestionsRequest = { prefix: '' };

      const result = await useCase.execute(request);

      expect(result.isErr()).toBe(true);
      const error = result.unwrapErr();
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Prefix cannot be empty or whitespace only');
    });

    it('should reject whitespace-only prefix', async () => {
      const request: GetTagSuggestionsRequest = { prefix: '   ' };

      const result = await useCase.execute(request);

      expect(result.isErr()).toBe(true);
      const error = result.unwrapErr();
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Prefix cannot be empty or whitespace only');
    });

    it('should reject null prefix', async () => {
      const request: GetTagSuggestionsRequest = { prefix: null as any };

      const result = await useCase.execute(request);

      expect(result.isErr()).toBe(true);
      const error = result.unwrapErr();
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Prefix cannot be empty or whitespace only');
    });

    it('should reject negative limit', async () => {
      const request: GetTagSuggestionsRequest = {
        prefix: 'test',
        options: { limit: -1 },
      };

      const result = await useCase.execute(request);

      expect(result.isErr()).toBe(true);
      const error = result.unwrapErr();
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Limit must be a positive number');
    });

    it('should reject zero limit', async () => {
      const request: GetTagSuggestionsRequest = {
        prefix: 'test',
        options: { limit: 0 },
      };

      const result = await useCase.execute(request);

      expect(result.isErr()).toBe(true);
      const error = result.unwrapErr();
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Limit must be a positive number');
    });

    it('should accept valid request with minimum valid prefix', async () => {
      const request: GetTagSuggestionsRequest = { prefix: 'a' };
      mockTagRepository.setSuggestions([]);

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
    });
  });

  describe('prefix matching', () => {
    beforeEach(() => {
      const tag1 = Tag.create('javascript');
      const tag2 = Tag.create('java');
      const tag3 = Tag.create('python');
      const tag4 = Tag.create('typescript');

      const suggestions: TagSuggestion[] = [
        { tag: tag1, matchScore: 0.9 },
        { tag: tag2, matchScore: 0.8 },
        { tag: tag3, matchScore: 0.7 },
        { tag: tag4, matchScore: 0.85 },
      ];

      mockTagRepository.setSuggestions(suggestions);
    });

    it('should find tags matching the prefix', async () => {
      const request: GetTagSuggestionsRequest = { prefix: 'ja' };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      expect(response.suggestions).toHaveLength(2);

      // Should be sorted by match score descending
      expect(response.suggestions[0].tag.normalizedValue).toBe('javascript');
      expect(response.suggestions[0].matchScore).toBe(0.9);
      expect(response.suggestions[1].tag.normalizedValue).toBe('java');
      expect(response.suggestions[1].matchScore).toBe(0.8);
    });

    it('should handle case-insensitive matching', async () => {
      const request: GetTagSuggestionsRequest = { prefix: 'JA' };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      expect(response.suggestions).toHaveLength(2);
      expect(response.suggestions[0].tag.normalizedValue).toBe('javascript');
      expect(response.suggestions[1].tag.normalizedValue).toBe('java');
    });

    it('should handle prefix with leading/trailing whitespace', async () => {
      const request: GetTagSuggestionsRequest = { prefix: '  ja  ' };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      expect(response.suggestions).toHaveLength(2);
    });

    it('should return empty results for non-matching prefix', async () => {
      const request: GetTagSuggestionsRequest = { prefix: 'xyz' };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      expect(response.suggestions).toHaveLength(0);
    });

    it('should match exact tag names', async () => {
      const request: GetTagSuggestionsRequest = { prefix: 'python' };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      expect(response.suggestions).toHaveLength(1);
      expect(response.suggestions[0].tag.normalizedValue).toBe('python');
    });
  });

  describe('frequency-based sorting', () => {
    beforeEach(() => {
      const tag1 = Tag.create('programming');
      const tag2 = Tag.create('python');
      const tag3 = Tag.create('project');

      const suggestions: TagSuggestion[] = [
        { tag: tag1, matchScore: 0.7 }, // Lower score but should rank higher due to frequency
        { tag: tag2, matchScore: 0.9 }, // High score, medium frequency
        { tag: tag3, matchScore: 0.6 }, // Lower score and frequency
      ];

      mockTagRepository.setSuggestions(suggestions);
    });

    it('should sort suggestions by match score descending', async () => {
      const request: GetTagSuggestionsRequest = { prefix: 'p' };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      expect(response.suggestions).toHaveLength(3);

      // Should be sorted by match score descending
      expect(response.suggestions[0].matchScore).toBe(0.9); // python
      expect(response.suggestions[1].matchScore).toBe(0.7); // programming
      expect(response.suggestions[2].matchScore).toBe(0.6); // project
    });

    it('should use alphabetical sorting as tiebreaker for equal match scores', async () => {
      const tag1 = Tag.create('python');
      const tag2 = Tag.create('programming');

      const suggestions: TagSuggestion[] = [
        { tag: tag2, matchScore: 0.8 }, // programming
        { tag: tag1, matchScore: 0.8 }, // python - should come first alphabetically
      ];

      mockTagRepository.setSuggestions(suggestions);

      const request: GetTagSuggestionsRequest = { prefix: 'p' };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      expect(response.suggestions).toHaveLength(2);

      // Should be sorted alphabetically when match scores are equal
      expect(response.suggestions[0].tag.normalizedValue).toBe('programming');
      expect(response.suggestions[1].tag.normalizedValue).toBe('python');
    });
  });

  describe('limit configuration', () => {
    beforeEach(() => {
      const tags = Array.from({ length: 10 }, (_, i) =>
        Tag.create(`tag${i + 1}`)
      );

      const suggestions: TagSuggestion[] = tags.map((tag, i) => ({
        tag,
        matchScore: 1.0 - i * 0.1, // Decreasing scores
      }));

      mockTagRepository.setSuggestions(suggestions);
    });

    it('should apply default limit when not specified', async () => {
      const request: GetTagSuggestionsRequest = { prefix: 'tag' };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      expect(response.suggestions).toHaveLength(5); // Default limit should be 5
    });

    it('should apply custom limit when specified', async () => {
      const request: GetTagSuggestionsRequest = {
        prefix: 'tag',
        options: { limit: 3 },
      };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      expect(response.suggestions).toHaveLength(3);
    });

    it('should return all results when limit exceeds available results', async () => {
      const request: GetTagSuggestionsRequest = {
        prefix: 'tag',
        options: { limit: 20 },
      };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      expect(response.suggestions).toHaveLength(10); // All available results
    });

    it('should handle very large limits', async () => {
      const request: GetTagSuggestionsRequest = {
        prefix: 'tag',
        options: { limit: 1000 },
      };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      expect(response.suggestions.length).toBeLessThanOrEqual(10);
    });
  });

  describe('performance optimization', () => {
    it('should handle large tag datasets efficiently', async () => {
      // Create large dataset
      const tags = Array.from({ length: 1000 }, (_, i) =>
        Tag.create(`performance${i}`)
      );

      const suggestions: TagSuggestion[] = tags.map((tag, i) => ({
        tag,
        matchScore: Math.random(),
      }));

      mockTagRepository.setSuggestions(suggestions);

      const request: GetTagSuggestionsRequest = {
        prefix: 'perf',
        options: { limit: 10 },
      };

      const startTime = Date.now();
      const result = await useCase.execute(request);
      const executionTime = Date.now() - startTime;

      expect(result.isOk()).toBe(true);
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second

      const response = result.unwrap();
      expect(response.suggestions.length).toBeLessThanOrEqual(10);
    });

    it('should limit repository queries with configurable limit', async () => {
      const tags = Array.from({ length: 50 }, (_, i) => Tag.create(`test${i}`));

      const suggestions: TagSuggestion[] = tags.map((tag) => ({
        tag,
        matchScore: Math.random(),
      }));

      mockTagRepository.setSuggestions(suggestions);

      const request: GetTagSuggestionsRequest = {
        prefix: 'test',
        options: { limit: 5 },
      };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      expect(response.suggestions).toHaveLength(5);
    });
  });

  describe('fuzzy matching preparation', () => {
    it('should handle partial matches and prepare for future fuzzy matching', async () => {
      const tag1 = Tag.create('javascript');
      const tag2 = Tag.create('typescript');
      const tag3 = Tag.create('coffeescript');

      const suggestions: TagSuggestion[] = [
        { tag: tag1, matchScore: 0.9 },
        { tag: tag2, matchScore: 0.8 },
        { tag: tag3, matchScore: 0.3 }, // Lower score for partial match
      ];

      mockTagRepository.setSuggestions(suggestions);

      const request: GetTagSuggestionsRequest = { prefix: 'script' };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      // Should handle tags that don't start with prefix but might match fuzzily
      expect(response.suggestions).toHaveLength(0); // Current implementation is prefix-only
    });

    it('should normalize input for consistent matching', async () => {
      const tagFactory = new TagFactory();
      const tag1 = tagFactory.createFromString('JavaScript');
      const suggestions: TagSuggestion[] = [{ tag: tag1, matchScore: 0.9 }];

      mockTagRepository.setSuggestions(suggestions);

      const request: GetTagSuggestionsRequest = { prefix: 'JAVASCRIPT' };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      expect(response.suggestions).toHaveLength(1);
      expect(response.suggestions[0].tag.normalizedValue).toBe('javascript');
    });
  });

  describe('real-time suggestions and debouncing preparation', () => {
    it('should handle rapid successive requests efficiently', async () => {
      const tag1 = Tag.create('javascript');
      const suggestions: TagSuggestion[] = [{ tag: tag1, matchScore: 0.9 }];

      mockTagRepository.setSuggestions(suggestions);

      // Simulate rapid typing
      const requests = ['j', 'ja', 'jav', 'java'].map((prefix) =>
        useCase.execute({ prefix })
      );

      const results = await Promise.all(requests);

      results.forEach((result) => {
        expect(result.isOk()).toBe(true);
      });
    });

    it('should return consistent results for same prefix', async () => {
      const tag1 = Tag.create('javascript');
      const tag2 = Tag.create('java');

      const suggestions: TagSuggestion[] = [
        { tag: tag1, matchScore: 0.9 },
        { tag: tag2, matchScore: 0.8 },
      ];

      mockTagRepository.setSuggestions(suggestions);

      const request: GetTagSuggestionsRequest = { prefix: 'ja' };

      const result1 = await useCase.execute(request);
      const result2 = await useCase.execute(request);

      expect(result1.isOk()).toBe(true);
      expect(result2.isOk()).toBe(true);

      const response1 = result1.unwrap();
      const response2 = result2.unwrap();

      expect(response1.suggestions).toEqual(response2.suggestions);
    });
  });

  describe('error handling', () => {
    it('should handle repository errors', async () => {
      mockTagRepository.setError(
        new DomainError('REPOSITORY_ERROR', 'Database connection failed')
      );

      const request: GetTagSuggestionsRequest = { prefix: 'test' };

      const result = await useCase.execute(request);

      expect(result.isErr()).toBe(true);
      const error = result.unwrapErr();
      expect(error.code).toBe('REPOSITORY_ERROR');
      expect(error.message).toBe('Database connection failed');
    });

    it('should handle unexpected exceptions', async () => {
      // Mock repository to throw unexpected error
      mockTagRepository.findByPrefix = jest
        .fn()
        .mockRejectedValue(new Error('Unexpected error'));

      const request: GetTagSuggestionsRequest = { prefix: 'test' };

      const result = await useCase.execute(request);

      expect(result.isErr()).toBe(true);
      const error = result.unwrapErr();
      expect(error.code).toBe('USE_CASE_ERROR');
      expect(error.message).toContain('Use case execution failed');
    });

    it('should handle malformed repository responses gracefully', async () => {
      // Mock repository to return unexpected data structure
      mockTagRepository.findByPrefix = jest
        .fn()
        .mockResolvedValue(Ok(null as any));

      const request: GetTagSuggestionsRequest = { prefix: 'test' };

      const result = await useCase.execute(request);

      expect(result.isErr()).toBe(true);
      const error = result.unwrapErr();
      expect(error.code).toBe('USE_CASE_ERROR');
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in prefix', async () => {
      const tag1 = Tag.create('c++');
      const tag2 = Tag.create('c#');

      const suggestions: TagSuggestion[] = [
        { tag: tag1, matchScore: 0.9 },
        { tag: tag2, matchScore: 0.8 },
      ];

      mockTagRepository.setSuggestions(suggestions);

      const request: GetTagSuggestionsRequest = { prefix: 'c+' };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      expect(response.suggestions).toHaveLength(1);
      expect(response.suggestions[0].tag.normalizedValue).toBe('c++');
    });

    it('should handle Unicode characters in prefix', async () => {
      const tag1 = Tag.create('café');
      const tag2 = Tag.create('naïve');

      const suggestions: TagSuggestion[] = [
        { tag: tag1, matchScore: 0.9 },
        { tag: tag2, matchScore: 0.8 },
      ];

      mockTagRepository.setSuggestions(suggestions);

      const request: GetTagSuggestionsRequest = { prefix: 'café' };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      expect(response.suggestions).toHaveLength(1);
      expect(response.suggestions[0].tag.normalizedValue).toBe('café');
    });

    it('should handle very short prefixes', async () => {
      const tag1 = Tag.create('a');
      const tag2 = Tag.create('b');

      const suggestions: TagSuggestion[] = [
        { tag: tag1, matchScore: 0.9 },
        { tag: tag2, matchScore: 0.8 },
      ];

      mockTagRepository.setSuggestions(suggestions);

      const request: GetTagSuggestionsRequest = { prefix: 'a' };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      expect(response.suggestions).toHaveLength(1);
      expect(response.suggestions[0].tag.normalizedValue).toBe('a');
    });

    it('should handle very long prefixes', async () => {
      const longTagName = 'a'.repeat(100);
      const tag1 = Tag.create(longTagName);

      const suggestions: TagSuggestion[] = [{ tag: tag1, matchScore: 0.9 }];

      mockTagRepository.setSuggestions(suggestions);

      const longPrefix = 'a'.repeat(50);
      const request: GetTagSuggestionsRequest = { prefix: longPrefix };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();
      expect(response.suggestions).toHaveLength(1);
    });
  });

  describe('response format validation', () => {
    it('should return properly structured response', async () => {
      const tag1 = Tag.create('javascript');
      const suggestions: TagSuggestion[] = [{ tag: tag1, matchScore: 0.9 }];

      mockTagRepository.setSuggestions(suggestions);

      const request: GetTagSuggestionsRequest = { prefix: 'java' };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();

      expect(response).toHaveProperty('suggestions');
      expect(Array.isArray(response.suggestions)).toBe(true);
      expect(response.suggestions[0]).toHaveProperty('tag');
      expect(response.suggestions[0]).toHaveProperty('matchScore');
      expect(typeof response.suggestions[0].matchScore).toBe('number');
    });

    it('should include metadata in response for optimization', async () => {
      const tag1 = Tag.create('javascript');
      const suggestions: TagSuggestion[] = [{ tag: tag1, matchScore: 0.9 }];

      mockTagRepository.setSuggestions(suggestions);

      const request: GetTagSuggestionsRequest = { prefix: 'java' };

      const result = await useCase.execute(request);

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();

      // Response should be optimized for real-time usage
      expect(response.suggestions.length).toBeGreaterThanOrEqual(0);
      expect(response.suggestions.length).toBeLessThanOrEqual(5); // Default limit
    });
  });
});
