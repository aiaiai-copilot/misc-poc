import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ImportExport } from '../ImportExport'
import { ApplicationContextProvider } from '../../contexts/ApplicationContext'

// Type for export data structure
interface ExportData {
  records: Array<{
    id: string
    content: string
    tagIds: string[]
    createdAt: string
    updatedAt: string
  }>
  metadata: {
    totalRecords: number
    exportSource: string
  }
}

// Test that reproduces the ACTUAL browser bug: localStorage has schema but records:{} is empty
describe('ImportExport Real Browser Bug Reproduction', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('should reproduce the exact browser state - schema exists but records object is empty', async () => {
    // Reproduce EXACT localStorage state from browser DevTools
    const exactBrowserState = {
      "version": "2.1",
      "tags": {
        "3697537c-346c-4521-87e4-bd1306f1164a": {
          "id": "3697537c-346c-4521-87e4-bd1306f1164a",
          "normalizedValue": "2"
        },
        "2bd3a6f1-673c-4693-99ef-65e8f1e076ed": {
          "id": "2bd3a6f1-673c-4693-99ef-65e8f1e076ed",
          "normalizedValue": "2"
        },
        "ec764865-a039-4718-9c65-49285d1159ef": {
          "id": "ec764865-a039-4718-9c65-49285d1159ef",
          "normalizedValue": "3"
        }
      },
      "records": {}, // THIS IS THE BUG - records is empty but UI shows data!
      "indexes": {
        "normalizedToTagId": {
          "1": "3697537c-346c-4521-87e4-bd1306f1164a",
          "2": "2bd3a6f1-673c-4693-99ef-65e8f1e076ed",
          "3": "ec764865-a039-4718-9c65-49285d1159ef"
        },
        "tagToRecords": {}
      }
    }

    // Set the EXACT localStorage state from browser
    localStorage.setItem('misc-poc-storage', JSON.stringify(exactBrowserState))

    // Mock file download to capture export data
    let capturedExportData: ExportData | null = null

    global.URL.createObjectURL = vi.fn(() => 'blob:test-url')
    global.URL.revokeObjectURL = vi.fn()

    const mockClick = vi.fn()
    Object.defineProperty(HTMLAnchorElement.prototype, 'click', {
      value: mockClick,
      writable: true
    })

    const originalBlob = global.Blob
    global.Blob = class extends originalBlob {
      constructor(blobParts: BlobPart[], options?: BlobPropertyBag) {
        super(blobParts, options)
        if (blobParts && blobParts.length > 0) {
          try {
            capturedExportData = JSON.parse(blobParts[0] as string)
          } catch (error) {
            console.error('Failed to parse export data:', error)
          }
        }
      }
    } as typeof Blob

    render(
      <ApplicationContextProvider>
        <ImportExport />
      </ApplicationContextProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Export Data')).toBeInTheDocument()
    })

    // Export should work
    const exportButton = screen.getByRole('button', { name: /export/i })
    fireEvent.click(exportButton)

    await waitFor(() => {
      expect(mockClick).toHaveBeenCalled()
    }, { timeout: 5000 })

    console.log('Captured export from browser-like state:', JSON.stringify(capturedExportData, null, 2))

    // This should FAIL initially - reproducing the bug
    expect(capturedExportData).toBeDefined()
    expect(capturedExportData.records.length).toBeGreaterThan(0) // This WILL fail, reproducing the exact bug
    expect(capturedExportData.metadata.exportSource).not.toBe('empty-export')

    global.Blob = originalBlob
  })

  it('should identify why records object is empty when UI shows data', () => {
    // This test will help identify the data source mismatch

    // Question: Where does the UI (showing "3", "2", "1") get its data from?
    // Options:
    // 1. Different localStorage key
    // 2. In-memory state that's not persisted
    // 3. Different repository implementation for UI vs Export
    // 4. Data corruption/synchronization issue

    console.log('🐛 BUG ANALYSIS:')
    console.log('- UI shows: Records "3", "2", "1"')
    console.log('- localStorage misc-poc-storage has: records: {} (empty)')
    console.log('- Export reads from: localStorage via ExportDataUseCase -> RecordRepository')
    console.log('- UI reads from: ??? (different source)')

    expect(true).toBe(true) // This test is for analysis
  })
})