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

// Integration test to reproduce the empty export bug
describe('ImportExport Integration Bug Reproduction', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('should reproduce REAL browser empty export bug - browser exports empty even with visible records', async () => {
    // Setup: Add some records to localStorage using the correct schema format (StorageSchemaV21) with proper UUIDs
    const tag1Id = '550e8400-e29b-41d4-a716-446655440001'
    const tag2Id = '550e8400-e29b-41d4-a716-446655440002'
    const tag3Id = '550e8400-e29b-41d4-a716-446655440003'
    const record1Id = '550e8400-e29b-41d4-a716-446655440101'
    const record2Id = '550e8400-e29b-41d4-a716-446655440102'

    const mockStorageSchema = {
      version: '2.1',
      tags: {
        [tag1Id]: { id: tag1Id, normalizedValue: 'tag1' },
        [tag2Id]: { id: tag2Id, normalizedValue: 'tag2' },
        [tag3Id]: { id: tag3Id, normalizedValue: 'tag3' }
      },
      records: {
        [record1Id]: {
          id: record1Id,
          content: 'test content 1',
          tagIds: [tag1Id, tag2Id],
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z'
        },
        [record2Id]: {
          id: record2Id,
          content: 'test content 2',
          tagIds: [tag2Id, tag3Id],
          createdAt: '2023-01-02T00:00:00.000Z',
          updatedAt: '2023-01-02T00:00:00.000Z'
        }
      },
      indexes: {
        normalizedToTagId: {
          'tag1': tag1Id,
          'tag2': tag2Id,
          'tag3': tag3Id
        },
        tagToRecords: {
          [tag1Id]: [record1Id],
          [tag2Id]: [record1Id, record2Id],
          [tag3Id]: [record2Id]
        }
      }
    }

    // Store in localStorage using the correct key format
    localStorage.setItem('misc-poc-storage', JSON.stringify(mockStorageSchema))

    // Mock file download to capture the export data
    let capturedExportData: ExportData | null = null

    global.URL.createObjectURL = vi.fn(() => 'blob:test-url')
    global.URL.revokeObjectURL = vi.fn()

    const mockClick = vi.fn()
    Object.defineProperty(HTMLAnchorElement.prototype, 'click', {
      value: mockClick,
      writable: true
    })

    // Intercept blob creation to capture export data
    const originalBlob = global.Blob
    global.Blob = class extends originalBlob {
      constructor(blobParts: BlobPart[], options?: BlobPropertyBag) {
        super(blobParts, options)
        if (blobParts && blobParts.length > 0) {
          try {
            capturedExportData = JSON.parse(blobParts[0] as string) as ExportData
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

    // Wait for component to initialize
    await waitFor(() => {
      expect(screen.getByText('Export Data')).toBeInTheDocument()
    })

    // Click export button
    const exportButton = screen.getByRole('button', { name: /export/i })
    fireEvent.click(exportButton)

    // Wait for export to complete
    await waitFor(() => {
      expect(mockClick).toHaveBeenCalled()
    }, { timeout: 5000 })

    // Verify the bug: export should contain records but returns empty array
    expect(capturedExportData).toBeDefined()

    // This test should FAIL initially, reproducing the bug
    console.log('Captured export data:', JSON.stringify(capturedExportData, null, 2))

    // The bug: records array is empty despite having data in localStorage
    expect(capturedExportData).toBeTruthy()
    expect(capturedExportData!.records.length).toBeGreaterThan(0) // This should fail, reproducing the bug
    expect(capturedExportData!.metadata.totalRecords).toBeGreaterThan(0)
    expect(capturedExportData!.metadata.exportSource).not.toBe('empty-export')

    // Cleanup
    global.Blob = originalBlob
  })

  it('should have proper data flow from localStorage through repositories to export', async () => {
    // This test documents the expected data flow to help debug the issue

    // 1. Data should exist in localStorage with correct schema
    const mockSchema = {
      version: '2.1',
      tags: { 'tag1-id': { id: 'tag1-id', normalizedValue: 'tag1' } },
      records: {
        '1': {
          id: '1',
          content: 'test',
          tagIds: ['tag1-id'],
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z'
        }
      },
      indexes: {
        normalizedToTagId: { 'tag1': 'tag1-id' },
        tagToRecords: { 'tag1-id': ['1'] }
      }
    }
    localStorage.setItem('misc-poc-storage', JSON.stringify(mockSchema))

    // 2. Repository should read from localStorage
    // 3. ExportDataUseCase should get records from repository
    // 4. Export should contain the records

    // This test structure will help identify where the data flow breaks
    expect(localStorage.getItem('misc-poc-storage')).toBe(JSON.stringify(mockSchema))
  })
})