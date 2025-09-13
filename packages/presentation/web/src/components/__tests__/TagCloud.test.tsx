import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TagCloud } from '../TagCloud'
import { TagFrequency } from '../../types/Record'
import { TagCloudItemDTO } from '@misc-poc/application'
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

describe('TagCloud with TagCloudItemDTO', () => {
  const mockTagCloudItems: TagCloudItemDTO[] = [
    {
      id: '1',
      normalizedValue: 'popular-tag',
      displayValue: 'Popular Tag',
      usageCount: 10,
      weight: 1.0,
      fontSize: 'xlarge'
    },
    {
      id: '2', 
      normalizedValue: 'medium-tag',
      displayValue: 'Medium Tag',
      usageCount: 6,
      weight: 0.6,
      fontSize: 'large'
    },
    {
      id: '3',
      normalizedValue: 'small-tag',
      displayValue: 'Small Tag',
      usageCount: 2,
      weight: 0.2,
      fontSize: 'small'
    }
  ]

  const mockProps = {
    tagCloudItems: mockTagCloudItems,
    onTagClick: vi.fn(),
    onNavigateUp: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders tag cloud with TagCloudItemDTO data', () => {
    render(<TagCloud {...mockProps} />)
    expect(screen.getByText('Popular Tag')).toBeInTheDocument()
    expect(screen.getByText('Medium Tag')).toBeInTheDocument() 
    expect(screen.getByText('Small Tag')).toBeInTheDocument()
  })

  it('applies correct font size from TagCloudItemDTO', () => {
    render(<TagCloud {...mockProps} />)
    
    const popularTag = screen.getByText('Popular Tag')
    const mediumTag = screen.getByText('Medium Tag')
    const smallTag = screen.getByText('Small Tag')
    
    expect(popularTag).toHaveClass('text-xl', 'font-bold') // xlarge fontSize
    expect(mediumTag).toHaveClass('text-lg', 'font-semibold') // large fontSize
    expect(smallTag).toHaveClass('text-sm') // small fontSize
  })

  it('calls onTagClick with normalized value when tag is clicked', async () => {
    const user = userEvent.setup()
    render(<TagCloud {...mockProps} />)
    
    const tag = screen.getByText('Popular Tag')
    await user.click(tag)
    
    expect(mockProps.onTagClick).toHaveBeenCalledWith('popular-tag')
  })

  it('handles keyboard Enter/Space with normalized value', async () => {
    const user = userEvent.setup()
    render(<TagCloud {...mockProps} />)
    
    const tag = screen.getByText('Popular Tag')
    tag.focus()
    
    await user.keyboard('{Enter}')
    expect(mockProps.onTagClick).toHaveBeenCalledWith('popular-tag')
    
    vi.clearAllMocks()
    
    await user.keyboard(' ')
    expect(mockProps.onTagClick).toHaveBeenCalledWith('popular-tag')
  })

  it('shows empty state when no TagCloudItemDTO items', () => {
    render(<TagCloud {...mockProps} tagCloudItems={[]} />)
    expect(screen.getByText('No records found')).toBeInTheDocument()
    expect(screen.getByText('Press Enter to create')).toBeInTheDocument()
  })

  it('limits TagCloudItemDTO display to 50 items', () => {
    const manyItems = Array.from({ length: 60 }, (_, i) => ({
      id: `${i}`,
      normalizedValue: `tag-${i}`,
      displayValue: `Tag ${i}`,
      usageCount: i + 1,
      weight: (i + 1) / 60,
      fontSize: 'medium' as const
    }))

    render(<TagCloud {...mockProps} tagCloudItems={manyItems} />)
    
    // Should only render first 50 items
    expect(screen.getAllByRole('button')).toHaveLength(50)
  })
})