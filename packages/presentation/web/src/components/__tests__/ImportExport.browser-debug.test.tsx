import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ImportExport } from '../ImportExport'
import { ApplicationContextProvider } from '../../contexts/ApplicationContext'

// Test to debug real browser localStorage content
describe('ImportExport Browser Debug', () => {
  beforeEach(() => {
    // DON'T clear localStorage - we want to see what's actually there
    vi.clearAllMocks()
  })

  it('should debug what is actually in browser localStorage', async () => {
    console.log('=== DEBUGGING BROWSER LOCALSTORAGE ===')

    // Check all localStorage keys
    console.log('All localStorage keys:', Object.keys(localStorage))

    // Check specific keys that might contain records
    const possibleKeys = [
      'misc-poc-storage',
      'misc-poc-storage-records',
      'misc-poc-records',
      'records',
      'data'
    ]

    for (const key of possibleKeys) {
      const value = localStorage.getItem(key)
      if (value) {
        console.log(`localStorage['${key}']:`, value.substring(0, 200) + (value.length > 200 ? '...' : ''))
        try {
          const parsed = JSON.parse(value)
          console.log(`Parsed ${key}:`, {
            type: Array.isArray(parsed) ? 'array' : typeof parsed,
            length: Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length,
            keys: Array.isArray(parsed) ? 'array' : Object.keys(parsed).slice(0, 5)
          })
        } catch (e) {
          console.log(`Failed to parse ${key}:`, e.message)
        }
      }
    }

    // Check all localStorage items
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        const value = localStorage.getItem(key)
        console.log(`localStorage.key(${i}) = '${key}':`, value?.substring(0, 100))
      }
    }

    console.log('=== END DEBUGGING ===')

    // This test should always pass - it's just for debugging
    expect(true).toBe(true)
  })

  it('should test export with ACTUAL browser data', async () => {
    console.log('=== TESTING EXPORT WITH ACTUAL DATA ===')

    // Mock file download to capture the export data
    let capturedExportData: unknown = null

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
            capturedExportData = JSON.parse(blobParts[0] as string)
            console.log('CAPTURED REAL EXPORT DATA:', JSON.stringify(capturedExportData, null, 2))
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

    console.log('Export completed, captured data:', capturedExportData as Record<string, unknown>)

    // Don't fail the test, just report what we found
    expect(capturedExportData).toBeDefined()

    // Cleanup
    global.Blob = originalBlob
  })
})