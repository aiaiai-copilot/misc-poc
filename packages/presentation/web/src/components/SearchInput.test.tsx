import React, { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchInput } from './SearchInput';

describe('SearchInput', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Basic rendering and accessibility', () => {
    it('renders input with correct accessibility attributes', () => {
      render(<SearchInput placeholder="Search..." />);

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('type', 'text');
      expect(input).toHaveAttribute('placeholder', 'Search...');
      expect(input).toHaveAttribute('aria-label', 'Search input');
    });

    it('supports custom aria-label', () => {
      render(<SearchInput ariaLabel="Custom search" />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-label', 'Custom search');
    });

    it('renders with custom className', () => {
      render(<SearchInput className="custom-search" />);

      const container = screen.getByRole('textbox').parentElement;
      expect(container).toHaveClass('custom-search');
    });
  });

  describe('Controlled mode', () => {
    it('displays controlled value', () => {
      render(<SearchInput value="test query" />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('test query');
    });

    it('calls onChange immediately on input', async () => {
      const onChange = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<SearchInput value="" onChange={onChange} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'a');

      expect(onChange).toHaveBeenCalledWith('a');
    });

    it('calls onSearch after debounce delay', async () => {
      const onSearch = jest.fn();
      const onChange = jest.fn();
      let controlledValue = '';

      const TestComponent = (): JSX.Element => (
        <SearchInput
          value={controlledValue}
          onChange={(val) => {
            controlledValue = val;
            onChange(val);
          }}
          onSearch={onSearch}
        />
      );

      const { rerender } = render(<TestComponent />);

      // const input = screen.getByRole('textbox');

      // Simulate controlled updates
      controlledValue = 'test';
      rerender(<TestComponent />);

      expect(onSearch).not.toHaveBeenCalled();

      jest.advanceTimersByTime(300);

      expect(onSearch).toHaveBeenCalledWith('test');
    });
  });

  describe('Uncontrolled mode', () => {
    it('manages its own state', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<SearchInput defaultValue="initial" />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('initial');

      await user.clear(input);
      await user.type(input, 'new value');

      expect(input).toHaveValue('new value');
    });

    it('calls onSearch after debounce in uncontrolled mode', async () => {
      const onSearch = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<SearchInput onSearch={onSearch} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'uncontrolled');

      jest.advanceTimersByTime(300);

      expect(onSearch).toHaveBeenCalledWith('uncontrolled');
    });
  });

  describe('Debouncing behavior', () => {
    it('debounces search calls with default 300ms delay', async () => {
      const onSearch = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<SearchInput onSearch={onSearch} />);

      const input = screen.getByRole('textbox');

      await user.type(input, 'a');
      jest.advanceTimersByTime(100);
      await user.type(input, 'b');
      jest.advanceTimersByTime(100);
      await user.type(input, 'c');

      expect(onSearch).not.toHaveBeenCalled();

      jest.advanceTimersByTime(300);

      expect(onSearch).toHaveBeenCalledTimes(1);
      expect(onSearch).toHaveBeenCalledWith('abc');
    });

    it('supports custom debounce delay', async () => {
      const onSearch = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<SearchInput onSearch={onSearch} debounceMs={500} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'test');

      jest.advanceTimersByTime(300);
      expect(onSearch).not.toHaveBeenCalled();

      jest.advanceTimersByTime(200);
      expect(onSearch).toHaveBeenCalledWith('test');
    });

    it('cancels previous debounce when new input arrives', async () => {
      const onSearch = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<SearchInput onSearch={onSearch} />);

      const input = screen.getByRole('textbox');

      await user.type(input, 'first');
      jest.advanceTimersByTime(200);

      await user.clear(input);
      await user.type(input, 'second');
      jest.advanceTimersByTime(300);

      expect(onSearch).toHaveBeenCalledTimes(1);
      expect(onSearch).toHaveBeenCalledWith('second');
    });
  });

  describe('Keyboard shortcuts', () => {
    it('triggers immediate search on Enter key', async () => {
      const onSearch = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<SearchInput onSearch={onSearch} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'enter search');
      await user.keyboard('{Enter}');

      expect(onSearch).toHaveBeenCalledWith('enter search');
    });

    it('clears input on Escape key', async () => {
      const onClear = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<SearchInput defaultValue="clear me" onClear={onClear} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('clear me');

      // Focus the input first
      await user.click(input);
      await user.keyboard('{Escape}');

      expect(input).toHaveValue('');
      expect(onClear).toHaveBeenCalled();
    });

    it('handles Tab key for navigation', async () => {
      const onFocus = jest.fn();
      const onBlur = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <div>
          <input data-testid="before" />
          <SearchInput onFocus={onFocus} onBlur={onBlur} />
          <input data-testid="after" />
        </div>
      );

      const beforeInput = screen.getByTestId('before');
      const searchInput = screen.getByRole('textbox', { name: /search/i });
      const afterInput = screen.getByTestId('after');

      beforeInput.focus();
      await user.tab();

      expect(searchInput).toHaveFocus();
      expect(onFocus).toHaveBeenCalled();

      await user.tab();

      expect(afterInput).toHaveFocus();
      expect(onBlur).toHaveBeenCalled();
    });

    it('supports arrow key navigation in auto-complete mode', async () => {
      const onArrowDown = jest.fn();
      const onArrowUp = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <SearchInput
          onArrowDown={onArrowDown}
          onArrowUp={onArrowUp}
          autoComplete={true}
        />
      );

      const input = screen.getByRole('textbox');
      input.focus();

      await user.keyboard('{ArrowDown}');
      expect(onArrowDown).toHaveBeenCalled();

      await user.keyboard('{ArrowUp}');
      expect(onArrowUp).toHaveBeenCalled();
    });
  });

  describe('Loading state', () => {
    it('shows loading indicator when isLoading is true', () => {
      render(<SearchInput isLoading={true} />);

      const loadingIndicator = screen.getByLabelText('Loading');
      expect(loadingIndicator).toBeInTheDocument();
    });

    it('hides loading indicator when isLoading is false', () => {
      render(<SearchInput isLoading={false} />);

      const loadingIndicator = screen.queryByLabelText('Loading');
      expect(loadingIndicator).not.toBeInTheDocument();
    });

    it('disables input when isLoading is true', () => {
      render(<SearchInput isLoading={true} />);

      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
    });
  });

  describe('Auto-completion integration', () => {
    it('shows auto-complete dropdown when autoComplete is enabled', async () => {
      const suggestions = ['apple', 'application', 'apply'];
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<SearchInput autoComplete={true} suggestions={suggestions} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'app');

      const dropdown = screen.getByRole('listbox');
      expect(dropdown).toBeInTheDocument();

      suggestions.forEach((suggestion) => {
        expect(
          screen.getByRole('option', { name: suggestion })
        ).toBeInTheDocument();
      });
    });

    it('filters suggestions based on input', async () => {
      const suggestions = ['apple', 'banana', 'application'];
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<SearchInput autoComplete={true} suggestions={suggestions} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'app');

      expect(screen.getByRole('option', { name: 'apple' })).toBeInTheDocument();
      expect(
        screen.getByRole('option', { name: 'application' })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('option', { name: 'banana' })
      ).not.toBeInTheDocument();
    });

    it('selects suggestion on click', async () => {
      const onSelect = jest.fn();
      const suggestions = ['apple', 'application'];
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <SearchInput
          autoComplete={true}
          suggestions={suggestions}
          onSelect={onSelect}
        />
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'app');

      const appleOption = screen.getByRole('option', { name: 'apple' });
      await user.click(appleOption);

      expect(onSelect).toHaveBeenCalledWith('apple');
      expect(input).toHaveValue('apple');
    });
  });

  describe('Ref forwarding', () => {
    it('forwards ref to input element', () => {
      const ref = createRef<HTMLInputElement>();

      render(<SearchInput ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLInputElement);
      expect(ref.current).toHaveAttribute('type', 'text');
    });

    it('allows programmatic focus via ref', () => {
      const ref = createRef<HTMLInputElement>();

      render(<SearchInput ref={ref} />);

      ref.current?.focus();

      expect(ref.current).toHaveFocus();
    });
  });

  describe('Error states', () => {
    it('shows error state when hasError is true', () => {
      render(<SearchInput hasError={true} errorMessage="Invalid input" />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'true');

      const errorMessage = screen.getByText('Invalid input');
      expect(errorMessage).toBeInTheDocument();
    });

    it('associates error message with input via aria-describedby', () => {
      render(<SearchInput hasError={true} errorMessage="Invalid input" />);

      const input = screen.getByRole('textbox');
      const errorMessage = screen.getByText('Invalid input');

      expect(input).toHaveAttribute('aria-describedby', errorMessage.id);
    });
  });

  describe('Performance optimizations', () => {
    it('does not trigger search for empty strings', async () => {
      const onSearch = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<SearchInput onSearch={onSearch} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'test');

      // Allow the search for "test" to trigger
      jest.advanceTimersByTime(300);
      expect(onSearch).toHaveBeenCalledTimes(1);
      expect(onSearch).toHaveBeenCalledWith('test');

      // Now clear and verify no additional search is triggered
      await user.clear(input);
      jest.advanceTimersByTime(300);

      // Should still be 1 call, no additional call for empty string
      expect(onSearch).toHaveBeenCalledTimes(1);
    });

    it('does not trigger search for whitespace-only strings', async () => {
      const onSearch = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<SearchInput onSearch={onSearch} />);

      const input = screen.getByRole('textbox');
      await user.type(input, '   ');

      jest.advanceTimersByTime(300);

      expect(onSearch).not.toHaveBeenCalled();
    });
  });
});
