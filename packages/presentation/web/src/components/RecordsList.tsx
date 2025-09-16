import {
  useState,
  useRef,
  KeyboardEvent,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useCallback,
  memo,
} from 'react';
import { Record } from '@/types/Record';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RecordsListProps {
  records: Record[];
  onEdit: (record: Record) => void;
  onDelete: (id: string) => void;
  searchQuery?: string;
  onNavigateUp?: () => void;
}

export interface RecordsListRef {
  focusFirst: () => void;
}

interface RecordItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    records: Record[];
    editingId: string | null;
    searchTerms: string[];
    searchQuery: string;
    onEdit: (record: Record) => void;
    onDelete: (id: string) => void;
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>, index: number) => void;
    itemRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  };
}

const highlightTags = (
  tags: string[],
  searchTerms: string[],
  searchQuery: string
): string | JSX.Element[] => {
  if (!searchQuery.trim()) return tags.join(' ');

  const searchLower = searchTerms.map((term) => term.toLowerCase());
  return tags.map((tag, index) => {
    const isHighlighted = searchLower.includes(tag.toLowerCase());
    return (
      <span key={index} className={cn(isHighlighted && 'font-bold')}>
        {tag}
        {index < tags.length - 1 ? ' ' : ''}
      </span>
    );
  });
};

const RecordItem = memo<RecordItemProps>(({ index, style, data }) => {
  const {
    records,
    editingId,
    searchTerms,
    searchQuery,
    onEdit,
    onDelete,
    onKeyDown,
    itemRefs,
  } = data;
  const record = records[index];

  const handleRecordClick = useCallback(() => {
    if (editingId !== record.id) {
      onEdit(record);
    }
  }, [editingId, record.id, record, onEdit]);

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete(record.id);
    },
    [record.id, onDelete]
  );

  return (
    <div style={style}>
      <div
        ref={(el) => (itemRefs.current[index] = el)}
        className={cn(
          'record-item cursor-pointer group relative border rounded focus:outline-none focus:ring-2 focus:ring-ring mx-2 mb-2',
          editingId === record.id && 'bg-muted'
        )}
        style={{
          paddingLeft: '12px',
          paddingRight: '40px',
          paddingTop: '12px',
          paddingBottom: '12px',
        }}
        onClick={handleRecordClick}
        onKeyDown={(e) => onKeyDown(e, index)}
        tabIndex={-1}
      >
        <div className="flex items-center">
          <div className="flex-1">
            <div className="text-foreground text-sm">
              {highlightTags(record.tags, searchTerms, searchQuery)}
            </div>
          </div>
        </div>

        <button
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          onClick={handleDeleteClick}
          aria-label="Delete record"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
});

RecordItem.displayName = 'RecordItem';

interface RecordItemOptimizedProps {
  record: Record;
  index: number;
  isEditing: boolean;
  searchTerms: string[];
  searchQuery: string;
  onEdit: (record: Record) => void;
  onDelete: (id: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>, index: number) => void;
  itemRef: (el: HTMLDivElement | null) => void;
}

const RecordItemOptimized = memo<RecordItemOptimizedProps>(
  ({
    record,
    index,
    isEditing,
    searchTerms,
    searchQuery,
    onEdit,
    onDelete,
    onKeyDown,
    itemRef,
  }) => {
    const handleRecordClick = useCallback(() => {
      if (!isEditing) {
        onEdit(record);
      }
    }, [isEditing, record, onEdit]);

    const handleDeleteClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete(record.id);
      },
      [record.id, onDelete]
    );

    const handleKeyDownLocal = useCallback(
      (e: KeyboardEvent<HTMLDivElement>) => {
        onKeyDown(e, index);
      },
      [onKeyDown, index]
    );

    const highlightedTags = useMemo(
      () => highlightTags(record.tags, searchTerms, searchQuery),
      [record.tags, searchTerms, searchQuery]
    );

    return (
      <div
        ref={itemRef}
        className={cn(
          'record-item cursor-pointer group relative border rounded focus:outline-none focus:ring-2 focus:ring-ring',
          isEditing && 'bg-muted'
        )}
        style={{
          paddingLeft: '12px',
          paddingRight: '40px',
          paddingTop: '12px',
          paddingBottom: '12px',
        }}
        onClick={handleRecordClick}
        onKeyDown={handleKeyDownLocal}
        tabIndex={-1}
        data-testid="record-item"
      >
        <div className="flex items-center">
          <div className="flex-1">
            <div className="text-foreground text-sm">{highlightedTags}</div>
          </div>
        </div>

        <button
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-none hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          onClick={handleDeleteClick}
          aria-label="Delete record"
        >
          <X size={16} />
        </button>
      </div>
    );
  }
);

RecordItemOptimized.displayName = 'RecordItemOptimized';

const RecordsListComponent = memo(
  forwardRef<RecordsListRef, RecordsListProps>(
    ({ records, onEdit, onDelete, searchQuery = '', onNavigateUp }, ref) => {
      const [editingId, setEditingId] = useState<string | null>(null);
      const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

      useImperativeHandle(
        ref,
        (): RecordsListRef => ({
          focusFirst: (): void => {
            if (itemRefs.current[0]) {
              itemRefs.current[0].focus();
            }
          },
        })
      );

      const handleKeyDown = useCallback(
        (e: KeyboardEvent<HTMLDivElement>, index: number): void => {
          switch (e.key) {
            case 'ArrowUp':
              e.preventDefault();
              if (index > 0) {
                itemRefs.current[index - 1]?.focus();
              } else if (onNavigateUp) {
                onNavigateUp();
              }
              break;
            case 'ArrowDown':
              e.preventDefault();
              if (index < records.length - 1) {
                itemRefs.current[index + 1]?.focus();
              }
              break;
            case 'Enter':
            case ' ':
              e.preventDefault();
              if (editingId !== records[index].id) {
                setEditingId(records[index].id);
                onEdit(records[index]);
              }
              break;
            case 'Delete':
            case 'Backspace':
              e.preventDefault();
              onDelete(records[index].id);
              break;
            case 'Escape':
              e.preventDefault();
              if (onNavigateUp) {
                onNavigateUp();
              }
              break;
          }
        },
        [records, editingId, onEdit, onDelete, onNavigateUp]
      );

      const searchTerms = useMemo(
        () => searchQuery.trim().split(/\s+/).filter(Boolean),
        [searchQuery]
      );

      if (records.length === 0) {
        return (
          <div
            className="w-full max-w-4xl mx-auto border-8 border-l-16 rounded-md bg-background shadow-inner overflow-hidden"
            style={{ borderColor: '#A9A9A9' }}
          >
            <div className="text-center py-16">
              <div className="text-muted-foreground text-lg">
                No records found
              </div>
              <div className="text-muted-foreground text-sm mt-2">
                Press Enter to create
              </div>
            </div>
          </div>
        );
      }

      // Use optimized regular rendering with intelligent limits
      const maxDisplayItems = 50; // Increase limit for better UX while maintaining performance
      const visibleRecords = useMemo(
        () => records.slice(0, maxDisplayItems),
        [records, maxDisplayItems]
      );

      return (
        <div
          className="w-full max-w-4xl mx-auto border-8 border-l-16 rounded-md bg-background shadow-inner overflow-hidden"
          style={{ borderColor: '#A9A9A9' }}
          data-testid="records-list"
        >
          <div className="space-y-2 p-4">
            {visibleRecords.map((record, index) => (
              <RecordItemOptimized
                key={record.id}
                record={record}
                index={index}
                isEditing={editingId === record.id}
                searchTerms={searchTerms}
                searchQuery={searchQuery}
                onEdit={onEdit}
                onDelete={onDelete}
                onKeyDown={handleKeyDown}
                itemRef={(el): void => {
                  itemRefs.current[index] = el;
                }}
              />
            ))}
          </div>
        </div>
      );
    }
  )
);

RecordsListComponent.displayName = 'RecordsList';

export const RecordsList = RecordsListComponent;
