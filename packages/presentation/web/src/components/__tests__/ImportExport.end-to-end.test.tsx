import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ImportExport } from '../ImportExport'
import { MiscInputIntegrated } from '../MiscInputIntegrated'
import { ApplicationContextProvider } from '../../contexts/ApplicationContext'
import { ExportData } from '@misc-poc/application'

// End-to-end test: Create record through UI, then export should contain that record
describe('ImportExport End-to-End Integration', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('should export records that were created through the UI', async () => {
    console.log('🧪 TESTING: Create record → Export record (end-to-end)')

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

    const TestComponent = (): React.ReactElement => {
      return (
        <ApplicationContextProvider>
          <div>
            <MiscInputIntegrated
              placeholder="Enter tags separated by spaces..."
              onRecordCreated={() => {
                console.log('🎉 Record creation callback fired!')
                const storage = localStorage.getItem('misc-poc-storage')
                if (storage) {
                  const parsed = JSON.parse(storage)
                  console.log('📊 Storage after record created:', parsed)
                }
              }}
            />
            <ImportExport />
          </div>
        </ApplicationContextProvider>
      )
    }

    render(<TestComponent />)

    // Wait for components to initialize
    await waitFor(() => {
      expect(screen.getByText('Export Data')).toBeInTheDocument()
    })

    // Wait for application context to fully initialize
    // The input should not be disabled once the context is ready
    await waitFor(() => {
      const input = screen.getByPlaceholderText('Enter tags separated by spaces...')
      expect(input).not.toBeDisabled()
      expect(input).not.toHaveAttribute('placeholder', 'Creating...')
    }, { timeout: 3000 })

    // Debug: Check application context state
    console.log('🔍 Checking ApplicationContext availability...')
    console.log('📊 Initial localStorage state:')
    console.log('Keys:', Object.keys(localStorage))
    const initialStorage = localStorage.getItem('misc-poc-storage')
    console.log('📊 Initial storage content:', initialStorage)
    if (initialStorage) {
      const parsed = JSON.parse(initialStorage)
      console.log('Records count:', Object.keys(parsed.records || {}).length)
    }

    // Mock console.error to catch any silent failures
    const originalConsoleError = console.error
    const errorLogs: string[] = []
    console.error = (...args: unknown[]): void => {
      errorLogs.push(args.join(' '))
      originalConsoleError(...args)
    }

    // Step 1: Create a record through the UI
    const input = screen.getByPlaceholderText('Enter tags separated by spaces...')
    console.log('🎯 Found input element, preparing to create record...')

    // Type tags and submit
    await act(async () => {
      fireEvent.change(input, { target: { value: 'test tag1 tag2' } })
      console.log('🎯 Typed in input, now pressing Enter...')
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
      console.log('🎯 Enter key pressed')
    })

    console.log('🎯 Checking for any errors that occurred:', errorLogs)

    // Wait for record creation to complete
    await waitFor(() => {
      // Check if record was created
      console.log('📊 After record creation localStorage state:')
      const storage = localStorage.getItem('misc-poc-storage')
      if (storage) {
        const parsed = JSON.parse(storage)
        console.log('Records count:', Object.keys(parsed.records || {}).length)
        console.log('Records:', parsed.records)
        if (Object.keys(parsed.records || {}).length > 0) {
          return true // Success condition
        }
      }
      // Also check if toast was called (success indication)
      const input = screen.getByPlaceholderText('Enter tags separated by spaces...')
      if (input.value === '') {
        // Input was cleared, which means record was likely created successfully
        const storage2 = localStorage.getItem('misc-poc-storage')
        if (storage2) {
          const parsed2 = JSON.parse(storage2)
          if (Object.keys(parsed2.records || {}).length > 0) {
            return true
          }
        }
      }
      throw new Error('Record not created yet')
    }, { timeout: 8000 })

    // Step 2: Export the data
    const exportButton = screen.getByRole('button', { name: /export/i })

    await act(async () => {
      fireEvent.click(exportButton)
    })

    await waitFor(() => {
      expect(mockClick).toHaveBeenCalled()
    }, { timeout: 5000 })

    console.log('📤 EXPORT RESULT:', JSON.stringify(capturedExportData, null, 2))

    // The test should PASS - export should contain the record we just created
    expect(capturedExportData).toBeDefined()
    expect(capturedExportData.records).toBeDefined()
    expect(capturedExportData.records.length).toBeGreaterThan(0) // This should PASS for proper integration
    expect(capturedExportData.metadata.totalRecords).toBeGreaterThan(0)
    expect(capturedExportData.metadata.exportSource).not.toBe('empty-export')

    // Verify the content matches what we created
    expect(capturedExportData.records[0].content).toContain('test')

    // Cleanup
    global.Blob = originalBlob
    console.error = originalConsoleError

    if (errorLogs.length > 0) {
      console.log('🚨 Errors that occurred during test:', errorLogs)
    }
  })
})