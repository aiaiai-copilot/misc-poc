import { KeyboardEvent, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface MiscInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (tags: string[]) => void;
  onEscape: () => void;
  onNavigateDown?: () => void;
  placeholder?: string;
  allTags: string[];
  className?: string;
  toolbar?: React.ReactNode;
}

export const MiscInput = forwardRef<HTMLInputElement, MiscInputProps>(
  (
    {
      value,
      onChange,
      onSubmit,
      onEscape,
      onNavigateDown,
      placeholder = 'Enter tags separated by spaces...',
      allTags: _allTags,
      className,
      toolbar,
    },
    ref
  ) => {
    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const tags = value.trim().split(/\s+/).filter(Boolean);
        if (tags.length > 0) {
          onSubmit(tags);
        }
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (onNavigateDown) {
          onNavigateDown();
        }
      }

      if (e.key === 'Escape') {
        e.preventDefault();

        // Serial deletion of last tags
        const trimmedValue = value.trim();
        if (!trimmedValue) {
          // No content, call original escape behavior
          onEscape();
          return;
        }

        // Find the last complete tag by splitting and removing the last one
        const tags = trimmedValue.split(/\s+/).filter(Boolean);
        if (tags.length > 1) {
          // Remove last complete tag, keep space after remaining tags
          const remainingTags = tags.slice(0, -1);
          onChange(remainingTags.join(' ') + ' ');
        } else {
          // Only one tag left, clear it completely
          onChange('');
        }
      }
    };

    const handleClear = (): void => {
      onChange('');
      // Refocus the input after clearing
      if (ref && 'current' in ref && ref.current) {
        ref.current.focus();
      }
    };

    return (
      <div
        className={cn(
          'relative w-full border-8 border-l-16 rounded-md bg-background shadow-inner overflow-hidden',
          className
        )}
        style={{ borderColor: '#A9A9A9' }}
      >
        <div className="flex items-stretch">
          <input
            ref={ref}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="calculator-input h-full flex-1 text-center border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            data-testid="main-input"
            autoFocus
          />
          {toolbar && (
            <div
              className="flex items-center gap-1 px-2"
              style={{ backgroundColor: '#A9A9A9', minHeight: '100%' }}
            >
              {value.trim() && (
                <button
                  onClick={handleClear}
                  className="p-1 rounded-none hover:bg-muted transition-colors"
                  type="button"
                  title="Clear input"
                >
                  <X size={16} className="text-gray-900 hover:text-gray-700" />
                </button>
              )}
              {toolbar}
            </div>
          )}
        </div>
      </div>
    );
  }
);
