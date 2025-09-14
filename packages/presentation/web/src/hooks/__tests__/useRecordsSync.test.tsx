import { renderHook, act, waitFor } from '@testing-library/react';
import { useRecordsSync, RecordsSyncProvider } from '../useRecordsSync';
import { useApplicationContext } from '../../contexts/ApplicationContext';
import { Ok, Err } from '@misc-poc/shared';
import { DomainError } from '@misc-poc/domain';
import { vi } from 'vitest';
import { ReactNode } from 'react';

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

// Wrapper component for testing
const TestWrapper = ({ children }: { children: ReactNode }): JSX.Element => (
  <RecordsSyncProvider>
    {children}
  </RecordsSyncProvider>
);

describe('useRecordsSync - TDD Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseApplicationContext.mockReturnValue({
      searchRecordsUseCase: mockSearchRecordsUseCase,
      createRecordUseCase: mockCreateRecordUseCase,
      updateRecordUseCase: mockUpdateRecordUseCase,
      deleteRecordUseCase: mockDeleteRecordUseCase,
      getTagSuggestionsUseCase: null,
      exportDataUseCase: null,
      importDataUseCase: null,
      searchModeDetector: null,
      tagCloudBuilder: null,
    });
  });

  describe('Basic State Management', () => {
    it('should provide initial empty state', () => {
      const { result } = renderHook(() => useRecordsSync(), { wrapper: TestWrapper });

      expect(result.current.records).toEqual([]);
      expect(result.current.isLoading).toBe(true); // Should be loading initially
      expect(result.current.error).toBeNull();
    });

    it('should load initial records on mount', async () => {
      const mockRecords = [
        {
          id: 'record-1',
          content: 'tag1 tag2',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      mockSearchRecordsUseCase.execute.mockResolvedValue(
        Ok({
          searchResult: {
            records: mockRecords,
            totalCount: 1,
          },
        })
      );

      const { result } = renderHook(() => useRecordsSync(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.records).toHaveLength(1);
        expect(result.current.records[0]).toEqual({
          id: 'record-1',
          tags: ['tag1', 'tag2'],
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
      });
    });
  });

  describe('Automatic Refresh After CRUD Operations', () => {
    it('should automatically refresh records after successful create', async () => {
      // Setup: Initial records
      mockSearchRecordsUseCase.execute.mockResolvedValue(
        Ok({
          searchResult: {
            records: [],
            totalCount: 0,
          },
        })
      );

      const { result } = renderHook(() => useRecordsSync(), { wrapper: TestWrapper });

      // Setup create response
      mockCreateRecordUseCase.execute.mockResolvedValue(
        Ok({
          record: {
            id: 'new-record',
            content: 'new tag',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        })
      );

      // Setup refresh response with new record
      mockSearchRecordsUseCase.execute.mockResolvedValue(
        Ok({
          searchResult: {
            records: [
              {
                id: 'new-record',
                content: 'new tag',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
              },
            ],
            totalCount: 1,
          },
        })
      );

      await act(async () => {
        const success = await result.current.createRecord(['new', 'tag']);
        expect(success).toBe(true);
      });

      // Should automatically refresh after create
      await waitFor(() => {
        expect(mockSearchRecordsUseCase.execute).toHaveBeenCalledTimes(3); // Initial load + refresh after create + sync event
        expect(result.current.records).toHaveLength(1);
      });
    });

    it('should automatically refresh records after successful update', async () => {
      // Setup: Initial record
      const initialRecord = {
        id: 'record-1',
        content: 'old tag',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockSearchRecordsUseCase.execute.mockResolvedValue(
        Ok({
          searchResult: {
            records: [initialRecord],
            totalCount: 1,
          },
        })
      );

      const { result } = renderHook(() => useRecordsSync(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.records).toHaveLength(1);
      });

      // Setup update response
      mockUpdateRecordUseCase.execute.mockResolvedValue(
        Ok({
          record: {
            id: 'record-1',
            content: 'updated tag',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T01:00:00Z',
          },
        })
      );

      // Setup refresh response with updated record
      mockSearchRecordsUseCase.execute.mockResolvedValue(
        Ok({
          searchResult: {
            records: [
              {
                id: 'record-1',
                content: 'updated tag',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T01:00:00Z',
              },
            ],
            totalCount: 1,
          },
        })
      );

      await act(async () => {
        const success = await result.current.updateRecord('record-1', ['updated', 'tag']);
        expect(success).toBe(true);
      });

      // Should automatically refresh after update
      await waitFor(() => {
        expect(mockSearchRecordsUseCase.execute).toHaveBeenCalledTimes(3); // Initial load + refresh after update + sync event
        expect(result.current.records[0].tags).toEqual(['updated', 'tag']);
      });
    });

    it('should automatically refresh records after successful delete', async () => {
      // Setup: Initial record
      const initialRecord = {
        id: 'record-1',
        content: 'tag to delete',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockSearchRecordsUseCase.execute.mockResolvedValue(
        Ok({
          searchResult: {
            records: [initialRecord],
            totalCount: 1,
          },
        })
      );

      const { result } = renderHook(() => useRecordsSync(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.records).toHaveLength(1);
      });

      // Setup delete response
      mockDeleteRecordUseCase.execute.mockResolvedValue(Ok({}));

      // Setup refresh response with record removed
      mockSearchRecordsUseCase.execute.mockResolvedValue(
        Ok({
          searchResult: {
            records: [],
            totalCount: 0,
          },
        })
      );

      await act(async () => {
        const success = await result.current.deleteRecord('record-1');
        expect(success).toBe(true);
      });

      // Should automatically refresh after delete
      await waitFor(() => {
        expect(mockSearchRecordsUseCase.execute).toHaveBeenCalledTimes(3); // Initial load + refresh after delete + sync event
        expect(result.current.records).toHaveLength(0);
      });
    });
  });

  describe('Optimistic Updates with Rollback on Failure', () => {
    it('should perform optimistic update for create and rollback on failure', async () => {
      // Setup: Initial empty state
      mockSearchRecordsUseCase.execute.mockResolvedValue(
        Ok({
          searchResult: {
            records: [],
            totalCount: 0,
          },
        })
      );

      const { result } = renderHook(() => useRecordsSync(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.records).toHaveLength(0);
      });

      // Setup create failure
      mockCreateRecordUseCase.execute.mockResolvedValue(
        Err(new DomainError('Failed to create', 'CREATE_FAILED'))
      );

      await act(async () => {
        const success = await result.current.createRecord(['new', 'tag']);
        expect(success).toBe(false);
      });

      // State should remain unchanged after failed optimistic update
      expect(result.current.records).toHaveLength(0);
      expect(result.current.error).not.toBeNull();
    });

    it('should perform optimistic update for update and rollback on failure', async () => {
      // Setup: Initial record
      const initialRecord = {
        id: 'record-1',
        content: 'original tag',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockSearchRecordsUseCase.execute.mockResolvedValue(
        Ok({
          searchResult: {
            records: [initialRecord],
            totalCount: 1,
          },
        })
      );

      const { result } = renderHook(() => useRecordsSync(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.records).toHaveLength(1);
        expect(result.current.records[0].tags).toEqual(['original', 'tag']);
      });

      // Setup update failure
      mockUpdateRecordUseCase.execute.mockResolvedValue(
        Err(new DomainError('Failed to update', 'UPDATE_FAILED'))
      );

      await act(async () => {
        const success = await result.current.updateRecord('record-1', ['failed', 'update']);
        expect(success).toBe(false);
      });

      // State should rollback to original after failed optimistic update
      expect(result.current.records[0].tags).toEqual(['original', 'tag']);
      expect(result.current.error).not.toBeNull();
    });

    it('should perform optimistic delete and rollback on failure', async () => {
      // Setup: Initial record
      const initialRecord = {
        id: 'record-1',
        content: 'tag to keep',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockSearchRecordsUseCase.execute.mockResolvedValue(
        Ok({
          searchResult: {
            records: [initialRecord],
            totalCount: 1,
          },
        })
      );

      const { result } = renderHook(() => useRecordsSync(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.records).toHaveLength(1);
      });

      // Setup delete failure
      mockDeleteRecordUseCase.execute.mockResolvedValue(
        Err(new DomainError('Failed to delete', 'DELETE_FAILED'))
      );

      await act(async () => {
        const success = await result.current.deleteRecord('record-1');
        expect(success).toBe(false);
      });

      // Record should be restored after failed optimistic delete
      expect(result.current.records).toHaveLength(1);
      expect(result.current.error).not.toBeNull();
    });
  });

  describe('Event-Based Synchronization Between Components', () => {
    it('should synchronize state across multiple hook instances', async () => {
      // Setup initial records
      mockSearchRecordsUseCase.execute.mockResolvedValue(
        Ok({
          searchResult: {
            records: [],
            totalCount: 0,
          },
        })
      );

      // Create two hook instances (simulating different components)
      const { result: result1 } = renderHook(() => useRecordsSync(), { wrapper: TestWrapper });
      const { result: result2 } = renderHook(() => useRecordsSync(), { wrapper: TestWrapper });

      // Both should start with empty records
      expect(result1.current.records).toHaveLength(0);
      expect(result2.current.records).toHaveLength(0);

      // Setup create response
      mockCreateRecordUseCase.execute.mockResolvedValue(
        Ok({
          record: {
            id: 'sync-record',
            content: 'sync test',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        })
      );

      // Setup refresh response
      mockSearchRecordsUseCase.execute.mockResolvedValue(
        Ok({
          searchResult: {
            records: [
              {
                id: 'sync-record',
                content: 'sync test',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
              },
            ],
            totalCount: 1,
          },
        })
      );

      // Create record through first hook instance
      await act(async () => {
        await result1.current.createRecord(['sync', 'test']);
      });

      // Both hook instances should be synchronized
      await waitFor(() => {
        expect(result1.current.records).toHaveLength(1);
        expect(result2.current.records).toHaveLength(1);
        expect(result1.current.records[0].id).toBe('sync-record');
        expect(result2.current.records[0].id).toBe('sync-record');
      });
    });

    it('should provide manual refresh function for components', async () => {
      // Setup initial records
      mockSearchRecordsUseCase.execute.mockResolvedValue(
        Ok({
          searchResult: {
            records: [],
            totalCount: 0,
          },
        })
      );

      const { result } = renderHook(() => useRecordsSync(), { wrapper: TestWrapper });

      // Setup refresh response with new records
      mockSearchRecordsUseCase.execute.mockResolvedValue(
        Ok({
          searchResult: {
            records: [
              {
                id: 'manual-refresh-record',
                content: 'manual test',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
              },
            ],
            totalCount: 1,
          },
        })
      );

      // Manual refresh should update records
      await act(async () => {
        await result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.records).toHaveLength(1);
        expect(result.current.records[0].id).toBe('manual-refresh-record');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle loading errors gracefully', async () => {
      mockSearchRecordsUseCase.execute.mockResolvedValue(
        Err(new DomainError('Search failed', 'SEARCH_FAILED'))
      );

      const { result } = renderHook(() => useRecordsSync(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
        expect(result.current.records).toEqual([]);
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should clear errors when operations succeed', async () => {
      // Start with a failed state
      mockSearchRecordsUseCase.execute.mockResolvedValue(
        Err(new DomainError('Initial error', 'INITIAL_ERROR'))
      );

      const { result } = renderHook(() => useRecordsSync(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      // Now make the search succeed
      mockSearchRecordsUseCase.execute.mockResolvedValue(
        Ok({
          searchResult: {
            records: [],
            totalCount: 0,
          },
        })
      );

      await act(async () => {
        await result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });
    });
  });
});