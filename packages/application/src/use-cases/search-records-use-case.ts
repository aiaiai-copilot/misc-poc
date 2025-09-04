import { Result, SearchQuery, Ok, Err } from '@misc-poc/shared';
import { DomainError } from '@misc-poc/domain';
import {
  RecordRepository,
  RecordSearchOptions,
} from '../ports/record-repository';
import {
  SearchResultDTO,
  SearchResultDTOMapper,
} from '../dtos/search-result-dto';

export interface SearchRecordsRequest {
  readonly query: string;
  readonly options?: RecordSearchOptions;
}

export interface SearchRecordsResponse {
  readonly searchResult: SearchResultDTO;
}

export class SearchRecordsUseCase {
  private readonly recordRepository: RecordRepository;

  constructor(recordRepository: RecordRepository) {
    if (recordRepository == null) {
      throw new Error('RecordRepository cannot be null or undefined');
    }

    this.recordRepository = recordRepository;
  }

  async execute(
    request: SearchRecordsRequest
  ): Promise<Result<SearchRecordsResponse, DomainError>> {
    // Input validation
    if (request == null) {
      return Err(
        new DomainError(
          'VALIDATION_ERROR',
          'Request cannot be null or undefined'
        )
      );
    }

    try {
      // Handle empty or whitespace-only queries by returning all records
      const queryString = request.query || '';
      const trimmedQuery = queryString.trim();

      // Set default options
      const options: RecordSearchOptions = {
        limit: 10,
        offset: 0,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        ...request.options,
      };

      if (trimmedQuery === '') {
        // Empty query - return all records with pagination and sorting
        const findAllResult = await this.recordRepository.findAll(options);
        if (findAllResult.isErr()) {
          return Err(findAllResult.unwrapErr());
        }

        const searchResult = findAllResult.unwrap();
        return Ok({
          searchResult: SearchResultDTOMapper.toDTOWithPagination(
            searchResult,
            options
          ),
        });
      }

      // Create SearchQuery for normalization
      let searchQuery: SearchQuery;
      try {
        searchQuery = new SearchQuery(trimmedQuery);
      } catch (error) {
        return Err(
          new DomainError(
            'VALIDATION_ERROR',
            `Invalid search query: ${(error as Error).message}`
          )
        );
      }

      // Perform search using the repository
      const searchResult = await this.recordRepository.search(
        searchQuery,
        options
      );
      if (searchResult.isErr()) {
        return Err(searchResult.unwrapErr());
      }

      const result = searchResult.unwrap();

      // Return success response with search results
      return Ok({
        searchResult: SearchResultDTOMapper.toDTOWithPagination(
          result,
          options
        ),
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
