import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ImportExport } from '../ImportExport'
import { MiscInput } from '../MiscInput'
import { ApplicationContextProvider } from '../../contexts/ApplicationContext'

// End-to-end test: Create record through UI, then export should contain that record
describe('ImportExport End-to-End Integration', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('should export records that were created through the UI', async () => {
    console.log('🧪 TESTING: Create record → Export record (end-to-end)')

    // Mock file download to capture export data
    let capturedExportData: any = null

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
    } as any

    const TestComponent = () => {
      const [inputValue, setInputValue] = React.useState('')

      const handleSubmit = async (tags: string[]) => {
        console.log('Creating record with tags:', tags)
        // Here we would normally call createRecord - but for this test we need to ensure it's integrated
        setInputValue('')
      }

      return (
        <ApplicationContextProvider>
          <div>
            <MiscInput
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handleSubmit}
              allTags={[]}
              placeholder="Enter tags separated by spaces..."
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

    console.log('📊 Initial localStorage state:')
    console.log('Keys:', Object.keys(localStorage))
    const initialStorage = localStorage.getItem('misc-poc-storage')
    if (initialStorage) {
      const parsed = JSON.parse(initialStorage)
      console.log('Records count:', Object.keys(parsed.records || {}).length)
    }

    // Step 1: Create a record through the UI
    const input = screen.getByPlaceholderText('Enter tags separated by spaces...')

    // Type tags and submit
    fireEvent.change(input, { target: { value: 'test tag1 tag2' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    // Wait for record creation to complete
    await waitFor(() => {
      // Check if record was created
      console.log('📊 After record creation localStorage state:')
      const storage = localStorage.getItem('misc-poc-storage')
      if (storage) {
        const parsed = JSON.parse(storage)
        console.log('Records count:', Object.keys(parsed.records || {}).length)
        console.log('Records:', parsed.records)
      }
    }, { timeout: 3000 })

    // Step 2: Export the data
    const exportButton = screen.getByRole('button', { name: /export/i })
    fireEvent.click(exportButton)

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

    global.Blob = originalBlob
  })
})