import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode
} from 'react';
import { useApplicationContext } from '../contexts/ApplicationContext';

// Define Record type based on existing structure
interface Record {
  id: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface RecordsSyncState {
  records: Record[];
  isLoading: boolean;
  error: Error | null;
}

interface RecordsSyncActions {
  createRecord: (tags: string[]) => Promise<boolean>;
  updateRecord: (id: string, tags: string[]) => Promise<boolean>;
  deleteRecord: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

type RecordsSyncContextValue = RecordsSyncState & RecordsSyncActions;

// Event emitter for cross-component synchronization
class RecordsSyncEventEmitter {
  private listeners: Array<() => void> = [];

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  emit(): void {
    this.listeners.forEach(listener => listener());
  }
}

const recordsSyncEmitter = new RecordsSyncEventEmitter();

const RecordsSyncContext = createContext<RecordsSyncContextValue | null>(null);

export interface RecordsSyncProviderProps {
  children: ReactNode;
}

export const RecordsSyncProvider: React.FC<RecordsSyncProviderProps> = ({ children }) => {
  const {
    searchRecordsUseCase,
    createRecordUseCase,
    updateRecordUseCase,
    deleteRecordUseCase
  } = useApplicationContext();

  const [state, setState] = useState<RecordsSyncState>({
    records: [],
    isLoading: true, // Start with loading true since we load on mount
    error: null,
  });

  // Helper function to deduplicate records by tag set
  const deduplicateRecordsByTagSet = useCallback((records: Record[]): Record[] => {
    const uniqueRecords: Record[] = [];
    const seenTagSets = new Set<string>();

    for (const record of records) {
      const tagSetKey = [...record.tags]
        .map(tag => tag.toLowerCase())
        .sort()
        .join(',');

      if (!seenTagSets.has(tagSetKey)) {
        seenTagSets.add(tagSetKey);
        uniqueRecords.push(record);
      }
    }

    return uniqueRecords;
  }, []);

  // Load records function
  const loadRecords = useCallback(async (): Promise<void> => {
    if (!searchRecordsUseCase) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await searchRecordsUseCase.execute({
        query: '',
        options: {
          limit: 50,
          offset: 0,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        },
      });

      if (result.isOk()) {
        const response = result.unwrap();
        const mappedRecords = response.searchResult.records.map(recordDTO => ({
          id: recordDTO.id,
          tags: recordDTO.content.trim().split(/\s+/).filter(Boolean),
          createdAt: new Date(recordDTO.createdAt),
          updatedAt: new Date(recordDTO.updatedAt),
        }));
        const deduplicatedRecords = deduplicateRecordsByTagSet(mappedRecords);

        setState(prev => ({
          ...prev,
          records: deduplicatedRecords,
          isLoading: false,
          error: null,
        }));
      } else {
        const error = result.unwrapErr();
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: new Error(error.message),
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      }));
    }
  }, [searchRecordsUseCase, deduplicateRecordsByTagSet]);

  // Load initial records on mount
  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // Listen to sync events from other components
  useEffect(() => {
    const unsubscribe = recordsSyncEmitter.subscribe(() => {
      loadRecords();
    });

    return unsubscribe;
  }, [loadRecords]);

  const createRecord = useCallback(async (tags: string[]): Promise<boolean> => {
    if (!createRecordUseCase || tags.length === 0) return false;

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimisticRecord: Record = {
      id: tempId,
      tags,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setState(prev => ({
      ...prev,
      records: deduplicateRecordsByTagSet([...prev.records, optimisticRecord]),
      error: null,
    }));

    try {
      const content = tags.join(' ');
      const result = await createRecordUseCase.execute({ content });

      if (result.isOk()) {
        // Replace optimistic record with actual record and refresh all instances
        await loadRecords();
        recordsSyncEmitter.emit(); // Notify other components
        return true;
      } else {
        const error = result.unwrapErr();

        // Rollback optimistic update
        setState(prev => ({
          ...prev,
          records: prev.records.filter(r => r.id !== tempId),
          error: new Error(error.message),
        }));

        return false;
      }
    } catch (error) {
      // Rollback optimistic update
      setState(prev => ({
        ...prev,
        records: prev.records.filter(r => r.id !== tempId),
        error: error instanceof Error ? error : new Error('Unknown error'),
      }));

      return false;
    }
  }, [createRecordUseCase, deduplicateRecordsByTagSet, loadRecords]);

  const updateRecord = useCallback(async (id: string, tags: string[]): Promise<boolean> => {
    if (!updateRecordUseCase) return false;

    // Store original record for rollback
    const originalRecord = state.records.find(r => r.id === id);
    if (!originalRecord) return false;

    // Optimistic update
    const optimisticRecord: Record = {
      ...originalRecord,
      tags,
      updatedAt: new Date(),
    };

    setState(prev => ({
      ...prev,
      records: prev.records.map(r => r.id === id ? optimisticRecord : r),
      error: null,
    }));

    try {
      const content = tags.join(' ');
      const result = await updateRecordUseCase.execute({ id, content });

      if (result.isOk()) {
        // Refresh all instances
        await loadRecords();
        recordsSyncEmitter.emit(); // Notify other components
        return true;
      } else {
        const error = result.unwrapErr();

        // Rollback optimistic update
        setState(prev => ({
          ...prev,
          records: prev.records.map(r => r.id === id ? originalRecord : r),
          error: new Error(error.message),
        }));

        return false;
      }
    } catch (error) {
      // Rollback optimistic update
      setState(prev => ({
        ...prev,
        records: prev.records.map(r => r.id === id ? originalRecord : r),
        error: error instanceof Error ? error : new Error('Unknown error'),
      }));

      return false;
    }
  }, [updateRecordUseCase, state.records, loadRecords]);

  const deleteRecord = useCallback(async (id: string): Promise<boolean> => {
    if (!deleteRecordUseCase) return false;

    // Store original record for rollback
    const originalRecord = state.records.find(r => r.id === id);
    if (!originalRecord) return false;

    // Optimistic delete
    setState(prev => ({
      ...prev,
      records: prev.records.filter(r => r.id !== id),
      error: null,
    }));

    try {
      const result = await deleteRecordUseCase.execute({ id });

      if (result.isOk()) {
        // Refresh all instances
        await loadRecords();
        recordsSyncEmitter.emit(); // Notify other components
        return true;
      } else {
        const error = result.unwrapErr();

        // Rollback optimistic delete
        setState(prev => ({
          ...prev,
          records: deduplicateRecordsByTagSet([...prev.records, originalRecord]),
          error: new Error(error.message),
        }));

        return false;
      }
    } catch (error) {
      // Rollback optimistic delete
      setState(prev => ({
        ...prev,
        records: deduplicateRecordsByTagSet([...prev.records, originalRecord]),
        error: error instanceof Error ? error : new Error('Unknown error'),
      }));

      return false;
    }
  }, [deleteRecordUseCase, state.records, deduplicateRecordsByTagSet, loadRecords]);

  const refresh = useCallback(async (): Promise<void> => {
    await loadRecords();
  }, [loadRecords]);

  const contextValue = useMemo<RecordsSyncContextValue>(() => ({
    ...state,
    createRecord,
    updateRecord,
    deleteRecord,
    refresh,
  }), [state, createRecord, updateRecord, deleteRecord, refresh]);

  return (
    <RecordsSyncContext.Provider value={contextValue}>
      {children}
    </RecordsSyncContext.Provider>
  );
};

export const useRecordsSync = (): RecordsSyncContextValue => {
  const context = useContext(RecordsSyncContext);

  if (context === null) {
    throw new Error('useRecordsSync must be used within RecordsSyncProvider');
  }

  return context;
};