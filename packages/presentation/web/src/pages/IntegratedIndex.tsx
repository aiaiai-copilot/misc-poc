import { useState, useEffect, useRef } from 'react';
import { useRecordsIntegrated } from '../hooks/useRecordsIntegrated';
import { MiscInput } from '../components/MiscInput';
import { RecordsList, type RecordsListRef } from '../components/RecordsList';
import { TagCloud, type TagCloudRef } from '../components/TagCloud';
import { Record } from '../types/Record';
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
    isLoading,
  } = useRecordsIntegrated();

  const [inputValue, setInputValue] = useState('');
  const [editingRecord, setEditingRecord] = useState<Record | null>(null);
  
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

  // Determine display mode based on search state
  const showTagCloud = !inputValue.trim() || filteredRecords.length > 12;
  const showRecordsList = inputValue.trim() && filteredRecords.length > 0 && filteredRecords.length <= 12;
  const showCreateState = inputValue.trim() && filteredRecords.length === 0;
  const showEmptyState = !inputValue.trim() && filteredRecords.length === 0;

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
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">Records Manager</h1>
          <p className="text-muted-foreground">
            Integrated CRUD operations with UpdateRecord and DeleteRecord use cases
          </p>
          {isLoading && (
            <p className="text-sm text-blue-600 mt-2">Loading...</p>
          )}
        </div>

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
              tagFrequencies={tagFrequencies}
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

        {showCreateState && (
          <div className="results-area">
            <div className="text-center py-16">
              <div className="text-lg text-muted-foreground">No records found</div>
              <div className="text-sm mt-2 text-muted-foreground/70">Press Enter to create a new record</div>
            </div>
          </div>
        )}

        {showEmptyState && !isLoading && (
          <div className="text-center py-16">
            <div className="text-lg text-muted-foreground">No records yet</div>
            <div className="text-sm mt-2 text-muted-foreground/70">Start by typing some tags above</div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-muted p-4 rounded-lg max-w-4xl mx-auto">
          <h3 className="font-semibold mb-2">Instructions:</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• <strong>Create:</strong> Type tags and press Enter to create a new record</li>
            <li>• <strong>Search:</strong> Type tags to search and filter records</li>
            <li>• <strong>Update:</strong> Click on a record to edit it, then press Enter to save</li>
            <li>• <strong>Delete:</strong> Click the X button or use Delete/Backspace keys</li>
            <li>• <strong>Navigate:</strong> Use arrow keys to navigate between elements</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default IntegratedIndex;