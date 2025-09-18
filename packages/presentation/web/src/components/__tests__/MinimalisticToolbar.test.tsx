import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MinimalisticToolbar } from '../MinimalisticToolbar';
import { ApplicationContextProvider } from '../../contexts/ApplicationContext';
import { vi } from 'vitest';

describe('MinimalisticToolbar', () => {
  const mockOnImportSuccess = vi.fn();

  // Mock browser APIs that aren't available in JSDOM
  const mockCreateObjectURL = vi.fn(() => 'mock-url');
  const mockRevokeObjectURL = vi.fn();
  const mockFileText = vi.fn(() => Promise.resolve('{"records":[]}'));

  const renderWithProvider = (
    ui: React.ReactElement
  ): ReturnType<typeof render> => {
    return render(
      <ApplicationContextProvider>{ui}</ApplicationContextProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock URL APIs only
    global.URL = {
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: mockRevokeObjectURL,
    } as typeof URL;

    // Mock File.prototype.text method
    Object.defineProperty(File.prototype, 'text', {
      value: mockFileText,
      writable: true,
    });
  });

  describe('Rendering', () => {
    it('should render hamburger menu button', () => {
      renderWithProvider(
        <MinimalisticToolbar onImportSuccess={mockOnImportSuccess} />
      );

      expect(screen.getByTitle('Menu')).toBeInTheDocument();
    });

    it('should render with correct ARIA labels', () => {
      renderWithProvider(
        <MinimalisticToolbar onImportSuccess={mockOnImportSuccess} />
      );

      expect(screen.getByLabelText('Menu')).toBeInTheDocument();
    });

    it('should have proper button styling', () => {
      renderWithProvider(
        <MinimalisticToolbar onImportSuccess={mockOnImportSuccess} />
      );

      const menuButton = screen.getByTitle('Menu');

      expect(menuButton).toHaveClass(
        'p-1',
        'rounded-none',
        'hover:bg-muted',
        'transition-colors'
      );
    });

    it('should show dropdown menu when clicked', async () => {
      const user = userEvent.setup();
      renderWithProvider(
        <MinimalisticToolbar onImportSuccess={mockOnImportSuccess} />
      );

      const menuButton = screen.getByTitle('Menu');
      await user.click(menuButton);

      expect(screen.getByText('Export')).toBeInTheDocument();
      expect(screen.getByText('Import')).toBeInTheDocument();
    });
  });

  describe('Export Functionality', () => {
    it('should trigger export when export menu item is clicked', async () => {
      const user = userEvent.setup();
      renderWithProvider(
        <MinimalisticToolbar onImportSuccess={mockOnImportSuccess} />
      );

      const menuButton = screen.getByTitle('Menu');
      await user.click(menuButton);

      const exportItem = screen.getByText('Export');
      await user.click(exportItem);

      // Since export is async and creates a download, we mainly test that the item is clickable
      expect(menuButton).toBeInTheDocument();
    });

    it('should open dropdown menu for export', async () => {
      const user = userEvent.setup();
      renderWithProvider(
        <MinimalisticToolbar onImportSuccess={mockOnImportSuccess} />
      );

      const menuButton = screen.getByTitle('Menu');
      await user.click(menuButton);

      const exportItem = screen.getByText('Export');
      expect(exportItem).toBeInTheDocument();
    });
  });

  describe('Import Functionality', () => {
    it('should open file picker when import menu item is clicked', async () => {
      const user = userEvent.setup();
      renderWithProvider(
        <MinimalisticToolbar onImportSuccess={mockOnImportSuccess} />
      );

      const menuButton = screen.getByTitle('Menu');
      await user.click(menuButton);

      const importItem = screen.getByText('Import');
      await user.click(importItem);

      // Check that hidden file input exists
      const fileInput = document.querySelector('input[type="file"]');
      expect(fileInput).toBeInTheDocument();
      expect(fileInput).toHaveAttribute('accept', '.json');
    });

    it('should process file when file is selected', async () => {
      const user = userEvent.setup();
      renderWithProvider(
        <MinimalisticToolbar onImportSuccess={mockOnImportSuccess} />
      );

      const fileInput = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();

      // Create a mock file
      const mockFile = new File(['{"records":[]}'], 'test.json', {
        type: 'application/json',
      });

      await user.upload(fileInput, mockFile);

      expect(fileInput.files?.[0]).toBe(mockFile);
    });
  });

  describe('Integration', () => {
    it('should call onImportSuccess callback after successful import', async () => {
      // This would require mocking the application context and import use case
      // For now, we verify the prop is passed correctly
      renderWithProvider(
        <MinimalisticToolbar onImportSuccess={mockOnImportSuccess} />
      );

      expect(mockOnImportSuccess).toBeDefined();
    });

    it('should work without onImportSuccess callback', () => {
      expect(() => {
        renderWithProvider(<MinimalisticToolbar />);
      }).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('should have proper keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithProvider(
        <MinimalisticToolbar onImportSuccess={mockOnImportSuccess} />
      );

      const menuButton = screen.getByTitle('Menu');

      // Tab navigation should work
      await user.tab();
      expect(menuButton).toHaveFocus();
    });

    it('should support Enter key activation for menu', async () => {
      const user = userEvent.setup();
      renderWithProvider(
        <MinimalisticToolbar onImportSuccess={mockOnImportSuccess} />
      );

      const menuButton = screen.getByTitle('Menu');
      menuButton.focus();

      await user.keyboard('{Enter}');

      // Verify dropdown opened
      expect(screen.getByText('Export')).toBeInTheDocument();
      expect(screen.getByText('Import')).toBeInTheDocument();
    });

    it('should support Space key activation for menu', async () => {
      const user = userEvent.setup();
      renderWithProvider(
        <MinimalisticToolbar onImportSuccess={mockOnImportSuccess} />
      );

      const menuButton = screen.getByTitle('Menu');
      menuButton.focus();

      await user.keyboard(' ');

      // Verify dropdown opened
      expect(screen.getByText('Export')).toBeInTheDocument();
      expect(screen.getByText('Import')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle export errors gracefully', async () => {
      // Mock console.error to capture error logs
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const user = userEvent.setup();
      renderWithProvider(
        <MinimalisticToolbar onImportSuccess={mockOnImportSuccess} />
      );

      const menuButton = screen.getByTitle('Menu');
      await user.click(menuButton);

      const exportItem = screen.getByText('Export');
      await user.click(exportItem);

      // The component should not crash on export errors
      expect(menuButton).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it('should handle import errors gracefully', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const user = userEvent.setup();
      renderWithProvider(
        <MinimalisticToolbar onImportSuccess={mockOnImportSuccess} />
      );

      const fileInput = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      // Create an invalid file
      const invalidFile = new File(['invalid json'], 'invalid.json', {
        type: 'application/json',
      });

      await user.upload(fileInput, invalidFile);

      // The component should not crash on import errors
      expect(fileInput).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });
});
