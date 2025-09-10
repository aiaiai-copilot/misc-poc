import { useState, useEffect, useRef, useCallback, KeyboardEvent, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useApplicationContext } from '../contexts/ApplicationContext';
import { CreateRecordRequest, SearchRecordsRequest, SearchResultDTO } from '@misc-poc/application';

interface MiscInputIntegratedProps {
  className?: string;
  placeholder?: string;
  onSearchResults?: (results: SearchResultDTO | null) => void;
  onRecordCreated?: () => void;
}

export const MiscInputIntegrated = forwardRef<HTMLInputElement, MiscInputIntegratedProps>(({
  className,
  placeholder = "Enter tags separated by spaces...",
  onSearchResults,
  onRecordCreated
}, ref) => {
  const [value, setValue] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  
  const { createRecordUseCase, searchRecordsUseCase } = useApplicationContext();
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const internalRef = useRef<HTMLInputElement>(null);
  const inputRef = ref || internalRef;

  // Debounced search effect
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Don't search if use case is not available
    if (!searchRecordsUseCase) {
      return;
    }

    // Handle empty input - clear search results
    if (!value.trim()) {
      onSearchResults?.(null);
      return;
    }

    // Set up debounced search
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      
      try {
        const request: SearchRecordsRequest = {
          query: value.trim(),
          options: {
            limit: 10,
            offset: 0,
            sortBy: 'createdAt',
            sortOrder: 'desc',
          },
        };

        const result = await searchRecordsUseCase.execute(request);
        
        if (result.isOk()) {
          onSearchResults?.(result.unwrap().searchResult);
        } else {
          const searchError = result.unwrapErr();
          toast.error(`Search failed: ${searchError.message}`);
        }
      } catch {
        toast.error('An unexpected search error occurred');
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return (): void => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [value, searchRecordsUseCase, onSearchResults]);

  const handleCreateRecord = useCallback(async (content: string): Promise<void> => {
    if (!createRecordUseCase) {
      toast.error('Application not ready');
      return;
    }

    setIsCreating(true);
    
    try {
      // Parse and normalize the content (split and rejoin to normalize spaces)
      const tags = content.trim().split(/\s+/).filter(Boolean);
      const normalizedContent = tags.join(' ');
      
      const request: CreateRecordRequest = {
        content: normalizedContent,
      };

      const result = await createRecordUseCase.execute(request);
      
      if (result.isOk()) {
        setValue('');
        toast.success('Record created successfully');
        onRecordCreated?.();
        
        // Refocus the input
        if (inputRef && 'current' in inputRef && inputRef.current) {
          inputRef.current.focus();
        }
      } else {
        const createError = result.unwrapErr();
        toast.error(`Failed to create record: ${createError.message}`);
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsCreating(false);
    }
  }, [createRecordUseCase, onRecordCreated, inputRef]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmedValue = value.trim();
      if (trimmedValue && !isCreating) {
        const tags = trimmedValue.split(/\s+/).filter(Boolean);
        if (tags.length > 0) {
          handleCreateRecord(trimmedValue);
        }
      }
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      
      // Serial deletion of last tags
      const trimmedValue = value.trim();
      if (!trimmedValue) {
        // No content, clear everything
        setValue('');
        onSearchResults?.(null);
        return;
      }
      
      // Find the last complete tag by splitting and removing the last one
      const tags = trimmedValue.split(/\s+/).filter(Boolean);
      if (tags.length > 1) {
        // Remove last complete tag, keep space after remaining tags
        const remainingTags = tags.slice(0, -1);
        setValue(remainingTags.join(' ') + ' ');
      } else {
        // Only one tag left, clear it completely
        setValue('');
      }
    }
  };

  const handleClear = (): void => {
    setValue('');
    onSearchResults?.(null);
    // Refocus the input after clearing
    if (inputRef && 'current' in inputRef && inputRef.current) {
      inputRef.current.focus();
    }
  };

  const isDisabled = isCreating;
  const showLoadingText = isCreating || isSearching;
  const loadingText = isCreating ? 'Creating...' : 'Searching...';

  return (
    <div className={cn("relative w-full", className)}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={isDisabled ? loadingText : placeholder}
        className="calculator-input w-full text-center pr-10"
        autoFocus
        disabled={isDisabled}
      />
      {value.trim() && !isDisabled && (
        <button
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted transition-colors"
          type="button"
        >
          <X size={16} className="text-muted-foreground hover:text-foreground" />
        </button>
      )}
      {showLoadingText && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          {loadingText}
        </div>
      )}
    </div>
  );
});

MiscInputIntegrated.displayName = 'MiscInputIntegrated';
