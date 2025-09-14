import { useState, useEffect, useMemo, useCallback } from 'react';
import { useApplicationContext } from '../contexts/ApplicationContext';
import { Record } from '../types/Record';

interface UseRecordsIntegratedReturn {
  records: Record[];
  filteredRecords: Record[];
  tagFrequencies: { tag: string; count: number }[];
  allTags: string[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  createRecord: (tags: string[]) => Promise<boolean>;
  updateRecord: (id: string, tags: string[]) => Promise<boolean>;
  deleteRecord: (id: string) => Promise<boolean>;
  performSearch: (query: string) => Promise<void>;
  refreshRecords: () => Promise<void>;
  isLoading: boolean;
}

// Helper function to deduplicate records by tag set (mathematical set uniqueness)
const deduplicateRecordsByTagSet = (records: Record[]): Record[] => {
  const uniqueRecords: Record[] = [];
  const seenTagSets = new Set<string>();

  for (const record of records) {
    // Create a normalized string representation of the tag set for comparison
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
};

export const useRecordsIntegrated = (): UseRecordsIntegratedReturn => {
  const { searchRecordsUseCase, createRecordUseCase, updateRecordUseCase, deleteRecordUseCase } = useApplicationContext();
  const [records, setRecords] = useState<Record[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Extract record loading logic into a reusable function
  const loadRecords = useCallback(async (): Promise<void> => {
    if (!searchRecordsUseCase) return;

    setIsLoading(true);
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
        setRecords(deduplicatedRecords);
      }
    } catch (error) {
      console.error('Failed to load records:', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchRecordsUseCase]);

  // Load initial records on mount
  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // Filter records based on search query, sorted by most recent first
  const filteredRecords = useMemo(() => {
    const sorted = [...records].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    
    if (!searchQuery.trim()) return sorted;
    
    const searchTags = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
    return sorted.filter(record => {
      const recordTags = record.tags.map(tag => tag.toLowerCase());
      
      // All complete tags (all but the last) must be exact matches
      const completeTags = searchTags.slice(0, -1);
      const incompleteTag = searchTags[searchTags.length - 1];
      
      // Check complete tags first
      const completeTagsMatch = completeTags.every(searchTag =>
        recordTags.includes(searchTag)
      );
      
      if (!completeTagsMatch) return false;
      
      // Check incomplete tag with prefix matching
      const incompleteTagMatch = recordTags.some(recordTag =>
        recordTag.startsWith(incompleteTag)
      );
      
      return incompleteTagMatch;
    });
  }, [records, searchQuery]);

  // Get tag frequencies for tag cloud (based on all records, not filtered)
  const tagFrequencies = useMemo(() => {
    const frequencies = new Map<string, number>();
    
    records.forEach(record => {
      record.tags.forEach(tag => {
        frequencies.set(tag, (frequencies.get(tag) || 0) + 1);
      });
    });

    return Array.from(frequencies.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }, [records]);

  // Get all unique tags for autocomplete
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    records.forEach(record => {
      record.tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [records]);

  const createRecord = useCallback(async (tags: string[]) => {
    if (tags.length === 0) return false;
    
    if (!createRecordUseCase) {
      console.error('createRecordUseCase is not initialized');
      return false;
    }
    
    try {
      const content = tags.join(' ');
      const result = await createRecordUseCase.execute({ content });

      if (result.isOk()) {
        const response = result.unwrap();
        const newRecord: Record = {
          id: response.record.id,
          tags: response.record.content.trim().split(/\s+/).filter(Boolean),
          createdAt: new Date(response.record.createdAt),
          updatedAt: new Date(response.record.updatedAt),
        };
        setRecords(prev => deduplicateRecordsByTagSet([...prev, newRecord]));
        return true;
      } else {
        const error = result.unwrapErr();
        if (error.code === 'DUPLICATE_RECORD') {
          return false; // Duplicate
        }
        throw new Error(error.message);
      }
    } catch (error) {
      console.error('Failed to create record:', error);
      return false; // Don't re-throw, just return false
    }
  }, [createRecordUseCase]);

  const updateRecord = useCallback(async (id: string, tags: string[]) => {
    if (!updateRecordUseCase) return false;

    try {
      const content = tags.join(' ');
      const result = await updateRecordUseCase.execute({ id, content });

      if (result.isOk()) {
        const response = result.unwrap();
        const updatedRecord: Record = {
          id: response.record.id,
          tags: response.record.content.trim().split(/\s+/).filter(Boolean),
          createdAt: new Date(response.record.createdAt),
          updatedAt: new Date(response.record.updatedAt),
        };
        
        setRecords(prev =>
          prev.map(record =>
            record.id === updatedRecord.id ? updatedRecord : record
          )
        );
        return true;
      } else {
        const error = result.unwrapErr();
        throw new Error(error.message);
      }
    } catch (error) {
      console.error('Failed to update record:', error);
      throw error;
    }
  }, [updateRecordUseCase]);

  const deleteRecord = useCallback(async (id: string) => {
    if (!deleteRecordUseCase) return false;

    try {
      console.log('Attempting to delete record with ID:', id);
      console.log('Current records:', records.map(r => ({ id: r.id, tags: r.tags })));
      
      const result = await deleteRecordUseCase.execute({ id });

      if (result.isOk()) {
        setRecords(prev => prev.filter(record => record.id !== id));
        return true;
      } else {
        const error = result.unwrapErr();
        console.error('Delete failed with error:', error);
        
        // If record not found, it might be already deleted - sync UI state
        if (error.code === 'RECORD_NOT_FOUND') {
          console.log('Record not found in storage, removing from UI state');
          setRecords(prev => prev.filter(record => record.id !== id));
          return true; // Treat as success since the record is gone
        }
        
        throw new Error(error.message);
      }
    } catch (error) {
      console.error('Failed to delete record:', error);
      return false; // Return false instead of throwing to prevent UI crashes
    }
  }, [deleteRecordUseCase, records]);

  const performSearch = useCallback(async (query: string) => {
    if (!searchRecordsUseCase) return;

    setIsLoading(true);
    try {
      const result = await searchRecordsUseCase.execute({
        query,
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
        setRecords(deduplicatedRecords);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchRecordsUseCase]);

  return {
    records,
    filteredRecords,
    tagFrequencies,
    allTags,
    searchQuery,
    setSearchQuery,
    createRecord,
    updateRecord,
    deleteRecord,
    performSearch,
    refreshRecords: loadRecords,
    isLoading,
  };
};