import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, Mock } from 'vitest'
import IntegratedIndex from '../IntegratedIndex'
import { useRecordsIntegrated } from '../../hooks/useRecordsIntegrated'
import { useApplicationContext } from '../../contexts/ApplicationContext'
import { DisplayMode } from '@misc-poc/application'

// Mock the hooks
vi.mock('../../hooks/useRecordsIntegrated')
vi.mock('../../contexts/ApplicationContext')
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

const mockUseRecordsIntegrated = useRecordsIntegrated as Mock
const mockUseApplicationContext = useApplicationContext as Mock

describe('IntegratedIndex', () => {
  const mockCreateRecord = vi.fn()
  const mockSetSearchQuery = vi.fn()
  const mockPerformSearch = vi.fn()
  const mockSearchModeDetector = {
    detectMode: vi.fn().mockReturnValue(DisplayMode.LIST)
  }
  const mockTagCloudBuilder = {
    buildFromSearchResult: vi.fn().mockResolvedValue([])
  }

  beforeEach(() => {
    vi.clearAllMocks()

    mockUseRecordsIntegrated.mockReturnValue({
      filteredRecords: [],
      tagFrequencies: [],
      allTags: [],
      setSearchQuery: mockSetSearchQuery,
      createRecord: mockCreateRecord,
      updateRecord: vi.fn(),
      deleteRecord: vi.fn(),
      performSearch: mockPerformSearch,
    })

    mockUseApplicationContext.mockReturnValue({
      searchModeDetector: mockSearchModeDetector,
      tagCloudBuilder: mockTagCloudBuilder,
    })
  })

  it('should not call performSearch when input is cleared after record creation', async () => {
    const user = userEvent.setup()
    
    // Mock successful record creation
    mockCreateRecord.mockResolvedValue(true)
    
    render(<IntegratedIndex />)
    
    // Find input field and type tags
    const input = screen.getByPlaceholderText(/enter tags/i)
    await user.type(input, 'test tag')
    
    // Submit the form (simulate Enter key)
    await user.keyboard('{Enter}')
    
    // Wait for the debounced effect
    await waitFor(() => {
      expect(mockCreateRecord).toHaveBeenCalledWith(['test', 'tag'])
    })
    
    // Wait for input to be cleared and debounced search
    await waitFor(() => {
      expect(mockSetSearchQuery).toHaveBeenCalledWith('')
    }, { timeout: 500 })
    
    // The bug: performSearch should NOT be called when input is cleared after creation
    // This test reproduces the issue where performSearch('') overwrites local state
    expect(mockPerformSearch).not.toHaveBeenCalledWith('')
  })

  it('reproduces bug: record disappears after creation when performSearch is called', async () => {
    const user = userEvent.setup()
    
    // Start with empty records
    mockUseRecordsIntegrated.mockReturnValue({
      filteredRecords: [],
      tagFrequencies: [],
      allTags: [],
      setSearchQuery: mockSetSearchQuery,
      createRecord: mockCreateRecord,
      updateRecord: vi.fn(),
      deleteRecord: vi.fn(),
      performSearch: mockPerformSearch,
    })
    
    // Mock successful record creation
    mockCreateRecord.mockResolvedValue(true)
    
    render(<IntegratedIndex />)
    
    // Find input and create record
    const input = screen.getByPlaceholderText(/enter tags/i)
    await user.type(input, 'test tag')
    await user.keyboard('{Enter}')
    
    // Wait for createRecord to be called
    await waitFor(() => {
      expect(mockCreateRecord).toHaveBeenCalledWith(['test', 'tag'])
    })
    
    // Wait for input to be cleared and search query to be set
    await waitFor(() => {
      expect(mockSetSearchQuery).toHaveBeenCalledWith('')
    }, { timeout: 500 })
    
    // This test documents the expected behavior:
    // performSearch should NOT be called when clearing input after record creation
    // because it would overwrite the local state with server results
    expect(mockPerformSearch).not.toHaveBeenCalledWith('')
  })

  it('should call setSearchQuery when input changes (for filtering)', async () => {
    const user = userEvent.setup()
    
    render(<IntegratedIndex />)
    
    const input = screen.getByPlaceholderText(/enter tags/i)
    await user.type(input, 'search')
    
    // Wait for debounced search query
    await waitFor(() => {
      expect(mockSetSearchQuery).toHaveBeenCalledWith('search')
    }, { timeout: 500 })
  })

  it('should handle duplicate record creation properly', async () => {
    const user = userEvent.setup()
    
    // First creation succeeds
    mockCreateRecord.mockResolvedValueOnce(true)
    // Second creation (duplicate) fails
    mockCreateRecord.mockResolvedValueOnce(false)
    
    render(<IntegratedIndex />)
    
    const input = screen.getByPlaceholderText(/enter tags/i)
    
    // Create first record
    await user.type(input, 'test duplicate')
    await user.keyboard('{Enter}')
    
    await waitFor(() => {
      expect(mockCreateRecord).toHaveBeenCalledWith(['test', 'duplicate'])
    })
    
    // Create duplicate record (same tags)
    await user.type(input, 'test duplicate')
    await user.keyboard('{Enter}')
    
    await waitFor(() => {
      expect(mockCreateRecord).toHaveBeenCalledTimes(2)
      expect(mockCreateRecord).toHaveBeenLastCalledWith(['test', 'duplicate'])
    })
    
    // Should show error toast for duplicate (mocked in setup)
    // The actual duplicate handling is tested in the use case tests
  })
})