import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, beforeEach, describe, it, expect, Mock, afterEach } from 'vitest'
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

describe('MiscInputIntegrated - CreateRecord Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(useApplicationContext as Mock).mockReturnValue(mockApplicationContext)
  })

  describe('Record Creation via Enter Key', () => {
    it('should call createRecord use case when Enter is pressed with tags', async () => {
      const mockRecordDTO = {
        id: 'record-1',
        content: 'tag1 tag2',
        tagIds: new Set(['tag1', 'tag2']),
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      
      ;(mockCreateRecordUseCase.execute as Mock).mockResolvedValue(
        Ok({ record: mockRecordDTO })
      )

      const user = userEvent.setup()
      render(<MiscInputIntegrated />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, 'tag1 tag2')
      await user.keyboard('{Enter}')
      
      expect(mockCreateRecordUseCase.execute).toHaveBeenCalledWith({
        content: 'tag1 tag2'
      })
    })

    it('should show loading state during record creation', async () => {
      let resolvePromise: (value: unknown) => void
      const promise = new Promise((resolve) => {
        resolvePromise = resolve
      })

      ;(mockCreateRecordUseCase.execute as Mock).mockReturnValue(promise)

      const user = userEvent.setup()
      render(<MiscInputIntegrated />)

      const input = screen.getByRole('textbox')
      await act(async () => {
        await user.type(input, 'tag1 tag2')
        await user.keyboard('{Enter}')
      })

      // Check loading state
      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeDisabled()
        expect(screen.getByText(/creating/i)).toBeInTheDocument()
      })

      // Resolve the promise
      await act(async () => {
        resolvePromise!(Ok({ record: { id: 'test' } }))
      })
    })

    it('should clear input and show success toast on successful creation', async () => {
      const mockRecordDTO = {
        id: 'record-1',
        content: 'tag1 tag2',
        tagIds: new Set(['tag1', 'tag2']),
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      
      ;(mockCreateRecordUseCase.execute as Mock).mockResolvedValue(
        Ok({ record: mockRecordDTO })
      )

      const user = userEvent.setup()
      render(<MiscInputIntegrated />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, 'tag1 tag2')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(input).toHaveValue('')
        expect(toast.success).toHaveBeenCalledWith('Record created successfully')
      })
    })

    it('should show error toast and keep input on creation failure', async () => {
      const error = new DomainError('DUPLICATE_RECORD', 'Record already exists')
      ;(mockCreateRecordUseCase.execute as Mock).mockResolvedValue(Err(error))

      const user = userEvent.setup()
      render(<MiscInputIntegrated />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, 'tag1 tag2')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(input).toHaveValue('tag1 tag2')
        expect(toast.error).toHaveBeenCalledWith('Failed to create record: Record already exists')
      })
    })

    it('should not submit empty input', async () => {
      const user = userEvent.setup()
      render(<MiscInputIntegrated />)
      
      const input = screen.getByRole('textbox')
      await user.keyboard('{Enter}')
      
      expect(mockCreateRecordUseCase.execute).not.toHaveBeenCalled()
      expect(input).toHaveValue('')
    })

    it('should trim whitespace before submitting', async () => {
      ;(mockCreateRecordUseCase.execute as Mock).mockResolvedValue(
        Ok({ record: { id: 'test' } })
      )

      const user = userEvent.setup()
      render(<MiscInputIntegrated />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, '  tag1   tag2  ')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(mockCreateRecordUseCase.execute).toHaveBeenCalledWith({
          content: 'tag1 tag2'
        })
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      ;(mockCreateRecordUseCase.execute as Mock).mockRejectedValue(
        new Error('Network error')
      )

      const user = userEvent.setup()
      render(<MiscInputIntegrated />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, 'tag1 tag2')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('An unexpected error occurred')
        expect(input).toHaveValue('tag1 tag2')
      })
    })

    it('should handle use case not available', async () => {
      ;(useApplicationContext as Mock).mockReturnValue({
        ...mockApplicationContext,
        createRecordUseCase: null
      })

      const user = userEvent.setup()
      render(<MiscInputIntegrated />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, 'tag1 tag2')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Application not ready')
        expect(input).toHaveValue('tag1 tag2')
      })
    })
  })
})

describe('MiscInputIntegrated - SearchRecords Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(useApplicationContext as Mock).mockReturnValue(mockApplicationContext)
  })

  describe('Debounced Search', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
    })

    afterEach(() => {
      vi.runOnlyPendingTimers()
      vi.useRealTimers()
    })

    it('should perform search after 300ms delay', async () => {
      const mockSearchResult = {
        records: [{ id: 'record-1', content: 'test search', tagIds: new Set(['test']) }],
        total: 1,
        hasMore: false,
      }
      
      ;(mockSearchRecordsUseCase.execute as Mock).mockResolvedValue(
        Ok({ searchResult: mockSearchResult })
      )

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const onSearchResults = vi.fn()
      
      render(<MiscInputIntegrated onSearchResults={onSearchResults} />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, 'test search')
      
      // Should not search immediately
      expect(mockSearchRecordsUseCase.execute).not.toHaveBeenCalled()
      
      // Advance timers by 300ms and run all pending timers
      await act(async () => {
        vi.advanceTimersByTime(300)
        vi.runAllTimers()
      })
      
      await waitFor(() => {
        expect(mockSearchRecordsUseCase.execute).toHaveBeenCalledWith({
          query: 'test search',
          options: {
            limit: 50,
            offset: 0,
            sortBy: 'createdAt',
            sortOrder: 'desc',
          },
        })
        expect(onSearchResults).toHaveBeenCalledWith(mockSearchResult)
      })
    })

    it('should cancel previous search when typing continues', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<MiscInputIntegrated />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, 'test')
      
      // Advance by 100ms (not enough to trigger search with 150ms debounce)
      act(() => {
        vi.advanceTimersByTime(100)
      })

      // Type more
      await user.type(input, ' more')

      // Advance by 150ms (enough to trigger search)
      act(() => {
        vi.advanceTimersByTime(150)
      })
      
      await waitFor(() => {
        expect(mockSearchRecordsUseCase.execute).toHaveBeenCalledTimes(1)
        expect(mockSearchRecordsUseCase.execute).toHaveBeenCalledWith({
          query: 'test more',
          options: {
            limit: 50,
            offset: 0,
            sortBy: 'createdAt',
            sortOrder: 'desc',
          },
        })
      })
    })

    it('should show loading indicator during search', async () => {
      let resolvePromise: (value: unknown) => void
      const promise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      
      ;(mockSearchRecordsUseCase.execute as Mock).mockReturnValue(promise)

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<MiscInputIntegrated />)

      const input = screen.getByRole('textbox')
      await act(async () => {
        await user.type(input, 'test')
      })

      act(() => {
        vi.advanceTimersByTime(300)
      })

      await waitFor(() => {
        expect(screen.getByText(/searching/i)).toBeInTheDocument()
      })

      await act(async () => {
        resolvePromise!(Ok({ searchResult: { records: [], totalCount: 0, hasMore: false } }))
      })
    })

    it('should handle search errors gracefully', async () => {
      const error = new DomainError('SEARCH_ERROR', 'Search failed')
      ;(mockSearchRecordsUseCase.execute as Mock).mockResolvedValue(Err(error))

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const onSearchResults = vi.fn()
      
      render(<MiscInputIntegrated onSearchResults={onSearchResults} />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, 'test')
      
      act(() => {
        vi.advanceTimersByTime(300)
      })
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Search failed: Search failed')
      })

      // The component calls onSearchResults(null) on mount for empty input,
      // but should not call it with actual search results on error
      expect(onSearchResults).toHaveBeenCalledWith(null)
      expect(onSearchResults).not.toHaveBeenCalledWith(expect.objectContaining({
        records: expect.any(Array)
      }))
    })

    it('should clear search results when input is cleared', async () => {
      const onSearchResults = vi.fn()
      render(<MiscInputIntegrated onSearchResults={onSearchResults} />)
      
      const input = screen.getByRole('textbox')
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      
      // Type and search
      await user.type(input, 'test')
      act(() => {
        vi.advanceTimersByTime(300)
      })
      
      // Clear input
      await user.clear(input)
      act(() => {
        vi.advanceTimersByTime(300)
      })
      
      await waitFor(() => {
        expect(onSearchResults).toHaveBeenCalledWith(null)
      })
    })
  })
})