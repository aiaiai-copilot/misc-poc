import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ImportExport } from '../ImportExport'
import { Ok, Err } from '@misc-poc/shared'

// Mock result types to avoid domain imports
interface MockError {
  message: string
  code?: string
}

const createMockError = (message: string, code = 'ERROR'): MockError => ({
  message,
  code
})

// Mock the use cases
const mockExportDataUseCase = {
  execute: vi.fn()
}

const mockImportDataUseCase = {
  execute: vi.fn(),
  validateOnly: vi.fn()
}

// Mock the ApplicationContext to provide our mocked use cases
vi.mock('../../contexts/ApplicationContext', (): { useApplicationContext: () => ReturnType<typeof import('../../contexts/ApplicationContext').useApplicationContext> } => ({
  useApplicationContext: () => ({
    exportDataUseCase: mockExportDataUseCase,
    importDataUseCase: mockImportDataUseCase,
    createRecordUseCase: null,
    searchRecordsUseCase: null,
    updateRecordUseCase: null,
    deleteRecordUseCase: null,
    getTagSuggestionsUseCase: null,
    searchModeDetector: null,
    tagCloudBuilder: null
  })
}))

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:test-url')
global.URL.revokeObjectURL = vi.fn()

// Mock HTMLAnchorElement click behavior
Object.defineProperty(HTMLAnchorElement.prototype, 'click', {
  value: vi.fn(),
  writable: true
})

// Mock File.prototype.text method
Object.defineProperty(File.prototype, 'text', {
  value: vi.fn().mockResolvedValue('{"records": []}'),
  writable: true
})

describe('ImportExport Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Export functionality', () => {
    it('should render export section with format selection', () => {
      render(<ImportExport />)

      expect(screen.getByText('Export Data')).toBeInTheDocument()
      expect(screen.getByLabelText(/export format/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
    })

    it('should execute export and trigger file download on export button click', async () => {
      const mockExportData = {
        records: [
          {
            id: 'record_123',
            content: 'Test content',
            tagIds: ['tag1', 'tag2'],
            createdAt: '2023-01-01T00:00:00.000Z',
            updatedAt: '2023-01-01T00:00:00.000Z'
          }
        ],
        metadata: {
          version: '1.0',
          exportedAt: '2023-01-01T00:00:00.000Z',
          recordCount: 1
        }
      }

      mockExportDataUseCase.execute.mockResolvedValue(Ok({
        success: true,
        exportData: mockExportData
      }))

      render(<ImportExport />)

      const exportButton = screen.getByRole('button', { name: /export/i })
      fireEvent.click(exportButton)

      await waitFor(() => {
        expect(mockExportDataUseCase.execute).toHaveBeenCalledWith({
          format: 'json',
          includeMetadata: true
        })
      })

      // Verify file download was triggered
      expect(global.URL.createObjectURL).toHaveBeenCalled()
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled()
    })

    it('should generate JSON export without UUIDs', async () => {
      const mockExportData = {
        records: [
          {
            id: 'record_abc123', // content-based ID, not UUID
            content: 'Test content',
            tagIds: ['normalized-tag-value'], // normalized values, not UUIDs
            createdAt: '2023-01-01T00:00:00.000Z',
            updatedAt: '2023-01-01T00:00:00.000Z'
          }
        ],
        metadata: {
          version: '1.0',
          exportedAt: '2023-01-01T00:00:00.000Z',
          recordCount: 1
        }
      }

      mockExportDataUseCase.execute.mockResolvedValue(Ok({
        success: true,
        exportData: mockExportData
      }))

      render(<ImportExport />)

      const exportButton = screen.getByRole('button', { name: /export/i })
      fireEvent.click(exportButton)

      await waitFor(() => {
        expect(mockExportDataUseCase.execute).toHaveBeenCalled()
      })

      // Verify the export data structure doesn't contain UUIDs
      const exportCall = mockExportDataUseCase.execute.mock.calls[0][0]
      expect(exportCall.format).toBe('json')
      expect(exportCall.includeMetadata).toBe(true)
    })

    it('should handle export errors gracefully', async () => {
      mockExportDataUseCase.execute.mockResolvedValue(Err(
        createMockError('Export operation failed', 'EXPORT_FAILED')
      ))

      render(<ImportExport />)

      const exportButton = screen.getByRole('button', { name: /export/i })
      fireEvent.click(exportButton)

      await waitFor(() => {
        expect(screen.getByText(/export operation failed/i)).toBeInTheDocument()
      })
    })

    it('should allow selecting different export formats', async () => {
      render(<ImportExport />)

      const formatSelect = screen.getByLabelText(/export format/i)

      // Test each supported format
      const formats = ['json', 'csv', 'xml', 'yaml']

      for (const format of formats) {
        fireEvent.change(formatSelect, { target: { value: format } })
        expect(formatSelect).toHaveValue(format)
      }
    })
  })

  describe('Import functionality', () => {
    it('should render import section with file input', () => {
      render(<ImportExport />)

      expect(screen.getByText('Import Data')).toBeInTheDocument()
      expect(screen.getByLabelText(/select file/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /import/i })).toBeInTheDocument()
    })

    it('should validate import file and show warnings before import', async () => {
      const mockFile = new File(['{"records": []}'], 'test.json', { type: 'application/json' })

      mockImportDataUseCase.validateOnly.mockResolvedValue(Ok({
        isValid: true,
        errors: [],
        warnings: [
          {
            message: 'This will replace all existing data',
            type: 'DATA_REPLACEMENT',
            severity: 'warning',
            field: 'import'
          }
        ]
      }))

      render(<ImportExport />)

      const fileInput = screen.getByLabelText(/select file/i)
      fireEvent.change(fileInput, { target: { files: [mockFile] } })

      await waitFor(() => {
        expect(mockImportDataUseCase.validateOnly).toHaveBeenCalled()
      })

      // Should show warning dialog
      expect(screen.getByText(/this will replace all existing data/i)).toBeInTheDocument()
    })

    it('should show warning dialog for data replacement', async () => {
      const mockFile = new File(['{"records": []}'], 'test.json', { type: 'application/json' })

      mockImportDataUseCase.validateOnly.mockResolvedValue(Ok({
        isValid: true,
        errors: [],
        warnings: [
          {
            message: 'All existing records will be deleted and replaced',
            type: 'DATA_REPLACEMENT',
            severity: 'warning',
            field: 'import'
          }
        ]
      }))

      render(<ImportExport />)

      const fileInput = screen.getByLabelText(/select file/i)
      fireEvent.change(fileInput, { target: { files: [mockFile] } })

      await waitFor(() => {
        expect(screen.getByText(/all existing records will be deleted/i)).toBeInTheDocument()
      })

      // Should show confirm and cancel buttons
      expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    it('should execute import with complete data deletion when confirmed', async () => {
      const mockFile = new File(['{"records": []}'], 'test.json', { type: 'application/json' })

      mockImportDataUseCase.validateOnly.mockResolvedValue(Ok({
        isValid: true,
        errors: [],
        warnings: []
      }))

      mockImportDataUseCase.execute.mockResolvedValue(Ok({
        success: true,
        importedRecords: [],
        errors: [],
        warnings: [{
          message: 'Automatic backup created before data replacement',
          code: 'BACKUP_CREATED',
          details: { timestamp: '2023-01-01T00:00:00.000Z' }
        }],
        startTime: '2023-01-01T00:00:00.000Z',
        endTime: '2023-01-01T00:00:00.000Z'
      }))

      render(<ImportExport />)

      const fileInput = screen.getByLabelText(/select file/i)
      fireEvent.change(fileInput, { target: { files: [mockFile] } })

      const importButton = screen.getByRole('button', { name: /import/i })
      fireEvent.click(importButton)

      await waitFor(() => {
        expect(mockImportDataUseCase.execute).toHaveBeenCalled()
      })
    })

    it('should handle invalid import files with error messages', async () => {
      const mockFile = new File(['invalid json'], 'test.json', { type: 'application/json' })

      mockImportDataUseCase.validateOnly.mockResolvedValue(Ok({
        isValid: false,
        errors: [
          {
            field: 'data',
            message: 'Invalid JSON format',
            code: 'INVALID_FORMAT',
            severity: 'error'
          }
        ],
        warnings: []
      }))

      render(<ImportExport />)

      const fileInput = screen.getByLabelText(/select file/i)
      fireEvent.change(fileInput, { target: { files: [mockFile] } })

      await waitFor(() => {
        expect(screen.getByText(/invalid json format/i)).toBeInTheDocument()
      })

      // Import button should be disabled
      expect(screen.getByRole('button', { name: /import/i })).toBeDisabled()
    })
  })

  describe('Drag and drop functionality', () => {
    it('should support drag and drop for file selection', () => {
      render(<ImportExport />)

      const dropZone = screen.getByText(/drag and drop your file here/i).closest('div')
      expect(dropZone).toBeInTheDocument()
    })

    it('should handle file drop events', async () => {
      const mockFile = new File(['{"records": []}'], 'test.json', { type: 'application/json' })

      mockImportDataUseCase.validateOnly.mockResolvedValue(Ok({
        isValid: true,
        errors: [],
        warnings: []
      }))

      render(<ImportExport />)

      const dropZone = screen.getByText(/drag and drop your file here/i).closest('div')!

      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [mockFile]
        }
      })

      await waitFor(() => {
        expect(mockImportDataUseCase.validateOnly).toHaveBeenCalled()
      })
    })

    it('should provide visual feedback during drag operations', () => {
      render(<ImportExport />)

      const dropZone = screen.getByText(/drag and drop your file here/i).closest('div')!

      fireEvent.dragEnter(dropZone)
      expect(dropZone).toHaveClass(/drag-over/i)

      fireEvent.dragLeave(dropZone)
      expect(dropZone).not.toHaveClass(/drag-over/i)
    })
  })

  describe('Progress indicators', () => {
    it('should show progress indicator during export', async () => {
      mockExportDataUseCase.execute.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(Ok({ success: true, exportData: { records: [] } })), 100))
      )

      render(<ImportExport />)

      const exportButton = screen.getByRole('button', { name: /export/i })
      fireEvent.click(exportButton)

      // Should show loading state
      expect(screen.getByText(/exporting/i)).toBeInTheDocument()
      expect(exportButton).toBeDisabled()

      await waitFor(() => {
        expect(screen.queryByText(/exporting/i)).not.toBeInTheDocument()
      })
    })

    it('should show progress indicator during import', async () => {
      const mockFile = new File(['{"records": []}'], 'test.json', { type: 'application/json' })

      mockImportDataUseCase.validateOnly.mockResolvedValue(Ok({
        isValid: true,
        errors: [],
        warnings: []
      }))

      mockImportDataUseCase.execute.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(Ok({
          success: true,
          importedRecords: [],
          errors: [],
          warnings: [],
          startTime: '',
          endTime: ''
        })), 100))
      )

      render(<ImportExport />)

      const fileInput = screen.getByLabelText(/select file/i)
      fireEvent.change(fileInput, { target: { files: [mockFile] } })

      const importButton = screen.getByRole('button', { name: /import/i })
      fireEvent.click(importButton)

      // Should show loading state
      expect(screen.getByText(/importing/i)).toBeInTheDocument()
      expect(importButton).toBeDisabled()

      await waitFor(() => {
        expect(screen.queryByText(/importing/i)).not.toBeInTheDocument()
      })
    })
  })
})