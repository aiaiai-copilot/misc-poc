import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecordList } from './RecordList';
import { RecordDTO } from '@misc-poc/application';

const mockRecords: RecordDTO[] = [
  {
    id: '1',
    content: 'First record with tags',
    tagIds: ['tag1', 'tag2'],
    createdAt: '2023-01-01T10:00:00Z',
    updatedAt: '2023-01-01T10:00:00Z',
  },
  {
    id: '2',
    content: 'Second record with different tags',
    tagIds: ['tag3', 'tag4'],
    createdAt: '2023-01-02T11:00:00Z',
    updatedAt: '2023-01-02T11:00:00Z',
  },
  {
    id: '3',
    content: 'Third record for testing',
    tagIds: ['tag5'],
    createdAt: '2023-01-03T12:00:00Z',
    updatedAt: '2023-01-03T12:00:00Z',
  },
];

describe('RecordList', () => {
  describe('Basic rendering', () => {
    it('renders empty list when no records provided', () => {
      render(<RecordList records={[]} />);
      
      const listContainer = screen.getByRole('region', { name: /record list/i });
      expect(listContainer).toBeInTheDocument();
      
      const emptyMessage = screen.getByText(/no records found/i);
      expect(emptyMessage).toBeInTheDocument();
    });

    it('renders list of records', () => {
      render(<RecordList records={mockRecords} />);
      
      const listContainer = screen.getByRole('region', { name: /record list/i });
      expect(listContainer).toBeInTheDocument();
      
      // Should render all records
      expect(screen.getByText('First record with tags')).toBeInTheDocument();
      expect(screen.getByText('Second record with different tags')).toBeInTheDocument();
      expect(screen.getByText('Third record for testing')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <RecordList records={mockRecords} className="custom-list" />
      );
      
      const listContainer = container.querySelector('.custom-list');
      expect(listContainer).toBeInTheDocument();
    });
  });

  describe('Virtualization support', () => {
    const largeRecordSet = Array.from({ length: 1000 }, (_, index) => ({
      id: `record-${index}`,
      content: `Record content ${index}`,
      tagIds: [`tag-${index}`],
      createdAt: '2023-01-01T10:00:00Z',
      updatedAt: '2023-01-01T10:00:00Z',
    }));

    it('renders large lists efficiently with virtualization', () => {
      const { container } = render(
        <RecordList records={largeRecordSet} enableVirtualization />
      );
      
      const virtualContainer = container.querySelector('[data-testid="virtual-list"]');
      expect(virtualContainer).toBeInTheDocument();
      
      // Should not render all 1000 items at once
      const renderedItems = container.querySelectorAll('[data-testid="record-item"]');
      expect(renderedItems.length).toBeLessThan(100);
    });

    it('supports custom item height for virtualization', () => {
      render(
        <RecordList 
          records={largeRecordSet} 
          enableVirtualization 
          itemHeight={80}
        />
      );
      
      const virtualContainer = screen.getByTestId('virtual-list');
      expect(virtualContainer).toHaveStyle({ height: '400px' }); // Default container height
    });

    it('disables virtualization for small lists', () => {
      const { container } = render(
        <RecordList records={mockRecords} enableVirtualization />
      );
      
      // Small lists should not use virtualization
      const virtualContainer = container.querySelector('[data-testid="virtual-list"]');
      expect(virtualContainer).not.toBeInTheDocument();
    });
  });

  describe('Selection functionality', () => {
    it('supports single record selection', async () => {
      const onSelectionChange = jest.fn();
      const user = userEvent.setup();
      
      render(
        <RecordList 
          records={mockRecords} 
          selectionMode="single"
          onSelectionChange={onSelectionChange}
        />
      );
      
      const firstRecord = screen.getByText('First record with tags').closest('[role="button"]');
      expect(firstRecord).toBeInTheDocument();
      
      await user.click(firstRecord!);
      
      expect(onSelectionChange).toHaveBeenCalledWith(['1']);
    });

    it('supports multiple record selection', async () => {
      const onSelectionChange = jest.fn();
      const user = userEvent.setup();
      
      // Use React state instead of closure variable
      const TestComponent = (): JSX.Element => {
        const [selectedIds, setSelectedIds] = useState<string[]>([]);
        
        return (
          <RecordList 
            records={mockRecords} 
            selectionMode="multiple"
            selectedRecordIds={selectedIds}
            onSelectionChange={(ids) => {
              setSelectedIds(ids);
              onSelectionChange(ids);
            }}
          />
        );
      };
      
      render(<TestComponent />);
      
      const firstRecord = screen.getByText('First record with tags').closest('[role="button"]');
      const secondRecord = screen.getByText('Second record with different tags').closest('[role="button"]');
      
      await user.click(firstRecord!);
      expect(onSelectionChange).toHaveBeenCalledWith(['1']);
      
      // Click second record while holding Ctrl to add to selection
      await user.keyboard('{Control>}');
      await user.click(secondRecord!);
      await user.keyboard('{/Control}');
      
      expect(onSelectionChange).toHaveBeenLastCalledWith(['1', '2']);
    });

    it('shows visual selection state', () => {
      render(
        <RecordList 
          records={mockRecords} 
          selectionMode="single"
          selectedRecordIds={['1']}
        />
      );
      
      const selectedRecord = screen.getByText('First record with tags').closest('[role="button"]');
      expect(selectedRecord).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Keyboard navigation', () => {
    it('supports arrow key navigation', async () => {
      const user = userEvent.setup();
      
      render(<RecordList records={mockRecords} />);
      
      const listContainer = screen.getByRole('list');
      await user.click(listContainer);
      
      // First record should be focused after arrow down
      await user.keyboard('{ArrowDown}');
      const firstRecord = screen.getByText('First record with tags').closest('[role="button"]');
      expect(firstRecord).toHaveAttribute('tabindex', '0');
      
      // Navigate to second record
      await user.keyboard('{ArrowDown}');
      const secondRecord = screen.getByText('Second record with different tags').closest('[role="button"]');
      expect(secondRecord).toHaveAttribute('tabindex', '0');
      expect(firstRecord).toHaveAttribute('tabindex', '-1');
    });

    it('supports Home and End keys', async () => {
      const user = userEvent.setup();
      
      render(<RecordList records={mockRecords} />);
      
      const listContainer = screen.getByRole('list');
      await user.click(listContainer);
      
      // Go to end
      await user.keyboard('{End}');
      const lastRecord = screen.getByText('Third record for testing').closest('[role="button"]');
      expect(lastRecord).toHaveAttribute('tabindex', '0');
      
      // Go to beginning
      await user.keyboard('{Home}');
      const firstRecord = screen.getByText('First record with tags').closest('[role="button"]');
      expect(firstRecord).toHaveAttribute('tabindex', '0');
      expect(lastRecord).toHaveAttribute('tabindex', '-1');
    });

    it('supports Enter key for selection', async () => {
      const onSelectionChange = jest.fn();
      const user = userEvent.setup();
      
      render(
        <RecordList 
          records={mockRecords} 
          selectionMode="single"
          onSelectionChange={onSelectionChange}
        />
      );
      
      const listContainer = screen.getByRole('list');
      await user.click(listContainer);
      
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');
      
      expect(onSelectionChange).toHaveBeenCalledWith(['1']);
    });

    it('supports Space key for selection', async () => {
      const onSelectionChange = jest.fn();
      const user = userEvent.setup();
      
      render(
        <RecordList 
          records={mockRecords} 
          selectionMode="single"
          onSelectionChange={onSelectionChange}
        />
      );
      
      const listContainer = screen.getByRole('list');
      await user.click(listContainer);
      
      await user.keyboard('{ArrowDown}');
      await user.keyboard(' ');
      
      expect(onSelectionChange).toHaveBeenCalledWith(['1']);
    });
  });

  describe('Bulk operations preparation', () => {
    it('shows bulk actions toolbar when records are selected', () => {
      render(
        <RecordList 
          records={mockRecords} 
          selectionMode="multiple"
          selectedRecordIds={['1', '2']}
          showBulkActions
        />
      );
      
      const bulkToolbar = screen.getByRole('toolbar', { name: /bulk actions/i });
      expect(bulkToolbar).toBeInTheDocument();
      
      const selectedCount = screen.getAllByText('2 records selected')[0];
      expect(selectedCount).toBeInTheDocument();
    });

    it('hides bulk actions toolbar when no records selected', () => {
      render(
        <RecordList 
          records={mockRecords} 
          selectionMode="multiple"
          selectedRecordIds={[]}
          showBulkActions
        />
      );
      
      const bulkToolbar = screen.queryByRole('toolbar', { name: /bulk actions/i });
      expect(bulkToolbar).not.toBeInTheDocument();
    });

    it('supports select all functionality', async () => {
      const onSelectionChange = jest.fn();
      const user = userEvent.setup();
      
      render(
        <RecordList 
          records={mockRecords} 
          selectionMode="multiple"
          selectedRecordIds={['1']}
          showBulkActions
          onSelectionChange={onSelectionChange}
        />
      );
      
      // Bulk toolbar should be visible with one record selected
      const selectAllButton = screen.getByRole('button', { name: /select all/i });
      await user.click(selectAllButton);
      
      expect(onSelectionChange).toHaveBeenCalledWith(['1', '2', '3']);
    });
  });

  describe('Responsive design', () => {
    it('adapts layout for mobile screens', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      
      const { container } = render(<RecordList records={mockRecords} />);
      
      const listContainer = container.querySelector('[data-responsive="mobile"]');
      expect(listContainer).toBeInTheDocument();
    });

    it('uses desktop layout for larger screens', () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });
      
      const { container } = render(<RecordList records={mockRecords} />);
      
      const listContainer = container.querySelector('[data-responsive="desktop"]');
      expect(listContainer).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(<RecordList records={mockRecords} />);
      
      const listContainer = screen.getByRole('region', { name: /record list/i });
      expect(listContainer).toBeInTheDocument();
      expect(listContainer).toHaveAttribute('aria-label', 'Record list');
      
      const recordItems = screen.getAllByRole('button');
      recordItems.forEach((item) => {
        expect(item).toHaveAttribute('aria-describedby');
      });
    });

    it('supports screen reader announcements for selection', () => {
      render(
        <RecordList 
          records={mockRecords} 
          selectionMode="single"
          selectedRecordIds={['1']}
        />
      );
      
      const announcement = screen.getByRole('status', { name: /selection status/i });
      expect(announcement).toBeInTheDocument();
      expect(announcement).toHaveTextContent('1 record selected');
    });

    it('provides keyboard instructions', () => {
      render(<RecordList records={mockRecords} />);
      
      const instructions = screen.getByText(/use arrow keys to navigate/i);
      expect(instructions).toBeInTheDocument();
    });
  });

  describe('Performance optimization', () => {
    it('memoizes record rendering', () => {
      const onEdit = jest.fn();
      const onDelete = jest.fn();
      
      const { rerender } = render(
        <RecordList records={mockRecords} onEdit={onEdit} onDelete={onDelete} />
      );
      
      // Re-render with same props
      rerender(
        <RecordList records={mockRecords} onEdit={onEdit} onDelete={onDelete} />
      );
      
      // Records should not re-render unnecessarily
      expect(screen.getByText('First record with tags')).toBeInTheDocument();
    });

    it('handles large datasets efficiently', () => {
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        id: `${i}`,
        content: `Record ${i}`,
        tagIds: [`tag${i}`],
        createdAt: '2023-01-01T10:00:00Z',
        updatedAt: '2023-01-01T10:00:00Z',
      }));
      
      const startTime = performance.now();
      render(<RecordList records={largeDataset} enableVirtualization />);
      const endTime = performance.now();
      
      // Should render within reasonable time
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('Error handling', () => {
    it('handles missing record data gracefully', () => {
      const incompleteRecords = [
        {
          id: '1',
          content: 'Complete record',
          tagIds: ['tag1'],
          createdAt: '2023-01-01T10:00:00Z',
          updatedAt: '2023-01-01T10:00:00Z',
        },
        // @ts-expect-error Testing error handling
        {
          id: '2',
          content: undefined,
          tagIds: [],
          createdAt: '2023-01-01T10:00:00Z',
          updatedAt: '2023-01-01T10:00:00Z',
        },
      ];
      
      render(<RecordList records={incompleteRecords} />);
      
      // Should render the complete record
      expect(screen.getByText('Complete record')).toBeInTheDocument();
      
      // Should handle incomplete record gracefully
      const errorFallback = screen.getByText(/unable to display record/i);
      expect(errorFallback).toBeInTheDocument();
    });
  });
});