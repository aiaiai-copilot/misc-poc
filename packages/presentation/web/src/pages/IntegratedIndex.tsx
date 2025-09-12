import { useState, useEffect, useRef } from 'react';
import { useRecordsIntegrated } from '../hooks/useRecordsIntegrated';
import { useApplicationContext } from '../contexts/ApplicationContext';
import { MiscInput } from '../components/MiscInput';
import { RecordsList, type RecordsListRef } from '../components/RecordsList';
import { TagCloud, type TagCloudRef } from '../components/TagCloud';
import { Record } from '../types/Record';
import { SearchModeDetector, DisplayMode } from '../../../../application/src/services/search-mode-detector';
import { TagCloudBuilder } from '../../../../application/src/services/tag-cloud-builder';
import { TagCloudItemDTO } from '../../../../application/src/dtos/tag-cloud-item-dto';
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
    performSearch,
  } = useRecordsIntegrated();

  const { tagRepository, searchRecordsUseCase } = useApplicationContext();

  const [inputValue, setInputValue] = useState('');
  const [editingRecord, setEditingRecord] = useState<Record | null>(null);
  const [tagCloudItems, setTagCloudItems] = useState<TagCloudItemDTO[]>([]);
  const [displayMode, setDisplayMode] = useState<DisplayMode>(DisplayMode.LIST);

  // Initialize SearchModeDetector and TagCloudBuilder
  const searchModeDetector = useRef(new SearchModeDetector()).current;
  const tagCloudBuilder = useRef(
    tagRepository ? new TagCloudBuilder(tagRepository) : null
  ).current;
  
  // Refs for navigation
  const inputRef = useRef<HTMLInputElement>(null);
  const tagCloudRef = useRef<TagCloudRef>(null);
  const recordsListRef = useRef<RecordsListRef>(null);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout((): void => {
      setSearchQuery(inputValue);
    }, 300);

    return (): void => clearTimeout(timer);
  }, [inputValue, setSearchQuery]);

  // Update display mode and TagCloud items based on search results
  useEffect(() => {
    const updateDisplayMode = async (): Promise<void> => {
      if (!searchRecordsUseCase || !tagCloudBuilder) return;

      try {
        // Execute search to get current results
        const searchResult = await searchRecordsUseCase.execute({
          query: inputValue.trim(),
          options: {
            limit: 50,
            offset: 0,
            sortBy: 'createdAt',
            sortOrder: 'desc',
          },
        });

        if (searchResult.isOk()) {
          const response = searchResult.unwrap();
          
          // Determine display mode based on result count
          const mode = searchModeDetector.detectMode(response.searchResult);
          setDisplayMode(mode);
          
          // If CLOUD mode, build TagCloud items
          if (mode === DisplayMode.CLOUD) {
            const items = await tagCloudBuilder.buildFromSearchResult(response.searchResult);
            setTagCloudItems(items);
          } else {
            setTagCloudItems([]);
          }
        }
      } catch (error) {
        console.error('Failed to update display mode:', error);
        // Fallback to legacy mode detection
        setDisplayMode(filteredRecords.length > 12 ? DisplayMode.CLOUD : DisplayMode.LIST);
      }
    };

    updateDisplayMode();
  }, [inputValue, filteredRecords.length, searchRecordsUseCase, tagCloudBuilder, searchModeDetector]);

  // Determine display based on SearchModeDetector integration
  const showTagCloud = displayMode === DisplayMode.CLOUD;
  const showRecordsList = displayMode === DisplayMode.LIST && filteredRecords.length > 0;

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
      toast.error(editingRecord ? 'Failed to update record' : 'Failed to create record');
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Input Field */}
        <div className="mb-4 w-full max-w-6xl mx-auto">
          <MiscInput
            ref={inputRef}
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
            onEscape={handleEscape}
            onNavigateDown={handleNavigateToResults}
            allTags={allTags}
            placeholder={editingRecord ? "Edit tags..." : "Enter tags separated by spaces..."}
            className="w-full"
          />
          {editingRecord && (
            <div className="mt-2 text-sm text-muted-foreground">
              Editing record: {editingRecord.tags.join(' ')}
              <button 
                onClick={handleEscape}
                className="ml-2 text-blue-600 hover:underline"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Display based on state */}
        {showTagCloud && (
          <div className="results-area">
            <TagCloud
              ref={tagCloudRef}
              {...(tagCloudItems.length > 0 
                ? { tagCloudItems } 
                : { tagFrequencies }
              )}
              onTagClick={handleTagClick}
              onNavigateUp={handleNavigateToInput}
            />
          </div>
        )}

        {showRecordsList && (
          <div className="results-area">
            <RecordsList
              ref={recordsListRef}
              records={filteredRecords}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onNavigateUp={handleNavigateToInput}
              searchQuery={inputValue}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default IntegratedIndex;