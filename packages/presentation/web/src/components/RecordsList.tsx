import { useState, useRef, KeyboardEvent, forwardRef, useImperativeHandle } from 'react';
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

export const RecordsList = forwardRef<RecordsListRef, RecordsListProps>(({ records, onEdit, onDelete, searchQuery = '', onNavigateUp }, ref) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useImperativeHandle(ref, (): RecordsListRef => ({
    focusFirst: (): void => {
      if (itemRefs.current[0]) {
        itemRefs.current[0].focus();
      }
    }
  }));

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, index: number): void => {
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
        handleRecordClick(records[index]);
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
  };

  const highlightTags = (tags: string[], searchTerms: string[]): string | JSX.Element[] => {
    if (!searchQuery.trim()) return tags.join(' ');
    
    const searchLower = searchTerms.map(term => term.toLowerCase());
    return tags.map((tag, index) => {
      const isHighlighted = searchLower.includes(tag.toLowerCase());
      return (
        <span
          key={index}
          className={cn(
            isHighlighted && "font-bold"
          )}
        >
          {tag}{index < tags.length - 1 ? ' ' : ''}
        </span>
      );
    });
  };

  const searchTerms = searchQuery.trim().split(/\s+/).filter(Boolean);

  const handleRecordClick = (record: Record): void => {
    if (editingId !== record.id) {
      setEditingId(record.id);
      onEdit(record);
    }
  };

  if (records.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-muted-foreground text-lg">No records found</div>
        <div className="text-muted-foreground text-sm mt-2">Press Enter to create</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-2">
      {records.slice(0, 12).map((record, index) => (
        <div
          key={record.id}
          ref={el => itemRefs.current[index] = el}
          className={cn(
            "record-item cursor-pointer group relative border rounded focus:outline-none focus:ring-2 focus:ring-ring",
            editingId === record.id && "bg-muted"
          )}
          style={{ paddingLeft: '12px', paddingRight: '40px', paddingTop: '12px', paddingBottom: '12px' }}
          onClick={() => handleRecordClick(record)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          tabIndex={-1}
        >
          <div className="flex items-center">
            <div className="flex-1">
              <div className="text-foreground text-sm">
                {highlightTags(record.tags, searchTerms)}
              </div>
            </div>
          </div>
          
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(record.id);
            }}
            aria-label="Delete record"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
});