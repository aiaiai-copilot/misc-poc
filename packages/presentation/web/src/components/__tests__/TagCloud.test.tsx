import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TagCloud } from '../TagCloud'
import { TagFrequency } from '../../types/Record'
import { vi } from 'vitest'

// Mock window.innerWidth for responsive grid testing
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1024,
})

describe('TagCloud', () => {
  const mockTagFrequencies: TagFrequency[] = [
    { tag: 'popular', count: 10 },
    { tag: 'medium', count: 6 },
    { tag: 'low', count: 2 },
    { tag: 'rare', count: 1 },
  ]

  const mockProps = {
    tagFrequencies: mockTagFrequencies,
    onTagClick: vi.fn(),
    onNavigateUp: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders tag cloud with all tags', () => {
    render(<TagCloud {...mockProps} />)
    expect(screen.getByText('popular')).toBeInTheDocument()
    expect(screen.getByText('medium')).toBeInTheDocument()
    expect(screen.getByText('low')).toBeInTheDocument()
    expect(screen.getByText('rare')).toBeInTheDocument()
  })

  it('shows empty state when no tags', () => {
    render(<TagCloud {...mockProps} tagFrequencies={[]} />)
    expect(screen.getByText('No records found')).toBeInTheDocument()
    expect(screen.getByText('Press Enter to create')).toBeInTheDocument()
  })

  it('applies correct font size based on frequency', () => {
    render(<TagCloud {...mockProps} />)
    
    const popularTag = screen.getByText('popular')
    const rareTag = screen.getByText('rare')
    
    expect(popularTag).toHaveClass('text-lg', 'font-bold') // highest frequency
    expect(rareTag).toHaveClass('text-xs') // lowest frequency
  })

  it('calls onTagClick when tag is clicked', async () => {
    const user = userEvent.setup()
    render(<TagCloud {...mockProps} />)
    
    const tag = screen.getByText('popular')
    await user.click(tag)
    
    expect(mockProps.onTagClick).toHaveBeenCalledWith('popular')
  })

  it('handles keyboard navigation - Arrow keys', async () => {
    const user = userEvent.setup()
    render(<TagCloud {...mockProps} />)
    
    const firstTag = screen.getByText('popular')
    firstTag.focus()
    
    await user.keyboard('{ArrowRight}')
    expect(document.activeElement?.textContent).toBe('medium')
    
    await user.keyboard('{ArrowDown}')
    // Should move to next row
    
    await user.keyboard('{ArrowLeft}')
    // Should move left in grid
  })

  it('handles Enter and Space keys to select tag', async () => {
    const user = userEvent.setup()
    render(<TagCloud {...mockProps} />)
    
    const tag = screen.getByText('popular')
    tag.focus()
    
    await user.keyboard('{Enter}')
    expect(mockProps.onTagClick).toHaveBeenCalledWith('popular')
    
    vi.clearAllMocks()
    
    await user.keyboard(' ')
    expect(mockProps.onTagClick).toHaveBeenCalledWith('popular')
  })

  it('limits displayed tags to 50', () => {
    const manyTags = Array.from({ length: 60 }, (_, i) => ({
      tag: `tag${i}`,
      count: i + 1,
    }))

    render(<TagCloud {...mockProps} tagFrequencies={manyTags} />)
    
    // Should only render first 50 tags
    expect(screen.getAllByRole('button')).toHaveLength(50)
  })

  it('handles Escape key navigation', async () => {
    const user = userEvent.setup()
    render(<TagCloud {...mockProps} />)
    
    const tag = screen.getByText('popular')
    tag.focus()
    
    await user.keyboard('{Escape}')
    expect(mockProps.onNavigateUp).toHaveBeenCalled()
  })
})