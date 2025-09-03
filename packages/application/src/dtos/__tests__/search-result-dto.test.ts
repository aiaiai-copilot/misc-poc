import { SearchResultDTO, SearchResultDTOMapper } from '../search-result-dto';
import { RecordDTO } from '../record-dto';
import { RecordSearchResult } from '../../ports/record-repository';
import { Record } from '@misc-poc/domain';
import { RecordId, RecordContent, TagId } from '@misc-poc/shared';

describe('SearchResultDTO', () => {
  const mockRecords: RecordDTO[] = [
    {
      id: 'record-1',
      content: 'First record',
      tagIds: ['tag-1', 'tag-2'],
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
    },
    {
      id: 'record-2',
      content: 'Second record',
      tagIds: ['tag-2', 'tag-3'],
      createdAt: '2023-01-02T00:00:00.000Z',
      updatedAt: '2023-01-02T00:00:00.000Z',
    },
  ];

  const mockDomainRecords = [
    new Record(
      new RecordId('550e8400-e29b-41d4-a716-446655440001'),
      new RecordContent('First record'),
      new Set([
        new TagId('550e8400-e29b-41d4-a716-446655440101'),
        new TagId('550e8400-e29b-41d4-a716-446655440102'),
      ]),
      new Date('2023-01-01T00:00:00.000Z'),
      new Date('2023-01-01T00:00:00.000Z')
    ),
    new Record(
      new RecordId('550e8400-e29b-41d4-a716-446655440002'),
      new RecordContent('Second record'),
      new Set([
        new TagId('550e8400-e29b-41d4-a716-446655440102'),
        new TagId('550e8400-e29b-41d4-a716-446655440103'),
      ]),
      new Date('2023-01-02T00:00:00.000Z'),
      new Date('2023-01-02T00:00:00.000Z')
    ),
  ];

  describe('TypeScript typing', () => {
    it('should have correct type definition for required fields', () => {
      const dto: SearchResultDTO = {
        records: mockRecords,
        total: 100,
        hasMore: true,
        pagination: {
          limit: 10,
          offset: 0,
          currentPage: 1,
          totalPages: 10,
        },
      };

      expect(dto.records).toBe(mockRecords);
      expect(dto.total).toBe(100);
      expect(dto.hasMore).toBe(true);
      expect(dto.pagination.limit).toBe(10);
      expect(dto.pagination.offset).toBe(0);
      expect(dto.pagination.currentPage).toBe(1);
      expect(dto.pagination.totalPages).toBe(10);
    });

    it('should support optional pagination field', () => {
      const dtoWithoutPagination: SearchResultDTO = {
        records: mockRecords,
        total: 2,
        hasMore: false,
      };

      expect(dtoWithoutPagination.pagination).toBeUndefined();
    });

    it('should support optional searchQuery and filters', () => {
      const dtoWithQuery: SearchResultDTO = {
        records: mockRecords,
        total: 2,
        hasMore: false,
        searchQuery: 'test query',
        filters: {
          tagIds: ['tag-1', 'tag-2'],
          dateRange: {
            from: '2023-01-01T00:00:00.000Z',
            to: '2023-01-31T23:59:59.999Z',
          },
        },
      };

      expect(dtoWithQuery.searchQuery).toBe('test query');
      expect(dtoWithQuery.filters?.tagIds).toEqual(['tag-1', 'tag-2']);
      expect(dtoWithQuery.filters?.dateRange?.from).toBe(
        '2023-01-01T00:00:00.000Z'
      );
    });
  });

  describe('pagination data structure', () => {
    it('should correctly calculate pagination metadata', () => {
      const dto: SearchResultDTO = {
        records: mockRecords,
        total: 25,
        hasMore: true,
        pagination: {
          limit: 10,
          offset: 10,
          currentPage: 2,
          totalPages: 3,
        },
      };

      expect(dto.pagination?.currentPage).toBe(2);
      expect(dto.pagination?.totalPages).toBe(3);
      expect(dto.pagination?.offset).toBe(10);
      expect(dto.hasMore).toBe(true);
    });

    it('should handle last page correctly', () => {
      const dto: SearchResultDTO = {
        records: mockRecords.slice(0, 5),
        total: 15,
        hasMore: false,
        pagination: {
          limit: 10,
          offset: 10,
          currentPage: 2,
          totalPages: 2,
        },
      };

      expect(dto.hasMore).toBe(false);
      expect(dto.pagination?.currentPage).toBe(dto.pagination?.totalPages);
    });
  });

  describe('serialization support', () => {
    it('should be JSON serializable', () => {
      const dto: SearchResultDTO = {
        records: mockRecords,
        total: 2,
        hasMore: false,
        pagination: {
          limit: 10,
          offset: 0,
          currentPage: 1,
          totalPages: 1,
        },
      };

      const serialized = JSON.stringify(dto);
      const deserialized = JSON.parse(serialized) as SearchResultDTO;

      expect(deserialized).toEqual(dto);
    });

    it('should preserve nested object structure during serialization', () => {
      const dto: SearchResultDTO = {
        records: mockRecords,
        total: 2,
        hasMore: false,
        filters: {
          tagIds: ['tag-1'],
          dateRange: {
            from: '2023-01-01T00:00:00.000Z',
            to: '2023-01-31T23:59:59.999Z',
          },
        },
      };

      const serialized = JSON.stringify(dto);
      const deserialized = JSON.parse(serialized) as SearchResultDTO;

      expect(deserialized.filters?.tagIds).toEqual(['tag-1']);
      expect(deserialized.filters?.dateRange?.from).toBe(
        '2023-01-01T00:00:00.000Z'
      );
    });
  });

  describe('SearchResultDTOMapper', () => {
    it('should map RecordSearchResult to SearchResultDTO', () => {
      const searchResult: RecordSearchResult = {
        records: mockDomainRecords,
        total: 2,
        hasMore: false,
      };

      const dto = SearchResultDTOMapper.toDTO(searchResult);

      expect(dto.records).toHaveLength(2);
      expect(dto.total).toBe(2);
      expect(dto.hasMore).toBe(false);
      expect(dto.records[0].id).toBe('550e8400-e29b-41d4-a716-446655440001');
      expect(dto.records[1].id).toBe('550e8400-e29b-41d4-a716-446655440002');
    });

    it('should map with pagination options', () => {
      const searchResult: RecordSearchResult = {
        records: mockDomainRecords,
        total: 25,
        hasMore: true,
      };

      const dto = SearchResultDTOMapper.toDTOWithPagination(searchResult, {
        limit: 10,
        offset: 10,
      });

      expect(dto.pagination).toBeDefined();
      expect(dto.pagination?.limit).toBe(10);
      expect(dto.pagination?.offset).toBe(10);
      expect(dto.pagination?.currentPage).toBe(2);
      expect(dto.pagination?.totalPages).toBe(3);
    });

    it('should handle empty search results', () => {
      const emptySearchResult: RecordSearchResult = {
        records: [],
        total: 0,
        hasMore: false,
      };

      const dto = SearchResultDTOMapper.toDTO(emptySearchResult);

      expect(dto.records).toEqual([]);
      expect(dto.total).toBe(0);
      expect(dto.hasMore).toBe(false);
    });

    it('should include search query and filters when provided', () => {
      const searchResult: RecordSearchResult = {
        records: mockDomainRecords,
        total: 2,
        hasMore: false,
      };

      const dto = SearchResultDTOMapper.toDTOWithFilters(
        searchResult,
        'test query',
        {
          tagIds: [new TagId('550e8400-e29b-41d4-a716-446655440101')],
          dateRange: {
            from: new Date('2023-01-01T00:00:00.000Z'),
            to: new Date('2023-01-31T23:59:59.999Z'),
          },
        }
      );

      expect(dto.searchQuery).toBe('test query');
      expect(dto.filters?.tagIds).toEqual([
        '550e8400-e29b-41d4-a716-446655440101',
      ]);
      expect(dto.filters?.dateRange?.from).toBe('2023-01-01T00:00:00.000Z');
      expect(dto.filters?.dateRange?.to).toBe('2023-01-31T23:59:59.999Z');
    });
  });

  describe('data transformation', () => {
    it('should transform domain records to DTOs', () => {
      const searchResult: RecordSearchResult = {
        records: mockDomainRecords,
        total: 2,
        hasMore: false,
      };

      const dto = SearchResultDTOMapper.toDTO(searchResult);

      expect(dto.records[0]).toMatchObject({
        id: '550e8400-e29b-41d4-a716-446655440001',
        content: 'First record',
        tagIds: [
          '550e8400-e29b-41d4-a716-446655440101',
          '550e8400-e29b-41d4-a716-446655440102',
        ],
      });
    });

    it('should calculate correct pagination metadata', () => {
      const searchResult: RecordSearchResult = {
        records: mockDomainRecords,
        total: 27,
        hasMore: true,
      };

      const dto = SearchResultDTOMapper.toDTOWithPagination(searchResult, {
        limit: 10,
        offset: 20,
      });

      expect(dto.pagination?.currentPage).toBe(3);
      expect(dto.pagination?.totalPages).toBe(3);
    });
  });
});
