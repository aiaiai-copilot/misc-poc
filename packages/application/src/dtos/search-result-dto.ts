import { RecordDTO, RecordDTOMapper } from './record-dto';
import {
  RecordSearchResult,
  RecordSearchOptions,
} from '../ports/record-repository';
import { TagId } from '@misc-poc/shared';

export interface SearchResultDTO {
  readonly records: RecordDTO[];
  readonly total: number;
  readonly hasMore: boolean;
  readonly pagination?: {
    readonly limit: number;
    readonly offset: number;
    readonly currentPage: number;
    readonly totalPages: number;
  };
  readonly searchQuery?: string;
  readonly filters?: {
    readonly tagIds?: string[];
    readonly dateRange?: {
      readonly from: string;
      readonly to: string;
    };
  };
}

export class SearchResultDTOMapper {
  static toDTO(searchResult: RecordSearchResult): SearchResultDTO {
    return {
      records: RecordDTOMapper.toDTOs(searchResult.records),
      total: searchResult.total,
      hasMore: searchResult.hasMore,
    };
  }

  static toDTOWithPagination(
    searchResult: RecordSearchResult,
    options: RecordSearchOptions
  ): SearchResultDTO {
    const limit = options.limit || 10;
    const offset = options.offset || 0;
    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(searchResult.total / limit);

    return {
      records: RecordDTOMapper.toDTOs(searchResult.records),
      total: searchResult.total,
      hasMore: searchResult.hasMore,
      pagination: {
        limit,
        offset,
        currentPage,
        totalPages,
      },
    };
  }

  static toDTOWithFilters(
    searchResult: RecordSearchResult,
    searchQuery?: string,
    filters?: {
      tagIds?: TagId[];
      dateRange?: {
        from: Date;
        to: Date;
      };
    }
  ): SearchResultDTO {
    return {
      records: RecordDTOMapper.toDTOs(searchResult.records),
      total: searchResult.total,
      hasMore: searchResult.hasMore,
      searchQuery,
      filters: filters
        ? {
            tagIds: filters.tagIds?.map((tagId) => tagId.toString()),
            dateRange: filters.dateRange
              ? {
                  from: filters.dateRange.from.toISOString(),
                  to: filters.dateRange.to.toISOString(),
                }
              : undefined,
          }
        : undefined,
    };
  }
}
