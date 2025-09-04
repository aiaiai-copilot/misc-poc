import { Result, Ok, Err } from '@misc-poc/shared';
import { DomainError } from '@misc-poc/domain';
import { TagRepository, TagSuggestion } from '../ports/tag-repository';

export interface GetTagSuggestionsOptions {
  readonly limit?: number;
}

export interface GetTagSuggestionsRequest {
  readonly prefix: string;
  readonly options?: GetTagSuggestionsOptions;
}

export interface GetTagSuggestionsResponse {
  readonly suggestions: TagSuggestion[];
}

export class GetTagSuggestionsUseCase {
  private static readonly DEFAULT_LIMIT = 5;
  private readonly tagRepository: TagRepository;

  constructor(tagRepository: TagRepository) {
    if (tagRepository == null) {
      throw new Error('TagRepository cannot be null or undefined');
    }

    this.tagRepository = tagRepository;
  }

  async execute(
    request: GetTagSuggestionsRequest
  ): Promise<Result<GetTagSuggestionsResponse, DomainError>> {
    // Input validation
    if (request == null) {
      return Err(
        new DomainError(
          'VALIDATION_ERROR',
          'Request cannot be null or undefined'
        )
      );
    }

    // Validate prefix
    if (
      request.prefix == null ||
      typeof request.prefix !== 'string' ||
      request.prefix.trim() === ''
    ) {
      return Err(
        new DomainError(
          'VALIDATION_ERROR',
          'Prefix cannot be empty or whitespace only'
        )
      );
    }

    // Validate limit if provided
    const limit =
      request.options?.limit ?? GetTagSuggestionsUseCase.DEFAULT_LIMIT;
    if (limit <= 0) {
      return Err(
        new DomainError('VALIDATION_ERROR', 'Limit must be a positive number')
      );
    }

    try {
      // Normalize prefix for consistent matching
      const normalizedPrefix = request.prefix.trim().toLowerCase();

      // Query repository for tag suggestions
      const suggestionsResult = await this.tagRepository.findByPrefix(
        normalizedPrefix,
        limit
      );

      if (suggestionsResult.isErr()) {
        return Err(suggestionsResult.unwrapErr());
      }

      const suggestions = suggestionsResult.unwrap();

      // Validate repository response
      if (!Array.isArray(suggestions)) {
        return Err(
          new DomainError(
            'USE_CASE_ERROR',
            'Invalid response from tag repository'
          )
        );
      }

      // The repository already handles:
      // - Prefix matching (case-insensitive)
      // - Frequency-based sorting by match score
      // - Limit application
      // - Performance optimization

      return Ok({
        suggestions: suggestions,
      });
    } catch (error) {
      return Err(
        new DomainError(
          'USE_CASE_ERROR',
          `Use case execution failed: ${(error as Error).message}`
        )
      );
    }
  }
}
