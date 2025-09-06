import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HomePage } from './HomePage';

interface MockSearchInputProps {
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  value?: string;
  placeholder?: string;
  suggestions?: string[];
}

interface MockRecordListProps {
  records?: Array<{
    id: string;
    content: string;
    tags?: Array<{ id: string; displayValue: string }>;
  }>;
  onSelectionChange?: (selectedIds: string[]) => void;
  onEdit?: (record: { id: string; content: string }) => void;
  onDelete?: (record: { id: string; content: string }) => void;
  onTagClick?: (tagId: string) => void;
  selectedRecordIds?: string[];
}

interface MockTagCloudProps {
  tags?: Array<{
    id: string;
    displayValue: string;
    usageCount: number;
  }>;
  onTagClick?: (tag: { id: string }) => void;
  selectedTagIds?: string[];
}

interface MockImportExportProps {
  onImport?: (file: File) => void;
  onExport?: (format: string) => void;
}

// Mock the components to avoid complex dependencies during integration testing
jest.mock('../components', () => {
  const React = require('react');
  return {
    SearchInput: React.forwardRef(({ onChange, onSearch, value, placeholder, suggestions, ...props }: MockSearchInputProps, ref: React.Ref<HTMLInputElement>) => (
    <input
      ref={ref}
      data-testid="search-input"
      value={value || ''}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && onSearch?.(e.currentTarget.value)}
      data-suggestions={Array.isArray(suggestions) ? suggestions.join(',') : suggestions}
      {...props}
    />
  )),
  RecordList: ({ records, onSelectionChange, onEdit, onDelete, onTagClick, selectedRecordIds, ...props }: MockRecordListProps): React.ReactElement => (
    <div data-testid="record-list" {...props}>
      {records?.map((record) => (
        <div key={record.id} data-testid={`record-${record.id}`}>
          <span>{record.content}</span>
          <button
            data-testid={`edit-${record.id}`}
            onClick={() => onEdit?.(record)}
          >
            Edit
          </button>
          <button
            data-testid={`delete-${record.id}`}
            onClick={() => onDelete?.(record)}
          >
            Delete
          </button>
          <button
            data-testid={`select-${record.id}`}
            onClick={() => {
              const isSelected = selectedRecordIds?.includes(record.id);
              const newSelection = isSelected 
                ? selectedRecordIds.filter((id: string) => id !== record.id)
                : [...(selectedRecordIds || []), record.id];
              onSelectionChange?.(newSelection);
            }}
          >
            {selectedRecordIds?.includes(record.id) ? 'Deselect' : 'Select'}
          </button>
          {record.tags?.map((tag) => (
            <button
              key={tag.id}
              data-testid={`tag-${tag.id}`}
              onClick={() => onTagClick?.(tag.id)}
            >
              {tag.displayValue}
            </button>
          ))}
        </div>
      ))}
    </div>
  ),
  TagCloud: ({ tags, onTagClick, selectedTagIds, ...props }: MockTagCloudProps): React.ReactElement => (
    <div data-testid="tag-cloud" {...props}>
      {tags?.map((tag) => (
        <button
          key={tag.id}
          data-testid={`cloud-tag-${tag.id}`}
          onClick={() => onTagClick?.(tag)}
          className={selectedTagIds?.includes(tag.id) ? 'selected' : ''}
        >
          {tag.displayValue} ({tag.usageCount})
        </button>
      ))}
    </div>
  ),
  };
});

jest.mock('../components/ImportExport', () => ({
  ImportExport: ({ onImport, onExport, ...props }: MockImportExportProps): React.ReactElement => (
    <div data-testid="import-export" {...props}>
      <input
        data-testid="file-input"
        type="file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImport?.(file);
        }}
      />
      <button
        data-testid="export-json"
        onClick={() => onExport?.('json')}
      >
        Export JSON
      </button>
      <button
        data-testid="export-csv"
        onClick={() => onExport?.('csv')}
      >
        Export CSV
      </button>
    </div>
  ),
}));

describe('HomePage Integration Tests', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    // Clear any localStorage or session storage if needed
    localStorage.clear();
  });

  describe('Initial Render', () => {
    it('renders the main application layout', () => {
      render(<HomePage />);
      
      expect(screen.getByRole('heading', { name: /record management system/i })).toBeInTheDocument();
      expect(screen.getByTestId('search-input')).toBeInTheDocument();
      expect(screen.getByTestId('tag-cloud')).toBeInTheDocument();
      expect(screen.getByTestId('record-list')).toBeInTheDocument();
    });

    it('displays search mode indicator', () => {
      render(<HomePage />);
      
      expect(screen.getByText(/search mode:/i)).toBeInTheDocument();
      expect(screen.getByText('query')).toBeInTheDocument();
    });

    it('shows initial mock records', async () => {
      render(<HomePage />);
      
      await waitFor(() => {
        expect(screen.getByText(/sample record for testing/i)).toBeInTheDocument();
        expect(screen.getByText(/another record with different/i)).toBeInTheDocument();
        expect(screen.getByText(/integration test record/i)).toBeInTheDocument();
      });
    });

    it('shows initial tags with usage counts', async () => {
      render(<HomePage />);
      
      await waitFor(() => {
        expect(screen.getByText(/testing \(2\)/i)).toBeInTheDocument();
        expect(screen.getByText(/demo \(2\)/i)).toBeInTheDocument();
        expect(screen.getByText(/sample \(1\)/i)).toBeInTheDocument();
      });
    });
  });

  describe('Search Functionality', () => {
    it('filters records based on search query', async () => {
      render(<HomePage />);
      
      const searchInput = screen.getByTestId('search-input');
      
      await user.type(searchInput, 'testing');
      fireEvent.keyDown(searchInput, { key: 'Enter' });
      
      await waitFor(() => {
        expect(screen.getByText(/sample record for testing/i)).toBeInTheDocument();
        expect(screen.getByText(/integration test record/i)).toBeInTheDocument();
        expect(screen.queryByText(/another record with different/i)).not.toBeInTheDocument();
      });
    });

    it('updates search mode when query is entered', async () => {
      render(<HomePage />);
      
      const searchInput = screen.getByTestId('search-input');
      
      await user.type(searchInput, 'test');
      
      await waitFor(() => {
        expect(screen.getByText('query')).toBeInTheDocument();
      });
    });

    it('clears search when clear button is clicked', async () => {
      render(<HomePage />);
      
      const searchInput = screen.getByTestId('search-input');
      
      await user.type(searchInput, 'testing');
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('button', { name: /clear filters/i }));
      
      expect(searchInput).toHaveValue('');
    });
  });

  describe('Tag Filtering', () => {
    it('filters records by selected tags', async () => {
      render(<HomePage />);
      
      await waitFor(() => {
        expect(screen.getByTestId('cloud-tag-tag1')).toBeInTheDocument();
      });
      
      const testingTag = screen.getByTestId('cloud-tag-tag1');
      await user.click(testingTag);
      
      await waitFor(() => {
        expect(screen.getByText('tag')).toBeInTheDocument(); // Search mode changes to 'tag'
        expect(screen.getByText(/sample record for testing/i)).toBeInTheDocument();
        expect(screen.getByText(/integration test record/i)).toBeInTheDocument();
        expect(screen.queryByText(/another record with different/i)).not.toBeInTheDocument();
      });
    });

    it('updates search mode to mixed when both query and tags are selected', async () => {
      render(<HomePage />);
      
      const searchInput = screen.getByTestId('search-input');
      await user.type(searchInput, 'test');
      
      await waitFor(() => {
        expect(screen.getByTestId('cloud-tag-tag1')).toBeInTheDocument();
      });
      
      const testingTag = screen.getByTestId('cloud-tag-tag1');
      await user.click(testingTag);
      
      await waitFor(() => {
        expect(screen.getByText('mixed')).toBeInTheDocument();
      });
    });

    it('allows clicking tags in record list to filter', async () => {
      render(<HomePage />);
      
      await waitFor(() => {
        expect(screen.getAllByTestId('tag-tag1').length).toBeGreaterThan(0);
      });
      
      const recordTags = screen.getAllByTestId('tag-tag1');
      await user.click(recordTags[0]);
      
      await waitFor(() => {
        expect(screen.getByText('tag')).toBeInTheDocument();
      });
    });
  });

  describe('Record Management', () => {
    it('allows selecting multiple records', async () => {
      render(<HomePage />);
      
      await waitFor(() => {
        expect(screen.getByTestId('select-1')).toBeInTheDocument();
        expect(screen.getByTestId('select-2')).toBeInTheDocument();
      });
      
      await user.click(screen.getByTestId('select-1'));
      await user.click(screen.getByTestId('select-2'));
      
      await waitFor(() => {
        expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
      });
    });

    it('allows editing records', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      render(<HomePage />);
      
      await waitFor(() => {
        expect(screen.getByTestId('edit-1')).toBeInTheDocument();
      });
      
      await user.click(screen.getByTestId('edit-1'));
      
      expect(consoleSpy).toHaveBeenCalledWith('Edit record:', '1');
      
      consoleSpy.mockRestore();
    });

    it('allows deleting records', async () => {
      render(<HomePage />);
      
      await waitFor(() => {
        expect(screen.getByTestId('delete-1')).toBeInTheDocument();
      });
      
      await user.click(screen.getByTestId('delete-1'));
      
      await waitFor(() => {
        expect(screen.queryByText(/sample record for testing/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Import/Export Functionality', () => {
    it('toggles import/export panel visibility', async () => {
      render(<HomePage />);
      
      expect(screen.queryByTestId('import-export')).not.toBeInTheDocument();
      
      await user.click(screen.getByRole('button', { name: /show import\/export/i }));
      
      expect(screen.getByTestId('import-export')).toBeInTheDocument();
      
      await user.click(screen.getByRole('button', { name: /hide import\/export/i }));
      
      expect(screen.queryByTestId('import-export')).not.toBeInTheDocument();
    });

    it('handles file import', async () => {
      render(<HomePage />);
      
      await user.click(screen.getByRole('button', { name: /show import\/export/i }));
      
      const fileInput = screen.getByTestId('file-input');
      const testFile = new File(['test content'], 'test.json', { type: 'application/json' });
      
      await user.upload(fileInput, testFile);
      
      // Verify import is triggered (since it's mocked, just check the input received the file)
      expect(fileInput.files).toHaveLength(1);
      expect(fileInput.files![0]).toBe(testFile);
    });

    it('handles data export', async () => {
      render(<HomePage />);
      
      await user.click(screen.getByRole('button', { name: /show import\/export/i }));
      
      const exportButton = screen.getByTestId('export-json');
      await user.click(exportButton);
      
      // Since export is mocked, we just verify the button click doesn't throw an error
      expect(exportButton).toBeInTheDocument();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('focuses search input on Ctrl+K', async () => {
      render(<HomePage />);
      
      const searchInput = screen.getByTestId('search-input');
      
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
      
      expect(searchInput).toHaveFocus();
    });

    it('toggles import/export on Ctrl+Shift+I', async () => {
      render(<HomePage />);
      
      expect(screen.queryByTestId('import-export')).not.toBeInTheDocument();
      
      fireEvent.keyDown(document, { key: 'I', ctrlKey: true, shiftKey: true });
      
      expect(screen.getByTestId('import-export')).toBeInTheDocument();
    });

    it('clears filters on Escape', async () => {
      render(<HomePage />);
      
      const searchInput = screen.getByTestId('search-input');
      await user.type(searchInput, 'test');
      
      fireEvent.keyDown(document, { key: 'Escape' });
      
      expect(searchInput).toHaveValue('');
    });
  });

  describe('Complete User Flows', () => {
    it('completes a search-to-selection-to-deletion flow', async () => {
      render(<HomePage />);
      
      // 1. Search for records
      const searchInput = screen.getByTestId('search-input');
      await user.type(searchInput, 'testing');
      
      await waitFor(() => {
        expect(screen.getByText(/sample record for testing/i)).toBeInTheDocument();
        expect(screen.getByText(/integration test record/i)).toBeInTheDocument();
      });
      
      // 2. Select records
      await user.click(screen.getByTestId('select-1'));
      await user.click(screen.getByTestId('select-3'));
      
      await waitFor(() => {
        expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
      });
      
      // 3. Delete one of the selected records
      await user.click(screen.getByTestId('delete-1'));
      
      await waitFor(() => {
        expect(screen.queryByText(/sample record for testing/i)).not.toBeInTheDocument();
        expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
      });
    });

    it('completes a tag-filter-to-export flow', async () => {
      render(<HomePage />);
      
      // 1. Filter by tag
      await waitFor(() => {
        expect(screen.getByTestId('cloud-tag-tag4')).toBeInTheDocument();
      });
      
      await user.click(screen.getByTestId('cloud-tag-tag4'));
      
      await waitFor(() => {
        expect(screen.getByText('tag')).toBeInTheDocument();
        expect(screen.getByText(/another record with different/i)).toBeInTheDocument();
        expect(screen.getByText(/integration test record/i)).toBeInTheDocument();
      });
      
      // 2. Show export options
      await user.click(screen.getByRole('button', { name: /show import\/export/i }));
      
      // 3. Export filtered data
      const exportButton = screen.getByTestId('export-csv');
      await user.click(exportButton);
      
      // Verify no errors occurred
      expect(exportButton).toBeInTheDocument();
    });
  });
});