import { useState, useEffect, useRef } from 'react';
import { useRecordsIntegrated } from '../hooks/useRecordsIntegrated';
import { useApplicationContext } from '../contexts/ApplicationContext';
import { MiscInput } from '../components/MiscInput';
import { MinimalisticToolbar } from '../components/MinimalisticToolbar';
import { RecordsList, type RecordsListRef } from '../components/RecordsList';
import { TagCloud, type TagCloudRef } from '../components/TagCloud';
import { Record } from '../types/Record';
import { DisplayMode } from '@misc-poc/application';
import { TagCloudItemDTO } from '@misc-poc/application';
import { toast } from 'sonner';

const IntegratedIndex = (): JSX.Element => {
  const {
    filteredRecords,
    tagFrequencies,
    allTags,
    setSearchQuery,
    createRecord,
    updateRecord,
    deleteRecord,
    refreshRecords,
  } = useRecordsIntegrated();

  const { searchModeDetector, tagCloudBuilder } = useApplicationContext();

  const [inputValue, setInputValue] = useState('');
  const [editingRecord, setEditingRecord] = useState<Record | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>(
    DisplayMode.CLOUD
  );
  const [tagCloudItems, setTagCloudItems] = useState<TagCloudItemDTO[]>([]);

  // Refs for navigation
  const inputRef = useRef<HTMLInputElement>(null);
  const tagCloudRef = useRef<TagCloudRef>(null);
  const recordsListRef = useRef<RecordsListRef>(null);

  // Debounced search and mode detection
  useEffect(() => {
    const timer = setTimeout((): void => {
      setSearchQuery(inputValue);
      // Only perform search if there's a search query
      // When input is empty, rely on the existing filtered records
      // This prevents overwriting local state after record creation
    }, 300);

    return (): void => clearTimeout(timer);
  }, [inputValue, setSearchQuery]);

  // Update display mode and tag cloud items when search results change
  useEffect(() => {
    const updateDisplayMode = async (): Promise<void> => {
      if (!searchModeDetector || !tagCloudBuilder) return;

      // Create SearchResultDTO from current filtered records
      const searchResult = {
        records: filteredRecords.map((record) => ({
          id: record.id,
          tagIds: record.tags, // simplified - normally these would be tag IDs
          content: record.tags.join(' '),
          createdAt: record.createdAt.toISOString(),
          updatedAt: record.updatedAt.toISOString(),
        })),
        total: filteredRecords.length,
        hasMore: false, // Since we're showing all filtered records, there are no more
      };

      // Detect display mode
      const detectedMode = searchModeDetector.detectMode(searchResult);
      setDisplayMode(detectedMode);

      // Build tag cloud if in cloud mode
      if (detectedMode === DisplayMode.CLOUD) {
        try {
          const cloudItems =
            await tagCloudBuilder.buildFromSearchResult(searchResult);
          setTagCloudItems(cloudItems);
        } catch (error) {
          console.error('Failed to build tag cloud:', error);
          setTagCloudItems([]);
        }
      }
    };

    updateDisplayMode();
  }, [filteredRecords, searchModeDetector, tagCloudBuilder]);

  // Determine what to show
  const showTagCloud = displayMode === DisplayMode.CLOUD;
  const showRecordsList =
    displayMode === DisplayMode.LIST && filteredRecords.length > 0;
  const hasSearch = inputValue.trim().length > 0;
  const showNoResults =
    hasSearch &&
    filteredRecords.length === 0 &&
    displayMode === DisplayMode.LIST;

  const handleSubmit = async (tags: string[]): Promise<void> => {
    try {
      if (editingRecord) {
        // Update existing record
        const success = await updateRecord(editingRecord.id, tags);
        if (success) {
          setEditingRecord(null);
          setInputValue('');
          toast.success(`Record updated: ${tags.join(' ')}`);
        }
      } else {
        // Create new record
        const success = await createRecord(tags);
        if (success) {
          setInputValue('');
          toast.success(`Record created: ${tags.join(' ')}`);
        } else {
          toast.error('Record already exists with this combination of tags');
        }
      }
    } catch {
      toast.error(
        editingRecord ? 'Failed to update record' : 'Failed to create record'
      );
    }
    // Focus back to input after submit
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleEdit = (record: Record): void => {
    setEditingRecord(record);
    setInputValue(record.tags.join(' '));
    // Focus input after setting edit mode
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleEscape = (): void => {
    setEditingRecord(null);
    setInputValue('');
    setSearchQuery('');
    // Focus input after escape/clear
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleTagClick = (tag: string): void => {
    const newValue = inputValue.trim() ? `${inputValue} ${tag}` : tag;
    setInputValue(newValue);
    // Focus back to input after tag click
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleNavigateToResults = (): void => {
    if (showTagCloud) {
      tagCloudRef.current?.focusFirst();
    } else if (showRecordsList) {
      recordsListRef.current?.focusFirst();
    }
  };

  const handleNavigateToInput = (): void => {
    inputRef.current?.focus();
  };

  const handleDelete = async (id: string): Promise<void> => {
    try {
      const success = await deleteRecord(id);
      if (success) {
        toast.success('Record deleted');
        // Focus input after delete
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    } catch {
      toast.error('Failed to delete record');
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      {/* Input Field */}
      <MiscInput
        ref={inputRef}
        value={inputValue}
        onChange={setInputValue}
        onSubmit={handleSubmit}
        onEscape={handleEscape}
        onNavigateDown={handleNavigateToResults}
        allTags={allTags}
        placeholder={
          editingRecord ? 'Edit tags...' : 'Enter tags separated by spaces...'
        }
        className="w-full max-w-4xl mx-auto mb-4"
        toolbar={<MinimalisticToolbar onImportSuccess={refreshRecords} />}
      />
      {editingRecord && (
        <div className="w-full max-w-4xl mx-auto mb-4 mt-2 text-sm text-muted-foreground">
          Editing record: {editingRecord.tags.join(' ')}
          <button
            onClick={handleEscape}
            className="ml-2 text-blue-600 hover:underline"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Display based on state */}
      {showTagCloud && (
        <TagCloud
          ref={tagCloudRef}
          tagCloudItems={tagCloudItems.length > 0 ? tagCloudItems : undefined}
          tagFrequencies={
            tagCloudItems.length === 0 ? tagFrequencies : undefined
          }
          onTagClick={handleTagClick}
          onNavigateUp={handleNavigateToInput}
        />
      )}

      {showRecordsList && (
        <RecordsList
          ref={recordsListRef}
          records={filteredRecords}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onNavigateUp={handleNavigateToInput}
          searchQuery={inputValue}
        />
      )}

      {showNoResults && (
        <div
          className="w-full max-w-4xl mx-auto border-8 border-l-16 rounded-md bg-background shadow-inner overflow-hidden"
          style={{ borderColor: '#A9A9A9' }}
          data-testid="no-results"
        >
          <div className="text-center py-16">
            <p className="text-muted-foreground">
              No records found for "{inputValue.trim()}"
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Press Enter to create a new record with these tags.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntegratedIndex;
