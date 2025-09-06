import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  MouseEvent,
  KeyboardEvent,
} from 'react';
import { RecordDTO } from '@misc-poc/application';

export interface CustomAction {
  label: string;
  icon?: string;
  onClick: (record: RecordDTO) => void | Promise<void>;
}

export interface RecordItemProps {
  record: RecordDTO;
  className?: string;
  isSelected?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
  actionsDisabled?: boolean;
  requireDeleteConfirmation?: boolean;
  showExpandedTags?: boolean;
  maxContentLength?: number;
  maxTagsShown?: number;
  customActions?: CustomAction[];
  onSelect?: (record: RecordDTO, event?: MouseEvent) => void;
  onEdit?: (record: RecordDTO) => void | Promise<void>;
  onDelete?: (record: RecordDTO) => void | Promise<void>;
  onTagClick?: (tagId: string) => void;
  style?: React.CSSProperties;
  tabIndex?: number;
  'data-testid'?: string;
  'data-record-index'?: number;
}

export const RecordItem: React.FC<RecordItemProps> = ({
  record,
  className = '',
  isSelected = false,
  disabled = false,
  isLoading = false,
  actionsDisabled = false,
  requireDeleteConfirmation = false,
  showExpandedTags = false,
  maxContentLength = 150,
  maxTagsShown = 5,
  customActions = [],
  onSelect,
  onEdit,
  onDelete,
  onTagClick,
  style,
  tabIndex,
  'data-testid': dataTestId,
  'data-record-index': dataRecordIndex,
}) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isResponsive, setIsResponsive] = useState<'mobile' | 'desktop'>('desktop');
  const [previousSelected, setPreviousSelected] = useState(isSelected);

  // Handle responsive design
  useEffect((): (() => void) => {
    const handleResize = (): void => {
      if (window.innerWidth < 480) {
        setIsResponsive('mobile');
      } else {
        setIsResponsive('desktop');
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Announce selection changes to screen readers
  useEffect(() => {
    if (isSelected !== previousSelected) {
      setPreviousSelected(isSelected);
    }
  }, [isSelected, previousSelected]);

  const formatDate = useCallback((dateString: string): string => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Date unavailable';
      }
      
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        return 'Today';
      } else if (diffDays === 1) {
        return 'Yesterday';
      } else if (diffDays < 7) {
        return `${diffDays} days ago`;
      } else {
        return date.toLocaleDateString();
      }
    } catch {
      return 'Date unavailable';
    }
  }, []);

  const truncateContent = useMemo(() => {
    if (!record.content) {
      return 'No content available';
    }
    
    if (record.content.length <= maxContentLength) {
      return record.content;
    }
    
    return record.content.substring(0, maxContentLength) + '...';
  }, [record.content, maxContentLength]);

  const tagDisplay = useMemo(() => {
    if (!record.tagIds || record.tagIds.length === 0) {
      return { text: 'No tags', tags: [] };
    }

    if (showExpandedTags) {
      const visibleTags = record.tagIds.slice(0, maxTagsShown);
      const remainingCount = record.tagIds.length - maxTagsShown;
      
      return {
        text: '',
        tags: visibleTags,
        moreCount: remainingCount > 0 ? remainingCount : 0,
      };
    }

    return {
      text: `${record.tagIds.length} tag${record.tagIds.length !== 1 ? 's' : ''}`,
      tags: [],
    };
  }, [record.tagIds, showExpandedTags, maxTagsShown]);

  const handleSelect = useCallback((event?: MouseEvent) => {
    if (disabled || isLoading || !onSelect) return;
    onSelect(record, event);
  }, [disabled, isLoading, onSelect, record]);

  const handleEdit = useCallback(async () => {
    if (!onEdit || isLoading || disabled) return;
    
    try {
      setError(null);
      await onEdit(record);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Edit failed');
    }
  }, [onEdit, isLoading, disabled, record]);

  const handleDelete = useCallback(async () => {
    if (!onDelete || isLoading || disabled) return;

    if (requireDeleteConfirmation && !showDeleteDialog) {
      setShowDeleteDialog(true);
      return;
    }

    try {
      setError(null);
      await onDelete(record);
      setShowDeleteDialog(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }, [onDelete, isLoading, disabled, record, requireDeleteConfirmation, showDeleteDialog]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (onSelect && !disabled && !isLoading) {
          onSelect(record);
        }
        break;
      case 'Escape':
        event.preventDefault();
        setShowDeleteDialog(false);
        setError(null);
        // Focus parent container
        (event.currentTarget.parentElement as HTMLElement)?.focus();
        break;
    }
  }, [onSelect, disabled, isLoading, record]);

  const handleTagClick = useCallback((tagId: string) => {
    if (onTagClick) {
      onTagClick(tagId);
    }
  }, [onTagClick]);

  const renderActions = (): JSX.Element | null => {
    if (actionsDisabled) return null;

    const isNarrowScreen = window.innerWidth < 400;
    
    if (isNarrowScreen) {
      return (
        <button
          type="button"
          aria-label="More actions"
          disabled={disabled || isLoading}
          style={{
            padding: '8px',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          ⋮
        </button>
      );
    }

    return (
      <div style={{ display: 'flex', gap: '8px' }}>
        {customActions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => action.onClick(record)}
            disabled={disabled || isLoading}
            style={{
              padding: '6px 12px',
              fontSize: '14px',
              backgroundColor: 'transparent',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {action.icon && <span style={{ marginRight: '4px' }}>{action.icon}</span>}
            {action.label}
          </button>
        ))}
        
        {onEdit && (
          <button
            type="button"
            onClick={handleEdit}
            disabled={disabled || isLoading}
            aria-label={`Edit record: ${truncateContent}`}
            style={{
              padding: '6px 12px',
              fontSize: '14px',
              backgroundColor: 'transparent',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Edit
          </button>
        )}
        
        {onDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={disabled || isLoading}
            aria-label={`Delete record: ${truncateContent}`}
            style={{
              padding: '6px 12px',
              fontSize: '14px',
              backgroundColor: 'transparent',
              border: '1px solid #dc2626',
              borderRadius: '4px',
              color: '#dc2626',
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
        )}
      </div>
    );
  };

  const renderTags = (): JSX.Element => {
    if (showExpandedTags && tagDisplay.tags) {
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
          {tagDisplay.tags.map((tagId) => (
            <button
              key={tagId}
              type="button"
              onClick={() => handleTagClick(tagId)}
              disabled={!onTagClick}
              style={{
                padding: '2px 8px',
                fontSize: '12px',
                backgroundColor: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '12px',
                cursor: onTagClick ? 'pointer' : 'default',
              }}
            >
              {tagId}
            </button>
          ))}
          {tagDisplay.moreCount && tagDisplay.moreCount > 0 && (
            <span style={{ fontSize: '12px', color: '#6b7280' }}>
              and {tagDisplay.moreCount} more
            </span>
          )}
        </div>
      );
    }

    return (
      <span style={{ fontSize: '12px', color: '#6b7280' }}>
        {tagDisplay.text}
      </span>
    );
  };

  const renderDeleteConfirmDialog = (): JSX.Element | null => {
    if (!showDeleteDialog) return null;

    return (
      <div
        role="dialog"
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'white',
          padding: '24px',
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
          zIndex: 1000,
          minWidth: '300px',
        }}
      >
        <h3 id="delete-dialog-title" style={{ margin: '0 0 16px 0' }}>
          Confirm Deletion
        </h3>
        <p id="delete-dialog-description" style={{ margin: '0 0 24px 0' }}>
          Are you sure you want to delete this record? This action cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => setShowDeleteDialog(false)}
            style={{
              padding: '8px 16px',
              backgroundColor: 'transparent',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            style={{
              padding: '8px 16px',
              backgroundColor: '#dc2626',
              border: '1px solid #dc2626',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    );
  };

  // Check for high contrast mode
  const isHighContrast = window.matchMedia && 
    window.matchMedia('(prefers-contrast: high)').matches;

  const itemStyles: React.CSSProperties = {
    ...style,
    padding: '16px',
    backgroundColor: isSelected ? '#eff6ff' : 'white',
    border: isSelected ? '2px solid #3b82f6' : '1px solid transparent',
    borderRadius: '4px',
    cursor: onSelect && !disabled ? 'pointer' : 'default',
    transition: 'all 0.2s ease',
    position: 'relative',
    ...(disabled && { opacity: 0.6 }),
    ...(isHighContrast && { border: '2px solid #000' }),
  };

  const containerClasses = [
    className,
    isSelected ? 'selected' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <div
        role="button"
        aria-label="Record item"
        aria-selected={isSelected}
        aria-disabled={disabled}
        aria-describedby={`record-details-${record.id}`}
        aria-labelledby={`record-content-${record.id}`}
        className={containerClasses}
        style={itemStyles}
        onClick={(event) => handleSelect(event)}
        onKeyDown={handleKeyDown}
        tabIndex={tabIndex}
        data-testid={dataTestId}
        data-record-index={dataRecordIndex}
        data-layout={isResponsive}
        data-high-contrast={isHighContrast}
      >
        {isLoading && (
          <div
            role="status"
            aria-label="Loading"
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              width: '16px',
              height: '16px',
              border: '2px solid #f3f4f6',
              borderTop: '2px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
        )}

        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '16px',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              id={`record-content-${record.id}`}
              data-testid="record-content"
              style={{
                fontSize: '16px',
                fontWeight: '500',
                color: '#111827',
                marginBottom: '8px',
                wordBreak: 'break-word',
              }}
            >
              {truncateContent}
            </div>

            <div
              id={`record-details-${record.id}`}
              role="region"
              aria-label="Record details"
              style={{
                fontSize: '14px',
                color: '#6b7280',
                display: 'flex',
                gap: '16px',
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <span>Created {formatDate(record.createdAt)}</span>
              <span>Updated {formatDate(record.updatedAt)}</span>
              {renderTags()}
            </div>
          </div>

          {renderActions()}
        </div>

        {error && (
          <div
            role="alert"
            style={{
              marginTop: '8px',
              padding: '8px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '4px',
              color: '#dc2626',
              fontSize: '14px',
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Screen reader announcement for selection changes */}
      {isSelected !== previousSelected && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'absolute',
            left: '-10000px',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
          }}
        >
          Record {isSelected ? 'selected' : 'deselected'}
        </div>
      )}

      {renderDeleteConfirmDialog()}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};