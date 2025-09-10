import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, beforeEach, describe, it, expect, Mock } from 'vitest'
import { RecordsListIntegrated } from '../RecordsListIntegrated'
import { useApplicationContext } from '../../contexts/ApplicationContext'
import type { UpdateRecordUseCase, DeleteRecordUseCase } from '@misc-poc/application'
import { Ok } from '@misc-poc/shared'
import { Record } from '../../types/Record'

// Mock dependencies
vi.mock('../../contexts/ApplicationContext')
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  }
}))

const mockUpdateRecordUseCase = {
  execute: vi.fn(),
} as unknown as UpdateRecordUseCase

const mockDeleteRecordUseCase = {
  execute: vi.fn(),
} as unknown as DeleteRecordUseCase

const mockApplicationContext = {
  createRecordUseCase: null,
  searchRecordsUseCase: null,
  updateRecordUseCase: mockUpdateRecordUseCase,
  deleteRecordUseCase: mockDeleteRecordUseCase,
  getTagSuggestionsUseCase: null,
  exportDataUseCase: null,
  importDataUseCase: null,
}

const mockRecords: Record[] = [
  {
    id: '1',
    tags: ['tag1', 'tag2'],
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
  },
  {
    id: '2',
    tags: ['tag3', 'tag4'],
    createdAt: new Date('2023-01-02'),
    updatedAt: new Date('2023-01-02'),
  },
]

describe('RecordsListIntegrated', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(useApplicationContext as Mock).mockReturnValue(mockApplicationContext)
  })

  describe('Basic Rendering', () => {
    it('should render records list integrated component', async () => {
      render(
        <RecordsListIntegrated 
          records={mockRecords} 
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onNavigateUp={vi.fn()}
        />
      )
      
      expect(screen.getByTestId('records-list-integrated')).toBeInTheDocument()
      expect(screen.getByText('tag1 tag2')).toBeInTheDocument()
      expect(screen.getByText('tag3 tag4')).toBeInTheDocument()
    })

    it('should handle empty records list', () => {
      render(
        <RecordsListIntegrated 
          records={[]} 
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onNavigateUp={vi.fn()}
        />
      )
      
      expect(screen.getByText('No records found')).toBeInTheDocument()
    })
  })

  describe('Delete Integration', () => {
    it('should call deleteRecord use case when delete button is clicked', async () => {
      const mockDeleteResponse = {
        deletedRecordId: '1',
        deletedOrphanedTags: [],
      }
      
      ;(mockDeleteRecordUseCase.execute as Mock).mockResolvedValue(
        Ok(mockDeleteResponse)
      )

      const user = userEvent.setup()
      
      render(
        <RecordsListIntegrated 
          records={mockRecords} 
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onNavigateUp={vi.fn()}
        />
      )
      
      // Click the delete button on first record
      const deleteButtons = screen.getAllByLabelText('Delete record')
      await user.click(deleteButtons[0])
      
      await waitFor(() => {
        expect(mockDeleteRecordUseCase.execute).toHaveBeenCalledWith({
          id: '1'
        })
      })
    })

    it('should call onEdit when record is clicked', async () => {
      const mockOnEdit = vi.fn()
      const user = userEvent.setup()
      
      render(
        <RecordsListIntegrated 
          records={mockRecords} 
          onEdit={mockOnEdit}
          onDelete={vi.fn()}
          onNavigateUp={vi.fn()}
        />
      )
      
      const recordItem = screen.getByText('tag1 tag2').closest('div')!
      await user.click(recordItem)
      
      expect(mockOnEdit).toHaveBeenCalledWith(mockRecords[0])
    })
  })
})