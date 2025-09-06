import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
  KeyboardEvent,
  ChangeEvent,
  FocusEvent,
  useMemo,
} from 'react';

interface SearchInputProps {
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  isLoading?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  debounceMs?: number;
  autoComplete?: boolean;
  suggestions?: string[];
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  onClear?: () => void;
  onFocus?: (event: FocusEvent<HTMLInputElement>) => void;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  onSelect?: (value: string) => void;
  onArrowDown?: () => void;
  onArrowUp?: () => void;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      defaultValue,
      placeholder = '',
      className = '',
      ariaLabel = 'Search input',
      isLoading = false,
      hasError = false,
      errorMessage,
      debounceMs = 300,
      autoComplete = false,
      suggestions = [],
      onChange,
      onSearch,
      onClear,
      onFocus,
      onBlur,
      onSelect,
      onArrowDown,
      onArrowUp,
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = useState(defaultValue || '');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<NodeJS.Timeout>();
    const errorId = useRef(
      `search-input-error-${Math.random().toString(36).substr(2, 9)}`
    );
    const dropdownId = useRef(
      `search-input-dropdown-${Math.random().toString(36).substr(2, 9)}`
    );

    const isControlled = value !== undefined;
    const currentValue = isControlled ? value : internalValue;

    // Forward ref to input element
    useImperativeHandle(ref, () => inputRef.current!, []);

    // Filter suggestions based on current value
    const filteredSuggestions = useMemo(() => {
      if (!autoComplete || !currentValue || suggestions.length === 0) {
        return [];
      }
      return suggestions.filter((suggestion) =>
        suggestion.toLowerCase().includes(currentValue.toLowerCase())
      );
    }, [currentValue, suggestions, autoComplete]);

    // Update suggestions visibility
    useEffect(() => {
      const shouldShow =
        autoComplete && currentValue && filteredSuggestions.length > 0;
      setShowSuggestions(shouldShow);
      if (!shouldShow) {
        setSelectedSuggestionIndex(-1);
      }
    }, [autoComplete, currentValue, filteredSuggestions.length]);

    // Debounced search function
    const triggerSearch = useCallback(
      (searchValue: string): void => {
        if (onSearch && searchValue.trim()) {
          onSearch(searchValue);
        }
      },
      [onSearch]
    );

    // Handle debouncing
    useEffect(() => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (currentValue.trim()) {
        debounceRef.current = setTimeout(() => {
          triggerSearch(currentValue);
        }, debounceMs);
      }

      return () => {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
      };
    }, [currentValue, debounceMs, triggerSearch]);

    const handleInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
      const newValue = event.target.value;

      if (!isControlled) {
        setInternalValue(newValue);
      }

      if (onChange) {
        onChange(newValue);
      }
    };

    const handleSuggestionSelect = useCallback(
      (suggestion: string): void => {
        if (!isControlled) {
          setInternalValue(suggestion);
        }

        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);

        if (onSelect) {
          onSelect(suggestion);
        }

        if (onChange) {
          onChange(suggestion);
        }
      },
      [isControlled, onSelect, onChange]
    );

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
      switch (event.key) {
        case 'Enter':
          event.preventDefault();
          if (
            selectedSuggestionIndex >= 0 &&
            filteredSuggestions[selectedSuggestionIndex]
          ) {
            handleSuggestionSelect(
              filteredSuggestions[selectedSuggestionIndex]
            );
          } else {
            // Cancel debounce and trigger immediate search
            if (debounceRef.current) {
              clearTimeout(debounceRef.current);
            }
            triggerSearch(currentValue);
          }
          break;

        case 'Escape':
          if (!isControlled) {
            setInternalValue('');
          } else if (onChange) {
            onChange('');
          }
          setShowSuggestions(false);
          if (onClear) {
            onClear();
          }
          break;

        case 'ArrowDown':
          if (autoComplete) {
            event.preventDefault();
            if (showSuggestions) {
              setSelectedSuggestionIndex((prev) =>
                prev < filteredSuggestions.length - 1 ? prev + 1 : prev
              );
            }
            if (onArrowDown) {
              onArrowDown();
            }
          }
          break;

        case 'ArrowUp':
          if (autoComplete) {
            event.preventDefault();
            if (showSuggestions) {
              setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : -1));
            }
            if (onArrowUp) {
              onArrowUp();
            }
          }
          break;

        case 'Tab':
          setShowSuggestions(false);
          break;
      }
    };

    const handleFocus = (event: FocusEvent<HTMLInputElement>): void => {
      if (autoComplete && currentValue && filteredSuggestions.length > 0) {
        setShowSuggestions(true);
      }

      if (onFocus) {
        onFocus(event);
      }
    };

    const handleBlur = (event: FocusEvent<HTMLInputElement>): void => {
      // Delay hiding suggestions to allow for clicks
      setTimeout(() => {
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
      }, 150);

      if (onBlur) {
        onBlur(event);
      }
    };

    return (
      <div className="search-input-container">
        <div
          className={`search-input-wrapper ${className}`}
          style={{ position: 'relative' }}
        >
          <input
            ref={inputRef}
            type="text"
            value={currentValue}
            placeholder={placeholder}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            disabled={isLoading}
            aria-label={ariaLabel}
            aria-invalid={hasError}
            aria-describedby={hasError ? errorId.current : undefined}
            aria-expanded={showSuggestions}
            aria-haspopup={autoComplete ? 'listbox' : undefined}
            aria-autocomplete={autoComplete ? 'list' : undefined}
            role="textbox"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '4px',
              border: hasError ? '2px solid #ef4444' : '1px solid #d1d5db',
              fontSize: '14px',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
          />

          {isLoading && (
            <div
              aria-label="Loading"
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '16px',
                height: '16px',
                border: '2px solid #f3f4f6',
                borderTop: '2px solid #3b82f6',
                borderRadius: '50%',
                animation: 'search-input-spin 1s linear infinite',
              }}
            />
          )}

          {showSuggestions && filteredSuggestions.length > 0 && (
            <ul
              id={dropdownId.current}
              role="listbox"
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: 'white',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                marginTop: '4px',
                maxHeight: '200px',
                overflowY: 'auto',
                zIndex: 1000,
                listStyle: 'none',
                margin: 0,
                padding: 0,
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
            >
              {filteredSuggestions.map((suggestion, index) => (
                <li
                  key={suggestion}
                  role="option"
                  aria-selected={index === selectedSuggestionIndex}
                  onClick={() => handleSuggestionSelect(suggestion)}
                  onMouseDown={(e) => e.preventDefault()} // Prevent blur
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    backgroundColor:
                      index === selectedSuggestionIndex
                        ? '#f3f4f6'
                        : 'transparent',
                  }}
                  onMouseEnter={() => setSelectedSuggestionIndex(index)}
                >
                  {suggestion}
                </li>
              ))}
            </ul>
          )}
        </div>

        {hasError && errorMessage && (
          <div
            id={errorId.current}
            role="alert"
            style={{
              color: '#ef4444',
              fontSize: '12px',
              marginTop: '4px',
            }}
          >
            {errorMessage}
          </div>
        )}

        <style>{`
          @keyframes search-input-spin {
            0% { transform: translateY(-50%) rotate(0deg); }
            100% { transform: translateY(-50%) rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';
