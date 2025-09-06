import React, { createRef, useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AutoComplete } from './AutoComplete';

describe('AutoComplete', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  const mockSuggestions = [
    'JavaScript',
    'TypeScript',
    'Python',
    'Java',
    'React',
    'Angular',
    'Vue.js',
    'Node.js',
    'Express.js',
    'Django',
    'Flask',
    'Spring Boot',
    'MongoDB',
    'PostgreSQL',
    'MySQL'
  ];

  describe('Basic rendering and accessibility', () => {
    it('renders input with correct accessibility attributes', () => {
      render(<AutoComplete suggestions={[]} />);

      const input = screen.getByRole('combobox');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('type', 'text');
      expect(input).toHaveAttribute('aria-autocomplete', 'list');
      expect(input).toHaveAttribute('aria-expanded', 'false');
      expect(input).toHaveAttribute('aria-haspopup', 'listbox');
    });

    it('supports custom placeholder and aria-label', () => {
      render(
        <AutoComplete 
          suggestions={[]} 
          placeholder="Search tags..." 
          ariaLabel="Tag search input"
        />
      );

      const input = screen.getByRole('combobox');
      expect(input).toHaveAttribute('placeholder', 'Search tags...');
      expect(input).toHaveAttribute('aria-label', 'Tag search input');
    });

    it('renders with custom className', () => {
      render(<AutoComplete suggestions={[]} className="custom-autocomplete" />);

      const container = screen.getByRole('combobox').parentElement;
      expect(container).toHaveClass('custom-autocomplete');
    });
  });

  describe('Fuzzy matching', () => {
    it('performs fuzzy matching on suggestions', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<AutoComplete suggestions={mockSuggestions} />);

      const input = screen.getByRole('combobox');
      await user.type(input, 'js');

      // Should match JavaScript, TypeScript, Vue.js, Node.js, Express.js
      expect(screen.getByText('JavaScript')).toBeInTheDocument();
      expect(screen.getByText('TypeScript')).toBeInTheDocument();
      expect(screen.getByText('Vue.js')).toBeInTheDocument();
      expect(screen.getByText('Node.js')).toBeInTheDocument();
      expect(screen.getByText('Express.js')).toBeInTheDocument();
      
      expect(screen.queryByText('Python')).not.toBeInTheDocument();
      expect(screen.queryByText('Java')).not.toBeInTheDocument();
    });

    it('performs case-insensitive fuzzy matching', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<AutoComplete suggestions={mockSuggestions} />);

      const input = screen.getByRole('combobox');
      await user.type(input, 'REACT');

      expect(screen.getByText('React')).toBeInTheDocument();
    });

    it('handles partial character matching with fuzzy logic', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<AutoComplete suggestions={mockSuggestions} />);

      const input = screen.getByRole('combobox');
      await user.type(input, 'pytn');

      expect(screen.getByText('Python')).toBeInTheDocument();
    });

    it('prioritizes exact prefix matches over fuzzy matches', async () => {
      const suggestions = ['JavaScript', 'Java', 'Jasmine', 'Jest'];
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<AutoComplete suggestions={suggestions} />);

      const input = screen.getByRole('combobox');
      await user.type(input, 'Ja');

      const listbox = screen.getByRole('listbox');
      const options = within(listbox).getAllByRole('option');
      
      // First options should be exact prefix matches, with shorter strings first
      expect(options[0]).toHaveTextContent('Java');
      expect(options[1]).toHaveTextContent('Jasmine');
      expect(options[2]).toHaveTextContent('JavaScript');
    });

    it('limits suggestions to maxSuggestions prop', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<AutoComplete suggestions={mockSuggestions} maxSuggestions={3} />);

      const input = screen.getByRole('combobox');
      await user.type(input, 'a');

      const listbox = screen.getByRole('listbox');
      const options = within(listbox).getAllByRole('option');
      
      expect(options).toHaveLength(3);
    });
  });

  describe('Keyboard navigation', () => {
    it('navigates suggestions with Arrow keys', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<AutoComplete suggestions={['Apple', 'Banana', 'Cherry']} />);

      const input = screen.getByRole('combobox');
      await user.type(input, 'a');

      // ArrowDown should highlight first suggestion
      await user.keyboard('{ArrowDown}');
      
      const listbox = screen.getByRole('listbox');
      const firstOption = within(listbox).getAllByRole('option')[0];
      expect(firstOption).toHaveAttribute('aria-selected', 'true');

      // ArrowDown again should highlight second suggestion
      await user.keyboard('{ArrowDown}');
      const secondOption = within(listbox).getAllByRole('option')[1];
      expect(secondOption).toHaveAttribute('aria-selected', 'true');
      expect(firstOption).toHaveAttribute('aria-selected', 'false');

      // ArrowUp should go back to first
      await user.keyboard('{ArrowUp}');
      expect(firstOption).toHaveAttribute('aria-selected', 'true');
      expect(secondOption).toHaveAttribute('aria-selected', 'false');
    });

    it('wraps navigation at boundaries', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<AutoComplete suggestions={['Apple', 'Banana']} />);

      const input = screen.getByRole('combobox');
      await user.type(input, 'a');

      const listbox = screen.getByRole('listbox');
      const options = within(listbox).getAllByRole('option');

      // Navigate to last option
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      expect(options[1]).toHaveAttribute('aria-selected', 'true');

      // ArrowDown should wrap to first
      await user.keyboard('{ArrowDown}');
      expect(options[0]).toHaveAttribute('aria-selected', 'true');

      // ArrowUp should wrap to last
      await user.keyboard('{ArrowUp}');
      expect(options[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('selects highlighted suggestion with Enter', async () => {
      const onSelect = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<AutoComplete suggestions={['Apple', 'Banana']} onSelect={onSelect} />);

      const input = screen.getByRole('combobox');
      await user.type(input, 'a');

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(onSelect).toHaveBeenCalledWith('Apple');
      expect(input).toHaveValue('Apple');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('selects highlighted suggestion with Tab', async () => {
      const onSelect = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<AutoComplete suggestions={['Apple', 'Banana']} onSelect={onSelect} />);

      const input = screen.getByRole('combobox');
      await user.type(input, 'a');

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Tab}');

      expect(onSelect).toHaveBeenCalledWith('Apple');
      expect(input).toHaveValue('Apple');
    });

    it('closes suggestions with Escape', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<AutoComplete suggestions={['Apple', 'Banana']} />);

      const input = screen.getByRole('combobox');
      await user.type(input, 'a');

      expect(screen.getByRole('listbox')).toBeInTheDocument();

      await user.keyboard('{Escape}');

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(input).toHaveAttribute('aria-expanded', 'false');
    });

    it('prevents default behavior for navigation keys', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<AutoComplete suggestions={['Apple']} />);

      const input = screen.getByRole('combobox');
      await user.type(input, 'a');

      // Should not cause cursor to move in input
      const selectionStart = input.selectionStart;
      await user.keyboard('{ArrowDown}');
      expect(input.selectionStart).toBe(selectionStart);
    });
  });

  describe('Click selection', () => {
    it('selects suggestion when clicked', async () => {
      const onSelect = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<AutoComplete suggestions={['Apple', 'Banana']} onSelect={onSelect} />);

      const input = screen.getByRole('combobox');
      await user.type(input, 'a');

      const bananaOption = screen.getByText('Banana');
      await user.click(bananaOption);

      expect(onSelect).toHaveBeenCalledWith('Banana');
      expect(input).toHaveValue('Banana');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('prevents input blur when clicking suggestions', async () => {
      const onBlur = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<AutoComplete suggestions={['Apple']} onBlur={onBlur} />);

      const input = screen.getByRole('combobox');
      await user.type(input, 'a');

      const appleOption = screen.getByText('Apple');
      await user.click(appleOption);

      // onBlur should not be called due to preventDefault on mousedown
      expect(onBlur).not.toHaveBeenCalled();
    });

    it('highlights suggestion on mouse enter', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<AutoComplete suggestions={['Apple', 'Banana']} />);

      const input = screen.getByRole('combobox');
      await user.type(input, 'a');

      const bananaOption = screen.getByText('Banana');
      await user.hover(bananaOption);

      expect(bananaOption.closest('li')).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Performance optimization', () => {
    it('handles large suggestion lists efficiently', async () => {
      const largeSuggestions = Array.from({ length: 10000 }, (_, i) => `Item ${i}`);
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const startTime = performance.now();
      render(<AutoComplete suggestions={largeSuggestions} maxSuggestions={100} />);

      const input = screen.getByRole('combobox');
      await user.type(input, '5');

      const endTime = performance.now();
      
      // Should render within reasonable time (less than 100ms for this simple case)
      expect(endTime - startTime).toBeLessThan(100);

      const listbox = screen.getByRole('listbox');
      const options = within(listbox).getAllByRole('option');
      
      // Should limit to maxSuggestions
      expect(options.length).toBeLessThanOrEqual(100);
    });

    it('debounces search with custom delay', async () => {
      const onSearch = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<AutoComplete suggestions={[]} onSearch={onSearch} debounceMs={500} />);

      const input = screen.getByRole('combobox');
      await user.type(input, 'test');

      jest.advanceTimersByTime(300);
      expect(onSearch).not.toHaveBeenCalled();

      jest.advanceTimersByTime(200);
      expect(onSearch).toHaveBeenCalledWith('test');
    });

    it('cancels previous search on new input', async () => {
      const onSearch = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<AutoComplete suggestions={[]} onSearch={onSearch} />);

      const input = screen.getByRole('combobox');
      await user.type(input, 'first');
      jest.advanceTimersByTime(200);

      await user.clear(input);
      await user.type(input, 'second');
      jest.advanceTimersByTime(300);

      expect(onSearch).toHaveBeenCalledTimes(1);
      expect(onSearch).toHaveBeenCalledWith('second');
    });

    it('virtualizes long suggestion lists', async () => {
      const largeSuggestions = Array.from({ length: 1000 }, (_, i) => `Suggestion ${i}`);
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<AutoComplete suggestions={largeSuggestions} />);

      const input = screen.getByRole('combobox');
      await user.type(input, 's');

      const listbox = screen.getByRole('listbox');
      // Should have scroll container for virtualization
      expect(listbox).toHaveStyle('max-height: 250px');
      expect(listbox).toHaveStyle('overflow-y: auto');
    });
  });

  describe('Integration with SearchInput', () => {
    it('accepts SearchInput as a render prop', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <AutoComplete 
          suggestions={['Apple', 'Banana']}
          renderInput={(props) => (
            <div data-testid="custom-input">
              <input {...props} placeholder="Custom placeholder" />
            </div>
          )}
        />
      );

      const customInput = screen.getByTestId('custom-input');
      expect(customInput).toBeInTheDocument();

      const input = screen.getByPlaceholderText('Custom placeholder');
      await user.type(input, 'a');

      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('works with external SearchInput component', async () => {
      const onSelect = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const TestComponent = (): JSX.Element => {
        const [value, setValue] = useState('');
        const [showSuggestions, setShowSuggestions] = useState(false);

        return (
          <AutoComplete
            suggestions={['Apple', 'Banana']}
            value={value}
            onChange={setValue}
            onSelect={(selection) => {
              onSelect(selection);
              setValue(selection);
              setShowSuggestions(false);
            }}
            open={showSuggestions}
            onOpenChange={setShowSuggestions}
          />
        );
      };

      render(<TestComponent />);

      const input = screen.getByRole('combobox');
      await user.type(input, 'a');
      
      const appleOption = screen.getByText('Apple');
      await user.click(appleOption);

      expect(onSelect).toHaveBeenCalledWith('Apple');
    });
  });

  describe('Custom styling and positioning', () => {
    it('applies custom styles to dropdown', () => {
      render(
        <AutoComplete 
          suggestions={['Apple']}
          value="a"
          dropdownStyle={{ backgroundColor: 'red', zIndex: 9999 }}
        />
      );

      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveStyle('background-color: rgb(255, 0, 0)');
      expect(listbox).toHaveStyle('z-index: 9999');
    });

    it('supports custom positioning', () => {
      render(
        <AutoComplete 
          suggestions={['Apple']}
          value="a"
          placement="top"
        />
      );

      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveStyle('bottom: 100%');
    });

    it('applies custom option styling', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <AutoComplete 
          suggestions={['Apple', 'Banana']}
          renderOption={(option, { isHighlighted }) => (
            <div 
              data-testid={`option-${option}`}
              style={{ 
                backgroundColor: isHighlighted ? 'blue' : 'white',
                fontWeight: 'bold'
              }}
            >
              {option}
            </div>
          )}
        />
      );

      const input = screen.getByRole('combobox');
      await user.type(input, 'a');

      const appleOption = screen.getByTestId('option-Apple');
      expect(appleOption).toHaveStyle('font-weight: bold');

      await user.keyboard('{ArrowDown}');
      expect(appleOption).toHaveStyle('background-color: rgb(0, 0, 255)');
    });
  });

  describe('Controlled vs Uncontrolled', () => {
    it('works in controlled mode', async () => {
      const onChange = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<AutoComplete suggestions={['Apple']} value="" onChange={onChange} />);

      const input = screen.getByRole('combobox');
      await user.type(input, 'a');

      expect(onChange).toHaveBeenCalledWith('a');
    });

    it('works in uncontrolled mode with defaultValue', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<AutoComplete suggestions={['Apple']} defaultValue="initial" />);

      const input = screen.getByRole('combobox');
      expect(input).toHaveValue('initial');

      await user.clear(input);
      await user.type(input, 'new');
      expect(input).toHaveValue('new');
    });
  });

  describe('Error handling', () => {
    it('handles empty suggestions gracefully', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<AutoComplete suggestions={[]} />);

      const input = screen.getByRole('combobox');
      await user.type(input, 'test');

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('handles null/undefined suggestions', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<AutoComplete suggestions={null as string[]} />);

      const input = screen.getByRole('combobox');
      await user.type(input, 'test');

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('handles malformed suggestion objects', async () => {
      const malformedSuggestions = [null, undefined, '', 'valid', 123] as unknown as string[];
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<AutoComplete suggestions={malformedSuggestions} />);

      const input = screen.getByRole('combobox');
      await user.type(input, 'v');

      // Should only show valid string suggestions
      expect(screen.getByText('valid')).toBeInTheDocument();
      expect(screen.queryByText('123')).not.toBeInTheDocument();
    });
  });

  describe('Ref forwarding', () => {
    it('forwards ref to input element', () => {
      const ref = createRef<HTMLInputElement>();

      render(<AutoComplete suggestions={[]} ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLInputElement);
      expect(ref.current).toHaveAttribute('role', 'combobox');
    });

    it('allows programmatic focus via ref', () => {
      const ref = createRef<HTMLInputElement>();

      render(<AutoComplete suggestions={[]} ref={ref} />);

      ref.current?.focus();

      expect(ref.current).toHaveFocus();
    });
  });

  describe('Event callbacks', () => {
    it('calls onFocus and onBlur events', async () => {
      const onFocus = jest.fn();
      const onBlur = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <div>
          <AutoComplete suggestions={[]} onFocus={onFocus} onBlur={onBlur} />
          <button>Outside</button>
        </div>
      );

      const input = screen.getByRole('combobox');
      const button = screen.getByText('Outside');

      await user.click(input);
      expect(onFocus).toHaveBeenCalled();

      await user.click(button);
      expect(onBlur).toHaveBeenCalled();
    });

    it('calls onOpenChange when suggestions open/close', async () => {
      const onOpenChange = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<AutoComplete suggestions={['Apple']} onOpenChange={onOpenChange} />);

      const input = screen.getByRole('combobox');
      await user.type(input, 'a');

      expect(onOpenChange).toHaveBeenCalledWith(true);

      await user.keyboard('{Escape}');

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});