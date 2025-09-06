import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  KeyboardEvent,
  MouseEvent,
} from 'react';
import { RecordDTO } from '@misc-poc/application';
import { RecordItem } from './RecordItem';

export interface RecordListProps {
  records: RecordDTO[];
  className?: string;
  selectionMode?: 'single' | 'multiple' | 'none';
  selectedRecordIds?: string[];
  enableVirtualization?: boolean;
  itemHeight?: number;
  containerHeight?: number;
  showBulkActions?: boolean;
  onSelectionChange?: (selectedIds: string[]) => void;
  onEdit?: (record: RecordDTO) => void;
  onDelete?: (record: RecordDTO) => void;
  onTagClick?: (tagId: string) => void;
}

interface VirtualItem {
  index: number;
  top: number;
  height: number;
}

export const RecordList: React.FC<RecordListProps> = ({
  records,
  className = '',
  selectionMode = 'none',
  selectedRecordIds = [],
  enableVirtualization = false,
  itemHeight = 120,
  containerHeight = 400,
  showBulkActions = false,
  onSelectionChange,
  onEdit,
  onDelete,
  onTagClick,
}) => {
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [isResponsive, setIsResponsive] = useState<'mobile' | 'desktop'>('desktop');
  const listRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Determine if virtualization should be enabled
  const shouldVirtualize = enableVirtualization && records.length > 50;

  // Handle responsive design
  useEffect((): (() => void) => {
    const handleResize = (): void => {
      setIsResponsive(window.innerWidth < 768 ? 'mobile' : 'desktop');
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Virtual scrolling state
  const [scrollTop, setScrollTop] = useState(0);
  
  const virtualItems = useMemo((): VirtualItem[] => {
    if (!shouldVirtualize) return [];
    
    const visibleStart = Math.floor(scrollTop / itemHeight);
    const visibleEnd = Math.min(
      visibleStart + Math.ceil(containerHeight / itemHeight) + 2,
      records.length
    );
    
    return Array.from({ length: visibleEnd - visibleStart }, (_, index) => {
      const actualIndex = visibleStart + index;
      return {
        index: actualIndex,
        top: actualIndex * itemHeight,
        height: itemHeight,
      };
    });
  }, [scrollTop, itemHeight, containerHeight, records.length, shouldVirtualize]);

  const totalHeight = shouldVirtualize ? records.length * itemHeight : 'auto';

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (shouldVirtualize) {
      setScrollTop(event.currentTarget.scrollTop);
    }
  }, [shouldVirtualize]);

  const handleRecordSelect = useCallback((record: RecordDTO, event?: MouseEvent) => {
    if (selectionMode === 'none' || !onSelectionChange) return;

    const recordId = record.id;
    let newSelection: string[];


    if (selectionMode === 'single') {
      newSelection = selectedRecordIds.includes(recordId) ? [] : [recordId];
    } else {
      // Multiple selection
      if (event?.ctrlKey || event?.metaKey) {
        newSelection = selectedRecordIds.includes(recordId)
          ? selectedRecordIds.filter(id => id !== recordId)
          : [...selectedRecordIds, recordId];
      } else if (event?.shiftKey) {
        // For shift selection, just add this record for now
        newSelection = selectedRecordIds.includes(recordId)
          ? selectedRecordIds.filter(id => id !== recordId)
          : [...selectedRecordIds, recordId];
      } else {
        newSelection = [recordId];
      }
    }

    onSelectionChange(newSelection);
  }, [selectionMode, selectedRecordIds, onSelectionChange]);

  const handleSelectAll = useCallback(() => {
    if (onSelectionChange) {
      const allIds = records.map(record => record.id);
      onSelectionChange(allIds);
    }
  }, [records, onSelectionChange]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (records.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        const nextIndex = focusedIndex < 0 ? 0 : Math.min(focusedIndex + 1, records.length - 1);
        setFocusedIndex(nextIndex);
        break;
      case 'ArrowUp':
        event.preventDefault();
        const prevIndex = focusedIndex < 0 ? 0 : Math.max(focusedIndex - 1, 0);
        setFocusedIndex(prevIndex);
        break;
      case 'Home':
        event.preventDefault();
        setFocusedIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setFocusedIndex(records.length - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < records.length) {
          handleRecordSelect(records[focusedIndex]);
        }
        break;
    }
  }, [records, focusedIndex, handleRecordSelect]);

  // Focus management
  useEffect(() => {
    if (focusedIndex >= 0) {
      const focusedElement = listRef.current?.querySelector(
        `[data-record-index="${focusedIndex}"]`
      ) as HTMLElement;
      focusedElement?.focus();
    }
  }, [focusedIndex]);

  const renderEmptyState = (): JSX.Element => (
    <div 
      style={{
        padding: '48px 24px',
        textAlign: 'center',
        color: '#6b7280',
        fontSize: '16px',
      }}
    >
      No records found
    </div>
  );

  const renderBulkActionsToolbar = (): JSX.Element | null => {
    if (!showBulkActions || selectedRecordIds.length === 0) return null;

    return (
      <div
        role="toolbar"
        aria-label="Bulk actions"
        style={{
          padding: '12px 16px',
          backgroundColor: '#f3f4f6',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: '14px', color: '#374151' }}>
          {selectedRecordIds.length} records selected
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={handleSelectAll}
            style={{
              padding: '6px 12px',
              fontSize: '14px',
              backgroundColor: 'transparent',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Select All
          </button>
        </div>
      </div>
    );
  };

  const renderVirtualizedList = (): JSX.Element => (
    <div
      data-testid="virtual-list"
      ref={scrollContainerRef}
      onScroll={handleScroll}
      style={{
        height: containerHeight,
        overflow: 'auto',
        position: 'relative',
      }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {virtualItems.map(({ index, top }) => {
          const record = records[index];
          const isSelected = selectedRecordIds.includes(record.id);
          const isFocused = index === focusedIndex;

          return (
            <div
              key={record.id}
              data-record-index={index}
              style={{
                position: 'absolute',
                top,
                left: 0,
                right: 0,
                height: itemHeight,
              }}
            >
              <RecordItem
                record={record}
                isSelected={isSelected}
                onSelect={(rec) => handleRecordSelect(rec)}
                onEdit={onEdit}
                onDelete={onDelete}
                onTagClick={onTagClick}
                data-testid="record-item"
                tabIndex={isFocused ? 0 : -1}
                style={{ height: '100%' }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderRegularList = (): JSX.Element => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {records.map((record, index) => {
        const isSelected = selectedRecordIds.includes(record.id);
        const isFocused = index === focusedIndex;

        return (
          <RecordItem
            key={record.id}
            record={record}
            isSelected={isSelected}
            onSelect={handleRecordSelect}
            onEdit={onEdit}
            onDelete={onDelete}
            onTagClick={onTagClick}
            data-testid="record-item"
            data-record-index={index}
            tabIndex={isFocused ? 0 : -1}
            style={{
              borderBottom: '1px solid #e5e7eb',
            }}
          />
        );
      })}
    </div>
  );

  const renderInstructions = (): JSX.Element => (
    <div
      style={{
        padding: '8px 16px',
        fontSize: '12px',
        color: '#6b7280',
        backgroundColor: '#f9fafb',
        borderTop: '1px solid #e5e7eb',
      }}
    >
      Use arrow keys to navigate, Enter or Space to select
    </div>
  );

  if (records.length === 0) {
    return (
      <div
        role="region"
        aria-label="Record list"
        className={className}
        data-responsive={isResponsive}
      >
        {renderEmptyState()}
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Record list"
      className={className}
      data-responsive={isResponsive}
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        backgroundColor: 'white',
        overflow: 'hidden',
      }}
    >
      {/* Selection status for screen readers */}
      {selectionMode !== 'none' && (
        <div
          role="status"
          aria-label="Selection status"
          aria-live="polite"
          style={{
            position: 'absolute',
            left: '-10000px',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
          }}
        >
          {selectedRecordIds.length} record{selectedRecordIds.length !== 1 ? 's' : ''} selected
        </div>
      )}

      {renderBulkActionsToolbar()}
      
      <div
        ref={listRef}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="list"
        style={{ outline: 'none' }}
      >
        {shouldVirtualize ? renderVirtualizedList() : renderRegularList()}
      </div>
      
      {renderInstructions()}

      {/* Error handling for incomplete records */}
      <div style={{ display: 'none' }}>
        {records.some(record => !record.content) && (
          <div>Unable to display record</div>
        )}
      </div>
    </div>
  );
};