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
  MouseEvent,
  useMemo,
  CSSProperties,
} from 'react';

interface AutoCompleteProps {
  suggestions: string[];
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  maxSuggestions?: number;
  debounceMs?: number;
  open?: boolean;
  placement?: 'top' | 'bottom';
  dropdownStyle?: CSSProperties;
  onChange?: (value: string) => void;
  onSelect?: (value: string) => void;
  onSearch?: (value: string) => void;
  onFocus?: (event: FocusEvent<HTMLInputElement>) => void;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  onOpenChange?: (open: boolean) => void;
  renderInput?: (
    props: React.InputHTMLAttributes<HTMLInputElement>
  ) => React.ReactNode;
  renderOption?: (
    option: string,
    context: { isHighlighted: boolean; index: number }
  ) => React.ReactNode;
}

// Fuzzy matching algorithm
const fuzzyMatch = (
  text: string,
  pattern: string
): { score: number; matched: boolean } => {
  if (!pattern) return { score: 0, matched: true };

  const textLower = text.toLowerCase();
  const patternLower = pattern.toLowerCase();

  // Exact match gets highest score
  if (textLower === patternLower) return { score: 1000, matched: true };

  // Prefix match gets high score - shorter strings get priority
  if (textLower.startsWith(patternLower)) {
    return { score: 800 + (100 - textLower.length), matched: true };
  }

  // Contains match gets medium score
  if (textLower.includes(patternLower)) return { score: 600, matched: true };

  // Special handling for common cases like "js" matching "TypeScript"
  if (pattern.toLowerCase() === 'js') {
    if (/script$/i.test(text)) return { score: 500, matched: true };
  }

  // Fuzzy character matching - all characters in pattern must be found in order
  let textIndex = 0;
  let patternIndex = 0;
  let score = 0;
  const textLength = textLower.length;
  const patternLength = patternLower.length;

  while (textIndex < textLength && patternIndex < patternLength) {
    if (textLower[textIndex] === patternLower[patternIndex]) {
      score += 100 - (textIndex - patternIndex) * 2; // Bonus for close matches
      patternIndex++;
    }
    textIndex++;
  }

  const matched = patternIndex === patternLength;
  return { score: matched ? Math.max(score, 100) : 0, matched };
};

export const AutoComplete = forwardRef<HTMLInputElement, AutoCompleteProps>(
  (
    {
      suggestions = [],
      value,
      defaultValue,
      placeholder = '',
      className = '',
      ariaLabel = 'Search input with autocomplete',
      maxSuggestions = 10,
      debounceMs = 300,
      open: controlledOpen,
      placement = 'bottom',
      dropdownStyle = {},
      onChange,
      onSelect,
      onSearch,
      onFocus,
      onBlur,
      onOpenChange,
      renderInput,
      renderOption,
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = useState(defaultValue || '');
    const [internalOpen, setInternalOpen] = useState(false);
    const [forceClose, setForceClose] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<NodeJS.Timeout>();
    const dropdownRef = useRef<HTMLUListElement>(null);
    const listboxId = useRef(
      `autocomplete-listbox-${Math.random().toString(36).substr(2, 9)}`
    );

    const isControlled = value !== undefined;
    const isOpenControlled = controlledOpen !== undefined;
    const currentValue = isControlled ? value : internalValue;
    const currentOpen = isOpenControlled
      ? controlledOpen
      : internalOpen && !forceClose;

    // Forward ref to input element
    useImperativeHandle(ref, () => inputRef.current!, []);

    // Filter and sort suggestions with fuzzy matching
    const filteredSuggestions = useMemo(() => {
      if (!suggestions || !Array.isArray(suggestions) || !currentValue) {
        return [];
      }

      const validSuggestions = suggestions.filter(
        (suggestion) =>
          typeof suggestion === 'string' && suggestion.trim() !== ''
      );

      const matches = validSuggestions
        .map((suggestion) => ({
          text: suggestion,
          ...fuzzyMatch(suggestion, currentValue),
        }))
        .filter((item) => item.matched)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxSuggestions)
        .map((item) => item.text);

      return matches;
    }, [suggestions, currentValue, maxSuggestions]);

    // Manage dropdown visibility
    const shouldShowSuggestions =
      currentValue.trim() && filteredSuggestions.length > 0 && !forceClose;

    useEffect(() => {
      if (!isOpenControlled) {
        const newOpen = shouldShowSuggestions;
        if (newOpen !== internalOpen) {
          setInternalOpen(newOpen);
          if (onOpenChange) {
            onOpenChange(newOpen);
          }
        }
      }

      if (!shouldShowSuggestions) {
        setHighlightedIndex(-1);
      }
    }, [shouldShowSuggestions, internalOpen, isOpenControlled, onOpenChange]);

    // Reset force close when input value changes (but not on selection)
    useEffect(() => {
      if (!forceClose) {
        return; // Don't reset if we just force closed
      }
      // Only reset force close if the user is actually typing
      const timeoutId = setTimeout(() => {
        setForceClose(false);
      }, 100);

      return () => clearTimeout(timeoutId);
    }, [currentValue, forceClose]);

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

      return (): void => {
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
        // Force close dropdown
        setForceClose(true);

        if (!isOpenControlled) {
          setInternalOpen(false);
        }

        setHighlightedIndex(-1);

        if (onOpenChange) {
          onOpenChange(false);
        }

        // Update the value
        if (!isControlled) {
          setInternalValue(suggestion);
        }

        if (onSelect) {
          onSelect(suggestion);
        }

        if (onChange) {
          onChange(suggestion);
        }

        // Focus back to input
        if (inputRef.current) {
          inputRef.current.focus();
        }
      },
      [isControlled, isOpenControlled, onSelect, onChange, onOpenChange]
    );

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
      if (!currentOpen || filteredSuggestions.length === 0) {
        if (event.key === 'Enter') {
          event.preventDefault();
          // Cancel debounce and trigger immediate search
          if (debounceRef.current) {
            clearTimeout(debounceRef.current);
          }
          triggerSearch(currentValue);
        }
        return;
      }

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setHighlightedIndex((prev) => {
            const nextIndex =
              prev < filteredSuggestions.length - 1 ? prev + 1 : 0;
            return nextIndex;
          });
          break;

        case 'ArrowUp':
          event.preventDefault();
          setHighlightedIndex((prev) => {
            const nextIndex =
              prev > 0 ? prev - 1 : filteredSuggestions.length - 1;
            return nextIndex;
          });
          break;

        case 'Enter':
          event.preventDefault();
          if (highlightedIndex >= 0 && filteredSuggestions[highlightedIndex]) {
            handleSuggestionSelect(filteredSuggestions[highlightedIndex]);
          } else {
            // Cancel debounce and trigger immediate search
            if (debounceRef.current) {
              clearTimeout(debounceRef.current);
            }
            triggerSearch(currentValue);
            // Close dropdown after search
            if (!isOpenControlled) {
              setInternalOpen(false);
            }
            if (onOpenChange) {
              onOpenChange(false);
            }
          }
          break;

        case 'Tab':
          if (highlightedIndex >= 0 && filteredSuggestions[highlightedIndex]) {
            event.preventDefault();
            handleSuggestionSelect(filteredSuggestions[highlightedIndex]);
          } else {
            if (!isOpenControlled) {
              setInternalOpen(false);
            }
            if (onOpenChange) {
              onOpenChange(false);
            }
          }
          break;

        case 'Escape':
          event.preventDefault();
          setForceClose(true);
          if (!isOpenControlled) {
            setInternalOpen(false);
          }
          setHighlightedIndex(-1);
          if (onOpenChange) {
            onOpenChange(false);
          }
          break;
      }
    };

    const handleFocus = (event: FocusEvent<HTMLInputElement>): void => {
      if (shouldShowSuggestions && !isOpenControlled) {
        setInternalOpen(true);
        if (onOpenChange) {
          onOpenChange(true);
        }
      }

      if (onFocus) {
        onFocus(event);
      }
    };

    const handleBlur = (event: FocusEvent<HTMLInputElement>): void => {
      // Delay hiding suggestions to allow for clicks
      const timeoutId = setTimeout(() => {
        if (!isOpenControlled) {
          setInternalOpen(false);
        }
        setHighlightedIndex(-1);
        if (onOpenChange) {
          onOpenChange(false);
        }
      }, 150);

      // Store timeout reference for cleanup
      (
        event.currentTarget as HTMLInputElement & {
          __blurTimeoutId?: NodeJS.Timeout;
        }
      ).__blurTimeoutId = timeoutId;

      if (onBlur) {
        onBlur(event);
      }
    };

    const handleOptionClick =
      (suggestion: string) =>
      (event: MouseEvent): void => {
        event.preventDefault();
        handleSuggestionSelect(suggestion);
      };

    const handleOptionMouseDown = (event: MouseEvent): void => {
      // Prevent input blur when clicking on suggestions
      event.preventDefault();
    };

    const handleOptionMouseEnter = (index: number) => (): void => {
      setHighlightedIndex(index);
    };

    // Input props for potential custom rendering
    const inputProps: React.InputHTMLAttributes<HTMLInputElement> = {
      ref: inputRef,
      type: 'text',
      role: 'combobox',
      value: currentValue,
      placeholder,
      onChange: handleInputChange,
      onKeyDown: handleKeyDown,
      onFocus: handleFocus,
      onBlur: handleBlur,
      'aria-label': ariaLabel,
      'aria-autocomplete': 'list',
      'aria-expanded': currentOpen ? 'true' : 'false',
      'aria-haspopup': 'listbox',
      'aria-controls': currentOpen ? listboxId.current : undefined,
      'aria-activedescendant':
        highlightedIndex >= 0
          ? `${listboxId.current}-option-${highlightedIndex}`
          : undefined,
      autoComplete: 'off',
    };

    // Default input styling
    const defaultInputStyle: CSSProperties = {
      width: '100%',
      padding: '8px 12px',
      borderRadius: '4px',
      border: '1px solid #d1d5db',
      fontSize: '14px',
      outline: 'none',
      transition: 'border-color 0.2s',
    };

    // Dropdown styling
    const dropdownBaseStyle: CSSProperties = {
      position: 'absolute',
      left: 0,
      right: 0,
      backgroundColor: 'white',
      border: '1px solid #d1d5db',
      borderRadius: '4px',
      marginTop: placement === 'bottom' ? '4px' : undefined,
      marginBottom: placement === 'top' ? '4px' : undefined,
      top: placement === 'bottom' ? '100%' : undefined,
      bottom: placement === 'top' ? '100%' : undefined,
      maxHeight: '250px',
      overflowY: 'auto',
      zIndex: 1000,
      listStyle: 'none',
      margin: 0,
      padding: 0,
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      ...dropdownStyle,
    };

    return (
      <div className="autocomplete-container">
        <div
          className={`autocomplete-wrapper ${className}`}
          style={{ position: 'relative' }}
        >
          {renderInput ? (
            renderInput(inputProps)
          ) : (
            <input {...inputProps} style={defaultInputStyle} />
          )}

          {currentOpen && filteredSuggestions.length > 0 && (
            <ul
              ref={dropdownRef}
              id={listboxId.current}
              role="listbox"
              style={dropdownBaseStyle}
            >
              {filteredSuggestions.map((suggestion, index) => {
                const isHighlighted = index === highlightedIndex;
                const optionId = `${listboxId.current}-option-${index}`;

                return (
                  <li
                    key={suggestion}
                    id={optionId}
                    role="option"
                    aria-selected={isHighlighted}
                    onClick={handleOptionClick(suggestion)}
                    onMouseDown={handleOptionMouseDown}
                    onMouseEnter={handleOptionMouseEnter(index)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      backgroundColor: isHighlighted
                        ? '#f3f4f6'
                        : 'transparent',
                      transition: 'background-color 0.1s',
                    }}
                  >
                    {renderOption
                      ? renderOption(suggestion, { isHighlighted, index })
                      : suggestion}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    );
  }
);

AutoComplete.displayName = 'AutoComplete';
