import { renderHook, act } from '@testing-library/react';
import { useRecordsIntegrated } from '../useRecordsIntegrated';
import { useApplicationContext } from '../../contexts/ApplicationContext';
import { Ok, Err } from '@misc-poc/shared';
import { DomainError } from '@misc-poc/domain';
import { vi } from 'vitest';

// Mock the application context
vi.mock('../../contexts/ApplicationContext');
const mockUseApplicationContext = useApplicationContext as ReturnType<typeof vi.fn>;

// Mock use cases
const mockSearchRecordsUseCase = {
  execute: vi.fn(),
};

const mockCreateRecordUseCase = {
  execute: vi.fn(),
};

const mockUpdateRecordUseCase = {
  execute: vi.fn(),
};

const mockDeleteRecordUseCase = {
  execute: vi.fn(),
};

describe('useRecordsIntegrated - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApplicationContext.mockReturnValue({
      searchRecordsUseCase: mockSearchRecordsUseCase,
      createRecordUseCase: mockCreateRecordUseCase,
      updateRecordUseCase: mockUpdateRecordUseCase,
      deleteRecordUseCase: mockDeleteRecordUseCase,
    });
  });

  describe('deduplication integration', () => {
    it('should deduplicate records on initial load', async () => {
      // Mock search returning duplicate records
      mockSearchRecordsUseCase.execute.mockResolvedValue(Ok({
        searchResult: {
          records: [
            {
              id: 'record-1',
              content: 'javascript react',
              createdAt: '2024-01-01T10:00:00.000Z',
              updatedAt: '2024-01-01T10:00:00.000Z',
            },
            {
              id: 'record-2',
              content: 'react javascript', // Same tags, different order
              createdAt: '2024-01-02T10:00:00.000Z',
              updatedAt: '2024-01-02T10:00:00.000Z',
            },
            {
              id: 'record-3',
              content: 'python django',
              createdAt: '2024-01-03T10:00:00.000Z',
              updatedAt: '2024-01-03T10:00:00.000Z',
            },
          ],
          total: 3,
          hasMore: false,
        },
      }));

      const { result } = renderHook(() => useRecordsIntegrated());

      // Wait for initial load to complete
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Should deduplicate the identical tag sets
      expect(result.current.records).toHaveLength(2);
      expect(result.current.records[0].id).toBe('record-1'); // First occurrence kept
      expect(result.current.records[1].id).toBe('record-3'); // Different tag set kept
      expect(result.current.records.find(r => r.id === 'record-2')).toBeUndefined(); // Duplicate removed
    });

    it('should deduplicate records when creating new records', async () => {
      // Setup initial records
      mockSearchRecordsUseCase.execute.mockResolvedValue(Ok({
        searchResult: {
          records: [
            {
              id: 'existing-record',
              content: 'javascript react',
              createdAt: '2024-01-01T10:00:00.000Z',
              updatedAt: '2024-01-01T10:00:00.000Z',
            },
          ],
          total: 1,
          hasMore: false,
        },
      }));

      // Mock creating a record with same tags
      mockCreateRecordUseCase.execute.mockResolvedValue(Ok({
        record: {
          id: 'new-record',
          content: 'react javascript', // Same tags, different order
          createdAt: '2024-01-02T10:00:00.000Z',
          updatedAt: '2024-01-02T10:00:00.000Z',
        },
      }));

      const { result } = renderHook(() => useRecordsIntegrated());

      // Wait for initial load
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.records).toHaveLength(1);

      // Create a record with same tag set
      await act(async () => {
        const success = await result.current.createRecord(['react', 'javascript']);
        expect(success).toBe(true);
      });

      // Should still have only 1 record due to deduplication
      expect(result.current.records).toHaveLength(1);
      expect(result.current.records[0].id).toBe('existing-record'); // First occurrence kept
    });

    it('should handle case-insensitive deduplication', async () => {
      mockSearchRecordsUseCase.execute.mockResolvedValue(Ok({
        searchResult: {
          records: [
            {
              id: 'record-1',
              content: 'JavaScript React',
              createdAt: '2024-01-01T10:00:00.000Z',
              updatedAt: '2024-01-01T10:00:00.000Z',
            },
            {
              id: 'record-2',
              content: 'javascript react', // Same tags, different case
              createdAt: '2024-01-02T10:00:00.000Z',
              updatedAt: '2024-01-02T10:00:00.000Z',
            },
          ],
          total: 2,
          hasMore: false,
        },
      }));

      const { result } = renderHook(() => useRecordsIntegrated());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.records).toHaveLength(1);
      expect(result.current.records[0].id).toBe('record-1');
    });

    it('should deduplicate records in search results', async () => {
      // Initial empty state
      mockSearchRecordsUseCase.execute.mockResolvedValueOnce(Ok({
        searchResult: { records: [], total: 0, hasMore: false },
      }));

      const { result } = renderHook(() => useRecordsIntegrated());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Mock search returning duplicates
      mockSearchRecordsUseCase.execute.mockResolvedValueOnce(Ok({
        searchResult: {
          records: [
            {
              id: 'record-1',
              content: 'javascript react',
              createdAt: '2024-01-01T10:00:00.000Z',
              updatedAt: '2024-01-01T10:00:00.000Z',
            },
            {
              id: 'record-2',
              content: 'react javascript', // Duplicate
              createdAt: '2024-01-02T10:00:00.000Z',
              updatedAt: '2024-01-02T10:00:00.000Z',
            },
          ],
          total: 2,
          hasMore: false,
        },
      }));

      // Perform search
      await act(async () => {
        await result.current.performSearch('javascript');
      });

      expect(result.current.records).toHaveLength(1);
      expect(result.current.records[0].id).toBe('record-1');
    });

    it('should preserve records with different tag sets', async () => {
      mockSearchRecordsUseCase.execute.mockResolvedValue(Ok({
        searchResult: {
          records: [
            {
              id: 'record-1',
              content: 'javascript react',
              createdAt: '2024-01-01T10:00:00.000Z',
              updatedAt: '2024-01-01T10:00:00.000Z',
            },
            {
              id: 'record-2',
              content: 'python django',
              createdAt: '2024-01-02T10:00:00.000Z',
              updatedAt: '2024-01-02T10:00:00.000Z',
            },
            {
              id: 'record-3',
              content: 'java spring',
              createdAt: '2024-01-03T10:00:00.000Z',
              updatedAt: '2024-01-03T10:00:00.000Z',
            },
          ],
          total: 3,
          hasMore: false,
        },
      }));

      const { result } = renderHook(() => useRecordsIntegrated());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // All records should be preserved since they have different tag sets
      expect(result.current.records).toHaveLength(3);
      expect(result.current.records.map(r => r.id)).toEqual(['record-1', 'record-2', 'record-3']);
    });
  });

  describe('error handling', () => {
    it('should handle search errors gracefully without breaking deduplication', async () => {
      mockSearchRecordsUseCase.execute.mockResolvedValue(
        Err(new DomainError('SEARCH_ERROR', 'Search failed'))
      );

      const { result } = renderHook(() => useRecordsIntegrated());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Should not crash and should have empty records
      expect(result.current.records).toHaveLength(0);
      expect(result.current.isLoading).toBe(false);
    });
  });
});