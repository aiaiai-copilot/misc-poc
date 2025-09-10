import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, beforeEach, describe, it, expect, Mock } from 'vitest'
import { MiscInputIntegrated } from '../MiscInputIntegrated'
import { useApplicationContext } from '../../contexts/ApplicationContext'
import { CreateRecordUseCase, SearchRecordsUseCase } from '@misc-poc/application'
import { Ok, Err } from '@misc-poc/shared'
import { DomainError } from '@misc-poc/domain'
import { toast } from 'sonner'

// Mock dependencies
vi.mock('../../contexts/ApplicationContext')
vi.mock('sonner')

const mockCreateRecordUseCase = {
  execute: vi.fn(),
} as unknown as CreateRecordUseCase

const mockSearchRecordsUseCase = {
  execute: vi.fn(),
} as unknown as SearchRecordsUseCase

const mockApplicationContext = {
  createRecordUseCase: mockCreateRecordUseCase,
  searchRecordsUseCase: mockSearchRecordsUseCase,
  updateRecordUseCase: null,
  deleteRecordUseCase: null,
  getTagSuggestionsUseCase: null,
  exportDataUseCase: null,
  importDataUseCase: null,
}

describe('MiscInputIntegrated - Real Timer Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(useApplicationContext as Mock).mockReturnValue(mockApplicationContext)
  })

  describe('Search Integration', () => {
    it('should call search use case after debounce delay', async () => {
      const mockSearchResult = {
        records: [{ id: 'record-1', content: 'test search', tagIds: new Set(['test']) }],
        total: 1,
        hasMore: false,
      }
      
      ;(mockSearchRecordsUseCase.execute as Mock).mockResolvedValue(
        Ok({ searchResult: mockSearchResult })
      )

      const onSearchResults = vi.fn()
      const user = userEvent.setup()
      
      render(<MiscInputIntegrated onSearchResults={onSearchResults} />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, 'test search')
      
      // Wait for the debounce delay (300ms) + some extra time
      await waitFor(() => {
        expect(mockSearchRecordsUseCase.execute).toHaveBeenCalledWith({
          query: 'test search',
          options: {
            limit: 10,
            offset: 0,
            sortBy: 'createdAt',
            sortOrder: 'desc',
          },
        })
      }, { timeout: 1000 })

      await waitFor(() => {
        expect(onSearchResults).toHaveBeenCalledWith(mockSearchResult)
      })
    })

    it('should handle search errors', async () => {
      const error = new DomainError('SEARCH_ERROR', 'Search failed')
      ;(mockSearchRecordsUseCase.execute as Mock).mockResolvedValue(Err(error))

      const onSearchResults = vi.fn()
      const user = userEvent.setup()
      
      render(<MiscInputIntegrated onSearchResults={onSearchResults} />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, 'test')
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Search failed: Search failed')
      }, { timeout: 1000 })

      // The component calls onSearchResults(null) on mount for empty input,
      // but should not call it with search results on error
      expect(onSearchResults).toHaveBeenCalledWith(null)
      expect(onSearchResults).not.toHaveBeenCalledWith(expect.objectContaining({
        records: expect.any(Array)
      }))
    })

    it('should clear search results when input is cleared', async () => {
      const onSearchResults = vi.fn()
      const user = userEvent.setup()
      
      render(<MiscInputIntegrated onSearchResults={onSearchResults} />)
      
      const input = screen.getByRole('textbox')
      
      // Type and then clear
      await user.type(input, 'test')
      await user.clear(input)
      
      // Should call onSearchResults with null when cleared
      await waitFor(() => {
        expect(onSearchResults).toHaveBeenCalledWith(null)
      }, { timeout: 1000 })
    })
  })

  describe('CreateRecord Integration', () => {
    it('should integrate create and search together', async () => {
      // Mock successful creation
      const mockRecord = {
        id: 'record-1',
        content: 'tag1 tag2',
        tagIds: new Set(['tag1', 'tag2']),
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      
      ;(mockCreateRecordUseCase.execute as Mock).mockResolvedValue(
        Ok({ record: mockRecord })
      )

      // Mock search results
      const mockSearchResult = {
        records: [mockRecord],
        total: 1,
        hasMore: false,
      }
      
      ;(mockSearchRecordsUseCase.execute as Mock).mockResolvedValue(
        Ok({ searchResult: mockSearchResult })
      )

      const onSearchResults = vi.fn()
      const onRecordCreated = vi.fn()
      const user = userEvent.setup()
      
      render(
        <MiscInputIntegrated 
          onSearchResults={onSearchResults} 
          onRecordCreated={onRecordCreated}
        />
      )
      
      const input = screen.getByRole('textbox')
      
      // Create a record
      await user.type(input, 'tag1 tag2')
      await user.keyboard('{Enter}')
      
      // Verify creation was called
      await waitFor(() => {
        expect(mockCreateRecordUseCase.execute).toHaveBeenCalledWith({
          content: 'tag1 tag2'
        })
        expect(onRecordCreated).toHaveBeenCalled()
        expect(toast.success).toHaveBeenCalledWith('Record created successfully')
      })
      
      // Verify input was cleared
      expect(input).toHaveValue('')
      
      // Now type again to trigger search
      await user.type(input, 'tag1')
      
      // Wait for search to be called
      await waitFor(() => {
        expect(mockSearchRecordsUseCase.execute).toHaveBeenCalledWith({
          query: 'tag1',
          options: {
            limit: 10,
            offset: 0,
            sortBy: 'createdAt',
            sortOrder: 'desc',
          },
        })
        expect(onSearchResults).toHaveBeenCalledWith(mockSearchResult)
      }, { timeout: 1000 })
    })
  })
})