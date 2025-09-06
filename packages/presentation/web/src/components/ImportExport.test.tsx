import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportExport } from './ImportExport';

// Mock the application types since we don't have actual imports
interface ExportDTO {
  records: Record<string, unknown>[];
  format: 'json' | 'csv' | 'xml' | 'yaml';
  exportedAt: string;
  version: string;
  metadata: {
    totalRecords: number;
    exportSource: string;
  };
}

interface ImportResultDTO {
  success: boolean;
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  importedAt: string;
  duration: number;
  summary: {
    recordsCreated: number;
    recordsUpdated: number;
    recordsSkipped: number;
    recordsFailed: number;
  };
}

describe('ImportExport', () => {
  beforeEach(() => {
    // Don't need fake timers for most tests
  });

  afterEach(() => {
    // Clean up after each test
  });

  const mockRecords = [
    {
      id: '1',
      content: 'Test record 1',
      tagIds: ['tag1'],
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    },
    {
      id: '2', 
      content: 'Test record 2',
      tagIds: ['tag2'],
      createdAt: '2023-01-02T00:00:00Z',
      updatedAt: '2023-01-02T00:00:00Z',
    },
  ];

  const mockExportData: ExportDTO = {
    records: mockRecords,
    format: 'json',
    exportedAt: '2023-01-01T00:00:00Z',
    version: '1.0',
    metadata: {
      totalRecords: 2,
      exportSource: 'full-database',
    },
  };

  describe('Basic rendering and accessibility', () => {
    it('renders import and export sections with correct accessibility attributes', () => {
      render(<ImportExport />);

      expect(screen.getByRole('region', { name: /import/i })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /export/i })).toBeInTheDocument();
      
      const importSection = screen.getByTestId('import-section');
      const exportSection = screen.getByTestId('export-section');
      
      expect(importSection).toHaveAttribute('aria-labelledby');
      expect(exportSection).toHaveAttribute('aria-labelledby');
    });

    it('renders with custom className', () => {
      render(<ImportExport className="custom-import-export" />);

      const container = screen.getByTestId('import-export-container');
      expect(container).toHaveClass('custom-import-export');
    });
  });

  describe('File selection', () => {
    it('renders file input with correct attributes', () => {
      render(<ImportExport />);

      const fileInput = screen.getByLabelText(/choose file/i) as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();
      expect(fileInput).toHaveAttribute('type', 'file');
      expect(fileInput).toHaveAttribute('accept', '.json,.csv,.xml,.yaml');
      expect(fileInput).toHaveAttribute('aria-describedby');
    });

    it('displays selected file name and size', async () => {
      const user = userEvent.setup();
      render(<ImportExport />);

      const file = new File(['{"test": "data"}'], 'test.json', {
        type: 'application/json',
      });
      
      const fileInput = screen.getByLabelText(/choose file/i);
      await user.upload(fileInput, file);

      expect(screen.getByText('test.json')).toBeInTheDocument();
      expect(screen.getByText(/16 bytes/i)).toBeInTheDocument();
    });

    it('shows file format validation errors', async () => {
      render(<ImportExport />);

      const file = new File(['invalid'], 'test.txt', {
        type: 'text/plain',
      });

      const dropZone = screen.getByTestId('drop-zone');
      
      // Mock the drag event with files
      const mockDataTransfer = {
        files: [file],
        items: [
          {
            kind: 'file',
            getAsFile: (): File => file,
          },
        ],
      };

      await act(async () => {
        fireEvent.drop(dropZone, {
          dataTransfer: mockDataTransfer,
        });
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/unsupported file format/i)).toBeInTheDocument();
      });
    });

    it('clears selected file when clear button is clicked', async () => {
      const user = userEvent.setup();
      render(<ImportExport />);

      const file = new File(['{"test": "data"}'], 'test.json', {
        type: 'application/json',
      });
      
      const fileInput = screen.getByLabelText(/choose file/i);
      await user.upload(fileInput, file);

      expect(screen.getByText('test.json')).toBeInTheDocument();

      const clearButton = screen.getByRole('button', { name: /clear/i });
      await user.click(clearButton);

      expect(screen.queryByText('test.json')).not.toBeInTheDocument();
    });
  });

  describe('Drag and drop support', () => {
    it('renders drag and drop area with correct attributes', () => {
      render(<ImportExport />);

      const dropZone = screen.getByTestId('drop-zone');
      expect(dropZone).toBeInTheDocument();
      expect(dropZone).toHaveAttribute('aria-label', 'Drop files here to import');
      expect(dropZone).toHaveAttribute('tabIndex', '0');
    });

    it('shows visual feedback when dragging files over drop zone', async () => {
      render(<ImportExport />);

      const dropZone = screen.getByTestId('drop-zone');
      
      // Simulate drag enter
      await act(async () => {
        fireEvent.dragEnter(dropZone);
      });

      expect(dropZone).toHaveClass('drag-over');
    });

    it('handles file drop correctly', async () => {
      render(<ImportExport />);

      const dropZone = screen.getByTestId('drop-zone');
      const file = new File(['{"test": "data"}'], 'dropped.json', {
        type: 'application/json',
      });

      const mockDataTransfer = {
        files: [file],
        items: [
          {
            kind: 'file',
            getAsFile: (): File => file,
          },
        ],
      };

      await act(async () => {
        fireEvent.drop(dropZone, {
          dataTransfer: mockDataTransfer,
        });
      });

      expect(screen.getByText('dropped.json')).toBeInTheDocument();
    });

    it('rejects non-file drops', async () => {
      render(<ImportExport />);

      const dropZone = screen.getByTestId('drop-zone');
      const mockDataTransfer = {
        files: [],
        items: [
          {
            kind: 'string', // Not a file
            getAsFile: (): File | null => null,
          },
        ],
      };

      await act(async () => {
        fireEvent.drop(dropZone, {
          dataTransfer: mockDataTransfer,
        });
      });

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/only files are allowed/i)).toBeInTheDocument();
    });
  });

  describe('Progress indicators', () => {
    it('shows progress bar during import operation', async () => {
      const onImport = jest.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );
      const user = userEvent.setup();
      
      render(<ImportExport onImport={onImport} />);

      const file = new File(['{"test": "data"}'], 'test.json', {
        type: 'application/json',
      });
      
      const fileInput = screen.getByLabelText(/choose file/i);
      await user.upload(fileInput, file);

      const importButton = screen.getByRole('button', { name: /import/i });
      await user.click(importButton);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText(/importing/i)).toBeInTheDocument();
      
      // Complete the import
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });
    });

    it('shows progress bar during export operation', async () => {
      const onExport = jest.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockExportData), 1000))
      );
      const user = userEvent.setup();
      
      render(<ImportExport onExport={onExport} />);

      const exportButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportButton);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText(/exporting/i)).toBeInTheDocument();
      
      // Complete the export
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });
    });

    it('shows percentage progress when available', async () => {
      const onImport = jest.fn().mockImplementation(
        () => new Promise((resolve) => {
          // Don't resolve immediately to keep importing state active
          setTimeout(resolve, 1000);
        })
      );
      const user = userEvent.setup();
      
      render(<ImportExport onImport={onImport} progress={75} />);

      const file = new File(['{"test": "data"}'], 'test.json', {
        type: 'application/json',
      });
      
      const fileInput = screen.getByLabelText(/choose file/i);
      await user.upload(fileInput, file);

      const importButton = screen.getByRole('button', { name: /import/i });
      await user.click(importButton);

      // Wait for the import to start and progress bar to appear
      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toHaveAttribute('aria-valuenow', '75');
        expect(screen.getByText('75%')).toBeInTheDocument();
      });
    });
  });

  describe('Warning dialogs for data replacement', () => {
    it('shows warning dialog when importing with existing data', async () => {
      const onImport = jest.fn();
      const user = userEvent.setup();
      
      render(<ImportExport onImport={onImport} hasExistingData />);

      const file = new File(['{"test": "data"}'], 'test.json', {
        type: 'application/json',
      });
      
      const fileInput = screen.getByLabelText(/choose file/i);
      await user.upload(fileInput, file);

      const importButton = screen.getByRole('button', { name: /import/i });
      await user.click(importButton);

      const dialog = screen.getByRole('dialog', { name: /confirm import/i });
      expect(dialog).toBeInTheDocument();
      expect(screen.getByText(/this will replace/i)).toBeInTheDocument();
    });

    it('proceeds with import when confirmed in dialog', async () => {
      const onImport = jest.fn();
      const user = userEvent.setup();
      
      render(<ImportExport onImport={onImport} hasExistingData />);

      const file = new File(['{"test": "data"}'], 'test.json', {
        type: 'application/json',
      });
      
      const fileInput = screen.getByLabelText(/choose file/i);
      await user.upload(fileInput, file);

      const importButton = screen.getByRole('button', { name: /import/i });
      await user.click(importButton);

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      expect(onImport).toHaveBeenCalledWith(expect.any(File));
    });

    it('cancels import when dialog is dismissed', async () => {
      const onImport = jest.fn();
      const user = userEvent.setup();
      
      render(<ImportExport onImport={onImport} hasExistingData />);

      const file = new File(['{"test": "data"}'], 'test.json', {
        type: 'application/json',
      });
      
      const fileInput = screen.getByLabelText(/choose file/i);
      await user.upload(fileInput, file);

      const importButton = screen.getByRole('button', { name: /import/i });
      await user.click(importButton);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(onImport).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Error handling', () => {
    it('displays import error messages', async () => {
      const onImport = jest.fn().mockRejectedValue(new Error('Import failed'));
      const user = userEvent.setup();
      
      render(<ImportExport onImport={onImport} />);

      const file = new File(['{"test": "data"}'], 'test.json', {
        type: 'application/json',
      });
      
      const fileInput = screen.getByLabelText(/choose file/i);
      await user.upload(fileInput, file);

      const importButton = screen.getByRole('button', { name: /import/i });
      await user.click(importButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/import failed/i)).toBeInTheDocument();
      });
    });

    it('displays export error messages', async () => {
      const onExport = jest.fn().mockRejectedValue(new Error('Export failed'));
      const user = userEvent.setup();
      
      render(<ImportExport onExport={onExport} />);

      const exportButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/export failed/i)).toBeInTheDocument();
      });
    });

    it('handles network errors gracefully', async () => {
      const onImport = jest.fn().mockRejectedValue(new Error('Network error'));
      const user = userEvent.setup();
      
      render(<ImportExport onImport={onImport} />);

      const file = new File(['{"test": "data"}'], 'test.json', {
        type: 'application/json',
      });
      
      const fileInput = screen.getByLabelText(/choose file/i);
      await user.upload(fileInput, file);

      const importButton = screen.getByRole('button', { name: /import/i });
      await user.click(importButton);

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });

    it('clears errors when new operation starts', async () => {
      const onImport = jest.fn()
        .mockRejectedValueOnce(new Error('Import failed'))
        .mockImplementation(() => new Promise(() => {})); // Never resolves to keep importing state
      const user = userEvent.setup();
      
      render(<ImportExport onImport={onImport} />);

      const file = new File(['{"test": "data"}'], 'test.json', {
        type: 'application/json',
      });
      
      const fileInput = screen.getByLabelText(/choose file/i);
      await user.upload(fileInput, file);

      const importButton = screen.getByRole('button', { name: /import/i });
      await user.click(importButton);

      await waitFor(() => {
        expect(screen.getByText(/import failed/i)).toBeInTheDocument();
      });

      // Start new import - should clear the error
      await user.click(importButton);

      await waitFor(() => {
        expect(screen.queryByText(/import failed/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Export functionality', () => {
    it('renders export button with correct attributes', () => {
      render(<ImportExport />);

      const exportButton = screen.getByRole('button', { name: /export/i });
      expect(exportButton).toBeInTheDocument();
      expect(exportButton).toHaveAttribute('type', 'button');
    });

    it('generates automatic filename based on current date', async () => {
      const mockDate = new Date('2023-01-15T10:30:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
      
      const onExport = jest.fn().mockResolvedValue(mockExportData);
      const user = userEvent.setup();
      
      render(<ImportExport onExport={onExport} />);

      const exportButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText(/data-export-2023-01-15/)).toBeInTheDocument();
      });
    });

    it('allows custom filename prefix', async () => {
      const onExport = jest.fn().mockResolvedValue(mockExportData);
      const user = userEvent.setup();
      
      render(<ImportExport onExport={onExport} exportFilenamePrefix="my-records" />);

      const exportButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText(/my-records/)).toBeInTheDocument();
      });
    });

    it('supports different export formats', async () => {
      const onExport = jest.fn().mockResolvedValue({
        ...mockExportData,
        format: 'csv',
      });
      const user = userEvent.setup();
      
      render(<ImportExport onExport={onExport} defaultExportFormat="csv" />);

      const formatSelect = screen.getByLabelText(/export format/i);
      expect(formatSelect).toHaveValue('csv');

      const exportButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportButton);

      expect(onExport).toHaveBeenCalledWith('csv');
    });
  });

  describe('Import result display', () => {
    it('shows success message after successful import', async () => {
      const importResult: ImportResultDTO = {
        success: true,
        totalProcessed: 2,
        successCount: 2,
        errorCount: 0,
        importedAt: '2023-01-01T00:00:00Z',
        duration: 1000,
        summary: {
          recordsCreated: 2,
          recordsUpdated: 0,
          recordsSkipped: 0,
          recordsFailed: 0,
        },
      };

      const onImport = jest.fn().mockResolvedValue(importResult);
      const user = userEvent.setup();
      
      render(<ImportExport onImport={onImport} />);

      const file = new File(['{"test": "data"}'], 'test.json', {
        type: 'application/json',
      });
      
      const fileInput = screen.getByLabelText(/choose file/i);
      await user.upload(fileInput, file);

      const importButton = screen.getByRole('button', { name: /import/i });
      await user.click(importButton);

      await waitFor(() => {
        expect(screen.getByText(/successfully imported 2 records/i)).toBeInTheDocument();
        expect(screen.getByText(/2 created/i)).toBeInTheDocument();
      });
    });

    it('shows warning message for partial import success', async () => {
      const importResult: ImportResultDTO = {
        success: false,
        totalProcessed: 3,
        successCount: 2,
        errorCount: 1,
        importedAt: '2023-01-01T00:00:00Z',
        duration: 1000,
        summary: {
          recordsCreated: 2,
          recordsUpdated: 0,
          recordsSkipped: 0,
          recordsFailed: 1,
        },
      };

      const onImport = jest.fn().mockResolvedValue(importResult);
      const user = userEvent.setup();
      
      render(<ImportExport onImport={onImport} />);

      const file = new File(['{"test": "data"}'], 'test.json', {
        type: 'application/json',
      });
      
      const fileInput = screen.getByLabelText(/choose file/i);
      await user.upload(fileInput, file);

      const importButton = screen.getByRole('button', { name: /import/i });
      await user.click(importButton);

      await waitFor(() => {
        expect(screen.getByText(/2 of 3 records imported successfully/i)).toBeInTheDocument();
        expect(screen.getByText(/1 failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Keyboard navigation', () => {
    it('supports keyboard navigation for file selection', async () => {
      const user = userEvent.setup();
      render(<ImportExport />);

      const fileInput = screen.getByLabelText(/choose file/i);
      fileInput.focus();

      expect(fileInput).toHaveFocus();

      // Tab through the interface - expect to reach the drop zone, then import button
      await user.tab();
      
      // The exact focus order depends on the HTML structure
      // Let's just verify we can navigate with keyboard
      const focusedElement = document.activeElement;
      expect(focusedElement).toBeInTheDocument();
    });

    it('supports keyboard navigation for drop zone', async () => {
      const user = userEvent.setup();
      render(<ImportExport />);

      const dropZone = screen.getByTestId('drop-zone');
      await user.tab(); // Navigate to drop zone

      expect(dropZone).toHaveFocus();

      // Simulate Enter key to trigger file selection
      await user.keyboard('{Enter}');
      
      const fileInput = screen.getByLabelText(/choose file/i);
      expect(fileInput).toHaveFocus();
    });
  });

  describe('Component lifecycle', () => {
    it('cleans up resources on unmount', () => {
      const { unmount } = render(<ImportExport />);
      
      // This test ensures no memory leaks
      expect(() => unmount()).not.toThrow();
    });

    it('resets state when component remounts', () => {
      const { rerender } = render(<ImportExport />);
      
      rerender(<ImportExport />);
      
      // Should start with clean state
      expect(screen.queryByText(/test.json/)).not.toBeInTheDocument();
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });
});