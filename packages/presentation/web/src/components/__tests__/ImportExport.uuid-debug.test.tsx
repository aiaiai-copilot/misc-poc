import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ImportExport } from '../ImportExport'
import { ApplicationContextProvider } from '../../contexts/ApplicationContext'

// Test to debug UUID validation issues in record mapping
describe('ImportExport UUID Debug', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('should debug UUID validation issues in repository mapping', async () => {
    console.log('🔍 DEBUGGING UUID VALIDATION ISSUES')

    // Set up localStorage with the actual browser data structure
    // Using the exact same UUIDs from the browser DevTools screenshot
    const actualBrowserData = {
      "version": "2.1",
      "tags": {
        "3697537c-346c-4521-87e4-bd1306f1164a": {
          "id": "3697537c-346c-4521-87e4-bd1306f1164a",
          "normalizedValue": "1"
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
      "records": {
        "550e8400-e29b-41d4-a716-446655440001": {
          "id": "550e8400-e29b-41d4-a716-446655440001",
          "content": "1",
          "tagIds": ["3697537c-346c-4521-87e4-bd1306f1164a"],
          "createdAt": "2023-01-01T00:00:00.000Z",
          "updatedAt": "2023-01-01T00:00:00.000Z"
        },
        "550e8400-e29b-41d4-a716-446655440002": {
          "id": "550e8400-e29b-41d4-a716-446655440002",
          "content": "2",
          "tagIds": ["2bd3a6f1-673c-4693-99ef-65e8f1e076ed"],
          "createdAt": "2023-01-02T00:00:00.000Z",
          "updatedAt": "2023-01-02T00:00:00.000Z"
        },
        "550e8400-e29b-41d4-a716-446655440003": {
          "id": "550e8400-e29b-41d4-a716-446655440003",
          "content": "3",
          "tagIds": ["ec764865-a039-4718-9c65-49285d1159ef"],
          "createdAt": "2023-01-03T00:00:00.000Z",
          "updatedAt": "2023-01-03T00:00:00.000Z"
        }
      },
      "indexes": {
        "normalizedToTagId": {
          "1": "3697537c-346c-4521-87e4-bd1306f1164a",
          "2": "2bd3a6f1-673c-4693-99ef-65e8f1e076ed",
          "3": "ec764865-a039-4718-9c65-49285d1159ef"
        },
        "tagToRecords": {
          "3697537c-346c-4521-87e4-bd1306f1164a": ["550e8400-e29b-41d4-a716-446655440001"],
          "2bd3a6f1-673c-4693-99ef-65e8f1e076ed": ["550e8400-e29b-41d4-a716-446655440002"],
          "ec764865-a039-4718-9c65-49285d1159ef": ["550e8400-e29b-41d4-a716-446655440003"]
        }
      }
    }

    localStorage.setItem('misc-poc-storage', JSON.stringify(actualBrowserData))

    console.log('✅ Set up localStorage with 3 records')
    console.log('Record IDs:', Object.keys(actualBrowserData.records))
    console.log('Tag IDs:', Object.keys(actualBrowserData.tags))

    // Test UUID validation manually
    const recordIds = Object.keys(actualBrowserData.records)
    const tagIds = Object.keys(actualBrowserData.tags)

    console.log('🧪 Testing UUID validation:')
    recordIds.forEach((id, index) => {
      console.log(`Record ${index + 1} ID: "${id}" - Length: ${id.length}`)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      console.log(`  Valid UUID format: ${uuidRegex.test(id)}`)
    })

    tagIds.forEach((id, index) => {
      console.log(`Tag ${index + 1} ID: "${id}" - Length: ${id.length}`)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      console.log(`  Valid UUID format: ${uuidRegex.test(id)}`)
    })

    // Now test export
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

    const exportButton = screen.getByRole('button', { name: /export/i })
    fireEvent.click(exportButton)

    await waitFor(() => {
      expect(mockClick).toHaveBeenCalled()
    }, { timeout: 5000 })

    console.log('📤 EXPORT RESULT with valid UUIDs:', JSON.stringify(capturedExportData, null, 2))

    // This should work now with proper UUIDs
    expect(capturedExportData).toBeDefined()
    if (capturedExportData.records.length === 0) {
      console.log('❌ Still getting empty export - there may be other issues')
    } else {
      console.log('✅ Export working with proper UUIDs!')
    }

    global.Blob = originalBlob
  })
})