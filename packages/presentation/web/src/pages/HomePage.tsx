import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { SearchInput, RecordList, TagCloud } from '../components';
import { ImportExport } from '../components/ImportExport';
import { RecordDTO, TagCloudItemDTO } from '@misc-poc/application';
import styles from './HomePage.module.css';

interface AppState {
  records: RecordDTO[];
  selectedRecordIds: string[];
  searchQuery: string;
  selectedTagIds: string[];
  tags: TagCloudItemDTO[];
  isLoading: boolean;
  error: string | null;
  searchMode: 'query' | 'tag' | 'mixed';
  showImportExport: boolean;
}

export const HomePage: React.FC = () => {
  const [state, setState] = useState<AppState>({
    records: [],
    selectedRecordIds: [],
    searchQuery: '',
    selectedTagIds: [],
    tags: [],
    isLoading: false,
    error: null,
    searchMode: 'query',
    showImportExport: false,
  });

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Mock data for demonstration
  const mockRecords: RecordDTO[] = useMemo(() => [
    {
      id: '1',
      content: 'Sample record for testing search functionality',
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      tags: [
        { id: 'tag1', displayValue: 'testing', color: '#3b82f6' },
        { id: 'tag2', displayValue: 'sample', color: '#10b981' },
      ],
    },
    {
      id: '2',
      content: 'Another record with different tags for filtering',
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      tags: [
        { id: 'tag3', displayValue: 'filtering', color: '#f59e0b' },
        { id: 'tag4', displayValue: 'demo', color: '#ef4444' },
      ],
    },
    {
      id: '3',
      content: 'Integration test record with mixed content and multiple tags',
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      tags: [
        { id: 'tag1', displayValue: 'testing', color: '#3b82f6' },
        { id: 'tag4', displayValue: 'demo', color: '#ef4444' },
        { id: 'tag5', displayValue: 'integration', color: '#8b5cf6' },
      ],
    },
  ], []);

  const mockTags: TagCloudItemDTO[] = useMemo(() => [
    { id: 'tag1', displayValue: 'testing', usageCount: 2, weight: 0.8, fontSize: 'large', color: '#3b82f6' },
    { id: 'tag2', displayValue: 'sample', usageCount: 1, weight: 0.4, fontSize: 'medium', color: '#10b981' },
    { id: 'tag3', displayValue: 'filtering', usageCount: 1, weight: 0.4, fontSize: 'medium', color: '#f59e0b' },
    { id: 'tag4', displayValue: 'demo', usageCount: 2, weight: 0.8, fontSize: 'large', color: '#ef4444' },
    { id: 'tag5', displayValue: 'integration', usageCount: 1, weight: 0.4, fontSize: 'medium', color: '#8b5cf6' },
  ], []);

  // Initialize with mock data
  useEffect(() => {
    setState(prev => ({
      ...prev,
      records: mockRecords,
      tags: mockTags,
    }));
  }, [mockRecords, mockTags]);

  // Filter records based on search query and selected tags
  const filteredRecords = useMemo(() => {
    let filtered = state.records;

    // Filter by search query
    if (state.searchQuery.trim()) {
      const query = state.searchQuery.toLowerCase();
      filtered = filtered.filter(record =>
        record.content.toLowerCase().includes(query) ||
        record.tags.some(tag => tag.displayValue.toLowerCase().includes(query))
      );
    }

    // Filter by selected tags
    if (state.selectedTagIds.length > 0) {
      filtered = filtered.filter(record =>
        record.tags.some(tag => state.selectedTagIds.includes(tag.id))
      );
    }

    return filtered;
  }, [state.records, state.searchQuery, state.selectedTagIds]);

  // Determine search mode based on current filters
  const currentSearchMode = useMemo(() => {
    if (state.searchQuery.trim() && state.selectedTagIds.length > 0) return 'mixed';
    if (state.selectedTagIds.length > 0) return 'tag';
    return 'query';
  }, [state.searchQuery, state.selectedTagIds]);

  // Update search mode when filters change
  useEffect(() => {
    setState(prev => ({ ...prev, searchMode: currentSearchMode }));
  }, [currentSearchMode]);

  // Search handlers
  const handleSearch = useCallback((query: string) => {
    setState(prev => ({ ...prev, searchQuery: query }));
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setState(prev => ({ ...prev, searchQuery: query }));
  }, []);

  const handleClearSearch = useCallback(() => {
    setState(prev => ({ ...prev, searchQuery: '', selectedTagIds: [] }));
  }, []);

  // Tag handlers
  const handleTagClick = useCallback((tag: TagCloudItemDTO) => {
    setState(prev => {
      const isSelected = prev.selectedTagIds.includes(tag.id);
      const newSelectedTagIds = isSelected
        ? prev.selectedTagIds.filter(id => id !== tag.id)
        : [...prev.selectedTagIds, tag.id];
      
      return { ...prev, selectedTagIds: newSelectedTagIds };
    });
  }, []);

  const handleRecordTagClick = useCallback((tagId: string) => {
    setState(prev => {
      const isSelected = prev.selectedTagIds.includes(tagId);
      const newSelectedTagIds = isSelected
        ? prev.selectedTagIds.filter(id => id !== tagId)
        : [...prev.selectedTagIds, tagId];
      
      return { ...prev, selectedTagIds: newSelectedTagIds };
    });
  }, []);

  // Record handlers
  const handleRecordSelectionChange = useCallback((selectedIds: string[]) => {
    setState(prev => ({ ...prev, selectedRecordIds: selectedIds }));
  }, []);

  const handleRecordEdit = useCallback((record: RecordDTO) => {
    // Mock edit functionality
    console.log('Edit record:', record.id);
  }, []);

  const handleRecordDelete = useCallback((record: RecordDTO) => {
    setState(prev => ({
      ...prev,
      records: prev.records.filter(r => r.id !== record.id),
      selectedRecordIds: prev.selectedRecordIds.filter(id => id !== record.id),
    }));
  }, []);

  // Import/Export handlers
  const handleImport = useCallback(async (_file: File) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Mock import functionality
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const result = {
        success: true,
        totalProcessed: 1,
        successCount: 1,
        errorCount: 0,
        importedAt: new Date().toISOString(),
        duration: 1000,
        summary: {
          recordsCreated: 1,
          recordsUpdated: 0,
          recordsSkipped: 0,
          recordsFailed: 0,
        },
      };
      
      setState(prev => ({ ...prev, isLoading: false }));
      return result;
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false, error: 'Import failed' }));
      throw error;
    }
  }, []);

  const handleExport = useCallback(async (format: 'json' | 'csv' | 'xml' | 'yaml') => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      // Mock export functionality
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const result = {
        records: filteredRecords,
        format,
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
        metadata: {
          totalRecords: filteredRecords.length,
          exportSource: 'webapp',
        },
      };
      
      setState(prev => ({ ...prev, isLoading: false }));
      return result;
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false, error: 'Export failed' }));
      throw error;
    }
  }, [filteredRecords]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      // Focus search on Ctrl/Cmd + K
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      
      // Toggle import/export on Ctrl/Cmd + Shift + I
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'I') {
        event.preventDefault();
        setState(prev => ({ ...prev, showImportExport: !prev.showImportExport }));
      }
      
      // Clear filters on Escape
      if (event.key === 'Escape') {
        handleClearSearch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return (): void => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClearSearch]);

  return (
    <div className={styles.homePage}>
      <div className={styles.header}>
        <h1>Record Management System</h1>
        <div className={styles.searchMode}>
          Search Mode: <span className={styles.mode}>{state.searchMode}</span>
          {(state.searchQuery || state.selectedTagIds.length > 0) && (
            <button onClick={handleClearSearch} className={styles.clearButton}>
              Clear Filters
            </button>
          )}
        </div>
      </div>

      <div className={styles.toolbar}>
        <button
          onClick={() => setState(prev => ({ ...prev, showImportExport: !prev.showImportExport }))}
          className={styles.toolbarButton}
        >
          {state.showImportExport ? 'Hide' : 'Show'} Import/Export
        </button>
      </div>

      <div className={styles.mainContent}>
        <div className={styles.leftPanel}>
          <div className={styles.searchSection}>
            <SearchInput
              ref={searchInputRef}
              value={state.searchQuery}
              placeholder="Search records... (Ctrl+K to focus)"
              onChange={handleSearchChange}
              onSearch={handleSearch}
              onClear={handleClearSearch}
              isLoading={state.isLoading}
              hasError={!!state.error}
              errorMessage={state.error || undefined}
              suggestions={state.tags.map(tag => tag.displayValue)}
              autoComplete={true}
            />
          </div>

          <div className={styles.tagSection}>
            <h3>Filter by Tags</h3>
            <TagCloud
              tags={state.tags}
              onTagClick={handleTagClick}
              selectedTagIds={state.selectedTagIds}
              showUsageCount={true}
              spacing="medium"
            />
          </div>

          {state.showImportExport && (
            <div className={styles.importExportSection}>
              <h3>Import/Export</h3>
              <ImportExport
                onImport={handleImport}
                onExport={handleExport}
                hasExistingData={state.records.length > 0}
                progress={state.isLoading ? 50 : undefined}
              />
            </div>
          )}
        </div>

        <div className={styles.rightPanel}>
          <div className={styles.resultsHeader}>
            <h3>
              Records ({filteredRecords.length})
              {state.selectedRecordIds.length > 0 && (
                <span className={styles.selectionInfo}>
                  - {state.selectedRecordIds.length} selected
                </span>
              )}
            </h3>
          </div>

          <RecordList
            records={filteredRecords}
            selectionMode="multiple"
            selectedRecordIds={state.selectedRecordIds}
            onSelectionChange={handleRecordSelectionChange}
            onEdit={handleRecordEdit}
            onDelete={handleRecordDelete}
            onTagClick={handleRecordTagClick}
            enableVirtualization={filteredRecords.length > 50}
            showBulkActions={state.selectedRecordIds.length > 0}
            className={styles.recordList}
          />
        </div>
      </div>

      <div className={styles.shortcuts}>
        <small>
          Shortcuts: Ctrl+K (Focus search), Ctrl+Shift+I (Toggle import/export), Esc (Clear filters)
        </small>
      </div>
    </div>
  );
};