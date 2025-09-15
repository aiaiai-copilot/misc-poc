import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecordsList } from '../RecordsList'
import { Record } from '../../types/Record'
import { vi } from 'vitest'

describe('RecordsList', () => {
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

  const mockProps = {
    records: mockRecords,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onNavigateUp: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders records list', () => {
    render(<RecordsList {...mockProps} />)
    expect(screen.getByText('tag1 tag2')).toBeInTheDocument()
    expect(screen.getByText('tag3 tag4')).toBeInTheDocument()
  })

  it('shows empty state when no records', () => {
    render(<RecordsList {...mockProps} records={[]} />)
    expect(screen.getByText('No records found')).toBeInTheDocument()
    expect(screen.getByText('Press Enter to create')).toBeInTheDocument()
  })

  it('highlights search terms in records', () => {
    render(<RecordsList {...mockProps} searchQuery="tag1" />)
    const highlightedText = screen.getByText('tag1')
    expect(highlightedText).toHaveClass('font-bold')
  })

  it('calls onEdit when record is clicked', async () => {
    const user = userEvent.setup()
    render(<RecordsList {...mockProps} />)
    
    const recordItem = screen.getByText('tag1 tag2').closest('div')!
    await user.click(recordItem)
    
    expect(mockProps.onEdit).toHaveBeenCalledWith(mockRecords[0])
  })

  it('calls onDelete when delete button is clicked', async () => {
    const user = userEvent.setup()
    render(<RecordsList {...mockProps} />)
    
    const deleteButtons = screen.getAllByLabelText('Delete record')
    await user.click(deleteButtons[0])
    
    expect(mockProps.onDelete).toHaveBeenCalledWith('1')
  })

  it('handles keyboard navigation - Arrow Up/Down', async () => {
    const user = userEvent.setup()
    render(<RecordsList {...mockProps} />)
    
    const firstRecord = screen.getByText('tag1 tag2').closest('div')!
    firstRecord.focus()
    
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement?.textContent).toContain('tag3 tag4')
    
    await user.keyboard('{ArrowUp}')
    expect(document.activeElement?.textContent).toContain('tag1 tag2')
  })

  it('handles Delete key to remove record', async () => {
    const user = userEvent.setup()
    render(<RecordsList {...mockProps} />)
    
    const firstRecord = screen.getByText('tag1 tag2').closest('div')!
    // Focus the element first
    await user.click(firstRecord)
    
    await user.keyboard('{Delete}')
    expect(mockProps.onDelete).toHaveBeenCalledWith('1')
  })

  it('limits displayed records to 50', () => {
    const manyRecords = Array.from({ length: 60 }, (_, i) => ({
      id: i.toString(),
      tags: [`tag${i}`],
      createdAt: new Date(),
      updatedAt: new Date(),
    }))

    render(<RecordsList {...mockProps} records={manyRecords} />)

    // Count the record items by finding elements with record-item class
    const recordItems = document.querySelectorAll('.record-item')
    expect(recordItems).toHaveLength(50)
  })
})