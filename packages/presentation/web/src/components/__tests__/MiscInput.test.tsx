import React from 'react';
import { render, screen, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MiscInput } from '../MiscInput';
import { ApplicationContextProvider } from '../../contexts/ApplicationContext';
import { vi } from 'vitest';

describe('MiscInput', () => {
  const mockProps = {
    value: '',
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    onEscape: vi.fn(),
    onNavigateDown: vi.fn(),
    allTags: ['tag1', 'tag2', 'tag3'],
  };

  const renderWithProvider = (ui: React.ReactElement): RenderResult => {
    return render(
      <ApplicationContextProvider>{ui}</ApplicationContextProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders input with default placeholder', () => {
    renderWithProvider(<MiscInput {...mockProps} />);
    expect(
      screen.getByPlaceholderText('Enter tags separated by spaces...')
    ).toBeInTheDocument();
  });

  it('renders input with custom placeholder', () => {
    renderWithProvider(
      <MiscInput {...mockProps} placeholder="Custom placeholder" />
    );
    expect(
      screen.getByPlaceholderText('Custom placeholder')
    ).toBeInTheDocument();
  });

  it('calls onChange when user types', async () => {
    const user = userEvent.setup();
    renderWithProvider(<MiscInput {...mockProps} />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'a');

    expect(mockProps.onChange).toHaveBeenCalledWith('a');
  });

  it('submits tags when Enter is pressed', async () => {
    const user = userEvent.setup();
    renderWithProvider(<MiscInput {...mockProps} value="tag1 tag2" />);

    await user.keyboard('{Enter}');

    expect(mockProps.onSubmit).toHaveBeenCalledWith(['tag1', 'tag2']);
  });

  it('handles Arrow Down navigation', async () => {
    const user = userEvent.setup();
    renderWithProvider(<MiscInput {...mockProps} />);

    await user.keyboard('{ArrowDown}');

    expect(mockProps.onNavigateDown).toHaveBeenCalled();
  });

  it('handles Escape key for clearing content', async () => {
    const user = userEvent.setup();
    renderWithProvider(<MiscInput {...mockProps} value="tag1 tag2" />);

    await user.keyboard('{Escape}');

    expect(mockProps.onChange).toHaveBeenCalledWith('tag1 ');
  });

  it('shows clear button when input has value', () => {
    renderWithProvider(<MiscInput {...mockProps} value="test" />);
    // Now there are multiple buttons (clear + toolbar buttons), so we need to be more specific
    expect(screen.getByTitle('Clear input')).toBeInTheDocument();
  });

  it('hides clear button when input is empty', () => {
    renderWithProvider(<MiscInput {...mockProps} value="" />);
    expect(screen.queryByTitle('Clear input')).not.toBeInTheDocument();
  });

  it('clears input when clear button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProvider(<MiscInput {...mockProps} value="test" />);

    const clearButton = screen.getByTitle('Clear input');
    await user.click(clearButton);

    expect(mockProps.onChange).toHaveBeenCalledWith('');
  });
});
