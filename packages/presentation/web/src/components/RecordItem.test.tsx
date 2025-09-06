import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecordItem } from './RecordItem';
import { RecordDTO } from '@misc-poc/application';

const mockRecord: RecordDTO = {
  id: '1',
  content: 'Test record content',
  tagIds: ['tag1', 'tag2', 'tag3'],
  createdAt: '2023-01-01T10:00:00Z',
  updatedAt: '2023-01-01T11:00:00Z',
};

describe('RecordItem', () => {
  describe('Basic rendering', () => {
    it('renders record content and metadata', () => {
      render(<RecordItem record={mockRecord} />);
      
      expect(screen.getByText('Test record content')).toBeInTheDocument();
      expect(screen.getByText('3 tags')).toBeInTheDocument();
      expect(screen.getByText(/created/i)).toBeInTheDocument();
      expect(screen.getByText(/updated/i)).toBeInTheDocument();
    });

    it('renders with custom className', () => {
      const { container } = render(
        <RecordItem record={mockRecord} className="custom-item" />
      );
      
      const itemContainer = container.querySelector('.custom-item');
      expect(itemContainer).toBeInTheDocument();
    });

    it('formats dates correctly', () => {
      render(<RecordItem record={mockRecord} />);
      
      // Should show relative time for recent dates
      expect(screen.getByText(/created/i)).toBeInTheDocument();
      expect(screen.getByText(/updated/i)).toBeInTheDocument();
    });

    it('handles long content with truncation', () => {
      const longContentRecord = {
        ...mockRecord,
        content: 'This is a very long record content that should be truncated when displayed in the list to prevent layout issues and maintain good user experience across different screen sizes',
      };
      
      render(<RecordItem record={longContentRecord} maxContentLength={50} />);
      
      const content = screen.getByTestId('record-content');
      expect(content.textContent?.length).toBeLessThanOrEqual(53); // 50 + "..."
      expect(screen.getByText(/\.\.\./)).toBeInTheDocument();
    });
  });

  describe('Action buttons', () => {
    it('renders edit and delete actions when callbacks provided', () => {
      const onEdit = jest.fn();
      const onDelete = jest.fn();
      
      render(<RecordItem record={mockRecord} onEdit={onEdit} onDelete={onDelete} />);
      
      const editButton = screen.getByRole('button', { name: /edit/i });
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      
      expect(editButton).toBeInTheDocument();
      expect(deleteButton).toBeInTheDocument();
    });

    it('calls onEdit when edit button is clicked', async () => {
      const onEdit = jest.fn();
      const user = userEvent.setup();
      
      render(<RecordItem record={mockRecord} onEdit={onEdit} />);
      
      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);
      
      expect(onEdit).toHaveBeenCalledWith(mockRecord);
    });

    it('calls onDelete when delete button is clicked', async () => {
      const onDelete = jest.fn();
      const user = userEvent.setup();
      
      render(<RecordItem record={mockRecord} onDelete={onDelete} />);
      
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);
      
      expect(onDelete).toHaveBeenCalledWith(mockRecord);
    });

    it('shows confirmation dialog for delete action', async () => {
      const onDelete = jest.fn();
      const user = userEvent.setup();
      
      render(
        <RecordItem 
          record={mockRecord} 
          onDelete={onDelete} 
          requireDeleteConfirmation 
        />
      );
      
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);
      
      const confirmDialog = screen.getByRole('dialog');
      expect(confirmDialog).toBeInTheDocument();
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
      
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);
      
      expect(onDelete).toHaveBeenCalledWith(mockRecord);
    });

    it('hides actions when disabled', () => {
      render(<RecordItem record={mockRecord} actionsDisabled />);
      
      const editButton = screen.queryByRole('button', { name: /edit/i });
      const deleteButton = screen.queryByRole('button', { name: /delete/i });
      
      expect(editButton).not.toBeInTheDocument();
      expect(deleteButton).not.toBeInTheDocument();
    });

    it('supports custom actions', async () => {
      const onCustomAction = jest.fn();
      const user = userEvent.setup();
      
      const customActions = [
        {
          label: 'Duplicate',
          icon: '📋',
          onClick: onCustomAction,
        },
      ];
      
      render(
        <RecordItem record={mockRecord} customActions={customActions} />
      );
      
      const customButton = screen.getByRole('button', { name: /duplicate/i });
      expect(customButton).toBeInTheDocument();
      
      await user.click(customButton);
      expect(onCustomAction).toHaveBeenCalledWith(mockRecord);
    });
  });

  describe('Selection state', () => {
    it('shows selected state visually', () => {
      const { container } = render(
        <RecordItem record={mockRecord} isSelected />
      );
      
      const itemContainer = container.firstChild as HTMLElement;
      expect(itemContainer).toHaveClass('selected');
      expect(itemContainer).toHaveAttribute('aria-selected', 'true');
    });

    it('handles selection callback', async () => {
      const onSelect = jest.fn();
      const user = userEvent.setup();
      
      render(<RecordItem record={mockRecord} onSelect={onSelect} />);
      
      const itemContainer = screen.getByRole('button', { name: /record item/i });
      await user.click(itemContainer);
      
      expect(onSelect).toHaveBeenCalledWith(mockRecord);
    });

    it('prevents selection when disabled', async () => {
      const onSelect = jest.fn();
      const user = userEvent.setup();
      
      render(<RecordItem record={mockRecord} onSelect={onSelect} disabled />);
      
      const itemContainer = screen.getByRole('button', { name: /record item/i });
      expect(itemContainer).toBeDisabled();
      
      await user.click(itemContainer);
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard interactions', () => {
    it('supports keyboard navigation for actions', async () => {
      const onEdit = jest.fn();
      const onDelete = jest.fn();
      const user = userEvent.setup();
      
      render(<RecordItem record={mockRecord} onEdit={onEdit} onDelete={onDelete} />);
      
      const itemContainer = screen.getByRole('button', { name: /record item/i });
      itemContainer.focus();
      
      // Tab to edit button
      await user.keyboard('{Tab}');
      const editButton = screen.getByRole('button', { name: /edit/i });
      expect(editButton).toHaveFocus();
      
      // Enter to trigger edit
      await user.keyboard('{Enter}');
      expect(onEdit).toHaveBeenCalledWith(mockRecord);
    });

    it('supports Enter key for selection', async () => {
      const onSelect = jest.fn();
      const user = userEvent.setup();
      
      render(<RecordItem record={mockRecord} onSelect={onSelect} />);
      
      const itemContainer = screen.getByRole('button', { name: /record item/i });
      itemContainer.focus();
      
      await user.keyboard('{Enter}');
      expect(onSelect).toHaveBeenCalledWith(mockRecord);
    });

    it('supports Space key for selection', async () => {
      const onSelect = jest.fn();
      const user = userEvent.setup();
      
      render(<RecordItem record={mockRecord} onSelect={onSelect} />);
      
      const itemContainer = screen.getByRole('button', { name: /record item/i });
      itemContainer.focus();
      
      await user.keyboard(' ');
      expect(onSelect).toHaveBeenCalledWith(mockRecord);
    });

    it('supports Escape key to cancel edit mode', async () => {
      const onEdit = jest.fn();
      const user = userEvent.setup();
      
      render(<RecordItem record={mockRecord} onEdit={onEdit} />);
      
      const editButton = screen.getByRole('button', { name: /edit/i });
      editButton.focus();
      
      await user.keyboard('{Escape}');
      
      const itemContainer = screen.getByRole('button', { name: /record item/i });
      expect(itemContainer).toHaveFocus();
    });
  });

  describe('Tag display', () => {
    it('shows tag count when tags are present', () => {
      render(<RecordItem record={mockRecord} />);
      
      expect(screen.getByText('3 tags')).toBeInTheDocument();
    });

    it('shows expanded tags when requested', () => {
      render(<RecordItem record={mockRecord} showExpandedTags />);
      
      expect(screen.getByText('tag1')).toBeInTheDocument();
      expect(screen.getByText('tag2')).toBeInTheDocument();
      expect(screen.getByText('tag3')).toBeInTheDocument();
    });

    it('handles records with no tags', () => {
      const noTagsRecord = { ...mockRecord, tagIds: [] };
      
      render(<RecordItem record={noTagsRecord} />);
      
      expect(screen.getByText('No tags')).toBeInTheDocument();
    });

    it('truncates long tag lists', () => {
      const manyTagsRecord = {
        ...mockRecord,
        tagIds: Array.from({ length: 10 }, (_, i) => `tag${i}`),
      };
      
      render(<RecordItem record={manyTagsRecord} showExpandedTags />);
      
      // Should show max tags plus "and X more"
      expect(screen.getByText(/and \d+ more/)).toBeInTheDocument();
    });

    it('allows tag clicking for filtering', async () => {
      const onTagClick = jest.fn();
      const user = userEvent.setup();
      
      render(
        <RecordItem 
          record={mockRecord} 
          showExpandedTags 
          onTagClick={onTagClick} 
        />
      );
      
      const tagButton = screen.getByRole('button', { name: 'tag1' });
      await user.click(tagButton);
      
      expect(onTagClick).toHaveBeenCalledWith('tag1');
    });
  });

  describe('Loading and disabled states', () => {
    it('shows loading state during async operations', () => {
      render(<RecordItem record={mockRecord} isLoading />);
      
      const loadingIndicator = screen.getByRole('status', { name: /loading/i });
      expect(loadingIndicator).toBeInTheDocument();
      
      const editButton = screen.getByRole('button', { name: /edit/i });
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      
      expect(editButton).toBeDisabled();
      expect(deleteButton).toBeDisabled();
    });

    it('shows disabled state correctly', () => {
      render(<RecordItem record={mockRecord} disabled />);
      
      const itemContainer = screen.getByRole('button', { name: /record item/i });
      expect(itemContainer).toBeDisabled();
      expect(itemContainer).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('Responsive layout', () => {
    it('adapts layout for mobile screens', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      
      const { container } = render(<RecordItem record={mockRecord} />);
      
      const mobileLayout = container.querySelector('[data-layout="mobile"]');
      expect(mobileLayout).toBeInTheDocument();
    });

    it('uses desktop layout for larger screens', () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });
      
      const { container } = render(<RecordItem record={mockRecord} />);
      
      const desktopLayout = container.querySelector('[data-layout="desktop"]');
      expect(desktopLayout).toBeInTheDocument();
    });

    it('adjusts action button layout on narrow screens', () => {
      // Mock narrow screen
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 320,
      });
      
      render(<RecordItem record={mockRecord} />);
      
      // Actions should be in a dropdown menu on very narrow screens
      const moreActionsButton = screen.getByRole('button', { name: /more actions/i });
      expect(moreActionsButton).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<RecordItem record={mockRecord} />);
      
      const itemContainer = screen.getByRole('button', { name: /record item/i });
      expect(itemContainer).toHaveAttribute('aria-describedby');
      expect(itemContainer).toHaveAttribute('aria-labelledby');
    });

    it('provides screen reader descriptions', () => {
      render(<RecordItem record={mockRecord} />);
      
      const description = screen.getByRole('region', { name: /record details/i });
      expect(description).toBeInTheDocument();
      expect(description).toHaveTextContent(/created.*updated.*tags/i);
    });

    it('announces selection changes to screen readers', () => {
      const { rerender } = render(
        <RecordItem record={mockRecord} isSelected={false} />
      );
      
      rerender(<RecordItem record={mockRecord} isSelected={true} />);
      
      const announcement = screen.getByRole('status');
      expect(announcement).toHaveTextContent(/record selected/i);
    });

    it('supports high contrast mode', () => {
      // Mock high contrast media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });
      
      const { container } = render(<RecordItem record={mockRecord} />);
      
      const highContrastElement = container.querySelector('[data-high-contrast="true"]');
      expect(highContrastElement).toBeInTheDocument();
    });
  });

  describe('Error handling', () => {
    it('handles invalid dates gracefully', () => {
      const invalidDateRecord = {
        ...mockRecord,
        createdAt: 'invalid-date',
        updatedAt: 'another-invalid-date',
      };
      
      render(<RecordItem record={invalidDateRecord} />);
      
      // Should show fallback text for invalid dates
      expect(screen.getByText(/date unavailable/i)).toBeInTheDocument();
    });

    it('handles missing content gracefully', () => {
      const missingContentRecord = {
        ...mockRecord,
        // @ts-expect-error Testing error handling
        content: undefined,
      };
      
      render(<RecordItem record={missingContentRecord} />);
      
      expect(screen.getByText(/no content available/i)).toBeInTheDocument();
    });

    it('handles action errors gracefully', async () => {
      const onEdit = jest.fn().mockRejectedValue(new Error('Edit failed'));
      const user = userEvent.setup();
      
      render(<RecordItem record={mockRecord} onEdit={onEdit} />);
      
      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);
      
      const errorMessage = await screen.findByRole('alert');
      expect(errorMessage).toHaveTextContent(/edit failed/i);
    });
  });

  describe('Performance', () => {
    it('memoizes rendering when props do not change', () => {
      const onEdit = jest.fn();
      const onDelete = jest.fn();
      
      const { rerender } = render(
        <RecordItem record={mockRecord} onEdit={onEdit} onDelete={onDelete} />
      );
      
      // Re-render with same props
      rerender(
        <RecordItem record={mockRecord} onEdit={onEdit} onDelete={onDelete} />
      );
      
      // Component should not re-render unnecessarily
      expect(screen.getByText('Test record content')).toBeInTheDocument();
    });

    it('optimizes expensive date formatting', () => {
      // Mock performance.now to measure formatting time
      const originalNow = performance.now;
      let callCount = 0;
      performance.now = jest.fn(() => {
        callCount++;
        return originalNow();
      });
      
      render(<RecordItem record={mockRecord} />);
      
      // Date formatting should be memoized/optimized
      expect(callCount).toBeLessThan(10);
      
      performance.now = originalNow;
    });
  });
});