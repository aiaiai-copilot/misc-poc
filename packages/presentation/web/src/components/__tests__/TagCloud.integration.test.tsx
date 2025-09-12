import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TagCloud } from '../TagCloud'
import { TagCloudItemDTO } from '@misc-poc/application'
import { vi } from 'vitest'

// Mock window.innerWidth for responsive grid testing
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1024,
})

describe('TagCloud Integration', () => {
  const mockTagCloudItems: TagCloudItemDTO[] = [
    {
      id: '1',
      normalizedValue: 'popular-tag',
      displayValue: 'Popular Tag',
      usageCount: 10,
      weight: 1.0,
      fontSize: 'xlarge',
    },
    {
      id: '2',
      normalizedValue: 'medium-tag',
      displayValue: 'Medium Tag',
      usageCount: 6,
      weight: 0.6,
      fontSize: 'large',
    },
    {
      id: '3',
      normalizedValue: 'low-tag',
      displayValue: 'Low Tag',
      usageCount: 2,
      weight: 0.2,
      fontSize: 'medium',
    },
    {
      id: '4',
      normalizedValue: 'rare-tag',
      displayValue: 'Rare Tag',
      usageCount: 1,
      weight: 0.0,
      fontSize: 'small',
    },
  ]

  const mockProps = {
    tagCloudItems: mockTagCloudItems,
    onTagClick: vi.fn(),
    onNavigateUp: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('TagCloudItemDTO Integration', () => {
    it('should render TagCloudItemDTO array correctly', () => {
      render(<TagCloud {...mockProps} />)
      
      expect(screen.getByText('Popular Tag')).toBeInTheDocument()
      expect(screen.getByText('Medium Tag')).toBeInTheDocument()
      expect(screen.getByText('Low Tag')).toBeInTheDocument()
      expect(screen.getByText('Rare Tag')).toBeInTheDocument()
    })

    it('should apply font sizes based on TagCloudItemDTO fontSize property', () => {
      render(<TagCloud {...mockProps} />)
      
      const popularTag = screen.getByText('Popular Tag')
      const mediumTag = screen.getByText('Medium Tag')
      const lowTag = screen.getByText('Low Tag')
      const rareTag = screen.getByText('Rare Tag')
      
      // Should use fontSize from DTO
      expect(popularTag).toHaveClass('text-2xl', 'font-bold') // xlarge
      expect(mediumTag).toHaveClass('text-xl', 'font-bold') // large
      expect(lowTag).toHaveClass('text-base', 'font-semibold') // medium
      expect(rareTag).toHaveClass('text-sm') // small
    })

    it('should pass normalized value when tag is clicked', async () => {
      const user = userEvent.setup()
      render(<TagCloud {...mockProps} />)
      
      const tag = screen.getByText('Popular Tag')
      await user.click(tag)
      
      expect(mockProps.onTagClick).toHaveBeenCalledWith('popular-tag')
    })

    it('should handle weight-based sizing calculation (1-5 scale)', () => {
      const itemsWithWeights: TagCloudItemDTO[] = [
        { 
          id: '1',
          normalizedValue: 'scale-5-tag',
          displayValue: 'Scale 5 Tag',
          usageCount: 100,
          weight: 1.0,
          fontSize: 'xlarge'
        }, // Scale 5 (largest)
        { 
          id: '2',
          normalizedValue: 'scale-4-tag',
          displayValue: 'Scale 4 Tag',
          usageCount: 80,
          weight: 0.8,
          fontSize: 'large'
        }, // Scale 4
        { 
          id: '3',
          normalizedValue: 'scale-3-tag',
          displayValue: 'Scale 3 Tag',
          usageCount: 60,
          weight: 0.6,
          fontSize: 'large'
        }, // Scale 3
        { 
          id: '4',
          normalizedValue: 'scale-2-tag',
          displayValue: 'Scale 2 Tag',
          usageCount: 30,
          weight: 0.3,
          fontSize: 'medium'
        }, // Scale 2
        { 
          id: '5',
          normalizedValue: 'scale-1-tag',
          displayValue: 'Scale 1 Tag',
          usageCount: 5,
          weight: 0.1,
          fontSize: 'small'
        } // Scale 1 (smallest)
      ]
      
      render(<TagCloud tagCloudItems={itemsWithWeights} onTagClick={vi.fn()} />)
      
      const scale5Tag = screen.getByText('Scale 5 Tag')
      const scale4Tag = screen.getByText('Scale 4 Tag')  
      const scale3Tag = screen.getByText('Scale 3 Tag')
      const scale2Tag = screen.getByText('Scale 2 Tag')
      const scale1Tag = screen.getByText('Scale 1 Tag')
      
      // Verify scale 5 (xlarge) - largest size
      expect(scale5Tag).toHaveClass('text-2xl', 'font-bold')
      
      // Verify scale 4 (large) - second largest
      expect(scale4Tag).toHaveClass('text-xl', 'font-bold')
      
      // Verify scale 3 (large) - same as scale 4 in our implementation
      expect(scale3Tag).toHaveClass('text-xl', 'font-bold')
      
      // Verify scale 2 (medium) - middle size
      expect(scale2Tag).toHaveClass('text-base', 'font-semibold')
      
      // Verify scale 1 (small) - smallest size
      expect(scale1Tag).toHaveClass('text-sm')
    })

    it('should map TagCloudItemDTO fontSize to correct CSS classes', () => {
      const fontSizeTestItems: TagCloudItemDTO[] = [
        { 
          id: '1', 
          normalizedValue: 'xlarge', 
          displayValue: 'XLarge', 
          usageCount: 10, 
          weight: 1.0, 
          fontSize: 'xlarge' 
        },
        { 
          id: '2', 
          normalizedValue: 'large', 
          displayValue: 'Large', 
          usageCount: 8, 
          weight: 0.8, 
          fontSize: 'large' 
        },
        { 
          id: '3', 
          normalizedValue: 'medium', 
          displayValue: 'Medium', 
          usageCount: 5, 
          weight: 0.5, 
          fontSize: 'medium' 
        },
        { 
          id: '4', 
          normalizedValue: 'small', 
          displayValue: 'Small', 
          usageCount: 2, 
          weight: 0.2, 
          fontSize: 'small' 
        },
      ]
      
      render(<TagCloud tagCloudItems={fontSizeTestItems} onTagClick={vi.fn()} />)
      
      expect(screen.getByText('XLarge')).toHaveClass('text-2xl', 'font-bold')
      expect(screen.getByText('Large')).toHaveClass('text-xl', 'font-bold')
      expect(screen.getByText('Medium')).toHaveClass('text-base', 'font-semibold')
      expect(screen.getByText('Small')).toHaveClass('text-sm')
    })

    it('should show empty state when no TagCloudItemDTO provided', () => {
      render(<TagCloud tagCloudItems={[]} onTagClick={vi.fn()} />)
      
      expect(screen.getByText('No records found')).toBeInTheDocument()
      expect(screen.getByText('Press Enter to create')).toBeInTheDocument()
    })

    it('should limit displayed items to 50', () => {
      const manyItems = Array.from({ length: 60 }, (_, i): TagCloudItemDTO => ({
        id: `${i}`,
        normalizedValue: `tag-${i}`,
        displayValue: `Tag ${i}`,
        usageCount: i + 1,
        weight: Math.random(),
        fontSize: 'medium',
      }))

      render(<TagCloud tagCloudItems={manyItems} onTagClick={vi.fn()} />)
      
      expect(screen.getAllByRole('button')).toHaveLength(50)
    })
  })

  describe('Click Handler Integration', () => {
    it('should add tag to search query when clicked', async () => {
      const user = userEvent.setup()
      const mockOnTagClick = vi.fn()
      
      render(<TagCloud tagCloudItems={mockTagCloudItems} onTagClick={mockOnTagClick} />)
      
      const popularTag = screen.getByText('Popular Tag')
      await user.click(popularTag)
      
      expect(mockOnTagClick).toHaveBeenCalledWith('popular-tag')
      expect(mockOnTagClick).toHaveBeenCalledTimes(1)
    })

    it('should add different tags to search query when multiple tags are clicked', async () => {
      const user = userEvent.setup()
      const mockOnTagClick = vi.fn()
      
      render(<TagCloud tagCloudItems={mockTagCloudItems} onTagClick={mockOnTagClick} />)
      
      // Click first tag
      const popularTag = screen.getByText('Popular Tag')
      await user.click(popularTag)
      
      // Click second tag
      const mediumTag = screen.getByText('Medium Tag')
      await user.click(mediumTag)
      
      expect(mockOnTagClick).toHaveBeenNthCalledWith(1, 'popular-tag')
      expect(mockOnTagClick).toHaveBeenNthCalledWith(2, 'medium-tag')
      expect(mockOnTagClick).toHaveBeenCalledTimes(2)
    })

    it('should handle keyboard activation (Enter key) for adding tags to search', async () => {
      const user = userEvent.setup()
      const mockOnTagClick = vi.fn()
      
      render(<TagCloud tagCloudItems={mockTagCloudItems} onTagClick={mockOnTagClick} />)
      
      const popularTag = screen.getByText('Popular Tag')
      popularTag.focus()
      
      await user.keyboard('{Enter}')
      
      expect(mockOnTagClick).toHaveBeenCalledWith('popular-tag')
    })

    it('should handle keyboard activation (Space key) for adding tags to search', async () => {
      const user = userEvent.setup()
      const mockOnTagClick = vi.fn()
      
      render(<TagCloud tagCloudItems={mockTagCloudItems} onTagClick={mockOnTagClick} />)
      
      const popularTag = screen.getByText('Popular Tag')
      popularTag.focus()
      
      await user.keyboard(' ')
      
      expect(mockOnTagClick).toHaveBeenCalledWith('popular-tag')
    })

    it('should use normalized value for search query integration', async () => {
      const user = userEvent.setup()
      const mockOnTagClick = vi.fn()
      
      const tagWithSpecialChars: TagCloudItemDTO[] = [
        {
          id: '1',
          normalizedValue: 'react-js-development',
          displayValue: 'React.js Development',
          usageCount: 10,
          weight: 1.0,
          fontSize: 'large',
        }
      ]
      
      render(<TagCloud tagCloudItems={tagWithSpecialChars} onTagClick={mockOnTagClick} />)
      
      const tag = screen.getByText('React.js Development')
      await user.click(tag)
      
      // Should pass normalized value, not display value
      expect(mockOnTagClick).toHaveBeenCalledWith('react-js-development')
    })
  })

  describe('Frequency-based Sizing and Responsive Layout', () => {
    beforeEach(() => {
      // Reset window size to default
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      })
    })

    it('should size tags based on frequency relative to max frequency', () => {
      const frequencyTestItems: TagCloudItemDTO[] = [
        { 
          id: '1', 
          normalizedValue: 'most-frequent', 
          displayValue: 'Most Frequent', 
          usageCount: 100, // Highest frequency
          weight: 1.0, 
          fontSize: 'xlarge' 
        },
        { 
          id: '2', 
          normalizedValue: 'high-frequency', 
          displayValue: 'High Frequency', 
          usageCount: 75, 
          weight: 0.75, 
          fontSize: 'large' 
        },
        { 
          id: '3', 
          normalizedValue: 'medium-frequency', 
          displayValue: 'Medium Frequency', 
          usageCount: 50, 
          weight: 0.5, 
          fontSize: 'medium' 
        },
        { 
          id: '4', 
          normalizedValue: 'low-frequency', 
          displayValue: 'Low Frequency', 
          usageCount: 25, 
          weight: 0.25, 
          fontSize: 'medium' 
        },
        { 
          id: '5', 
          normalizedValue: 'rare-frequency', 
          displayValue: 'Rare Frequency', 
          usageCount: 5, 
          weight: 0.05, 
          fontSize: 'small' 
        }
      ]
      
      render(<TagCloud tagCloudItems={frequencyTestItems} onTagClick={vi.fn()} />)
      
      // Verify frequency-based sizing
      expect(screen.getByText('Most Frequent')).toHaveClass('text-2xl', 'font-bold') // xlarge
      expect(screen.getByText('High Frequency')).toHaveClass('text-xl', 'font-bold') // large
      expect(screen.getByText('Medium Frequency')).toHaveClass('text-base', 'font-semibold') // medium
      expect(screen.getByText('Low Frequency')).toHaveClass('text-base', 'font-semibold') // medium
      expect(screen.getByText('Rare Frequency')).toHaveClass('text-sm') // small
    })

    it('should handle single tag frequency edge case', () => {
      const singleTagItem: TagCloudItemDTO[] = [
        { 
          id: '1', 
          normalizedValue: 'only-tag', 
          displayValue: 'Only Tag', 
          usageCount: 42, 
          weight: 1.0, // Single item gets max weight
          fontSize: 'xlarge' 
        }
      ]
      
      render(<TagCloud tagCloudItems={singleTagItem} onTagClick={vi.fn()} />)
      
      expect(screen.getByText('Only Tag')).toHaveClass('text-2xl', 'font-bold')
    })

    it('should adapt grid layout for mobile screens (< 640px)', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 480, // Mobile width
      })

      const { container } = render(<TagCloud tagCloudItems={mockTagCloudItems} onTagClick={vi.fn()} />)
      
      // Trigger resize event to update grid
      window.dispatchEvent(new Event('resize'))
      
      const gridContainer = container.querySelector('.grid')
      expect(gridContainer).toHaveClass('grid-cols-2') // Should use 2 columns on mobile
    })

    it('should adapt grid layout for tablet screens (640px-768px)', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 700, // Tablet width
      })

      const { container } = render(<TagCloud tagCloudItems={mockTagCloudItems} onTagClick={vi.fn()} />)
      
      // Trigger resize event to update grid
      window.dispatchEvent(new Event('resize'))
      
      const gridContainer = container.querySelector('.grid')
      expect(gridContainer).toHaveClass('sm:grid-cols-3') // Should use 3 columns on tablet
    })

    it('should adapt grid layout for desktop screens (> 1280px)', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1440, // Desktop width
      })

      const { container } = render(<TagCloud tagCloudItems={mockTagCloudItems} onTagClick={vi.fn()} />)
      
      // Trigger resize event to update grid
      window.dispatchEvent(new Event('resize'))
      
      const gridContainer = container.querySelector('.grid')
      expect(gridContainer).toHaveClass('xl:grid-cols-8') // Should use 8 columns on large desktop
    })

    it('should maintain responsive grid during window resize', () => {
      const { container } = render(<TagCloud tagCloudItems={mockTagCloudItems} onTagClick={vi.fn()} />)
      
      // Start with desktop
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200,
      })
      window.dispatchEvent(new Event('resize'))
      
      let gridContainer = container.querySelector('.grid')
      expect(gridContainer).toHaveClass('lg:grid-cols-6') // 6 columns for lg screens
      
      // Resize to mobile
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      })
      window.dispatchEvent(new Event('resize'))
      
      gridContainer = container.querySelector('.grid')
      expect(gridContainer).toHaveClass('grid-cols-2') // Should switch to 2 columns
    })

    it('should maintain tag frequency order in responsive layout', () => {
      const orderedItems: TagCloudItemDTO[] = [
        { id: '1', normalizedValue: 'first', displayValue: 'First', usageCount: 100, weight: 1.0, fontSize: 'xlarge' },
        { id: '2', normalizedValue: 'second', displayValue: 'Second', usageCount: 90, weight: 0.9, fontSize: 'large' },
        { id: '3', normalizedValue: 'third', displayValue: 'Third', usageCount: 80, weight: 0.8, fontSize: 'large' },
      ]
      
      render(<TagCloud tagCloudItems={orderedItems} onTagClick={vi.fn()} />)
      
      const buttons = screen.getAllByRole('button')
      expect(buttons[0]).toHaveTextContent('First')
      expect(buttons[1]).toHaveTextContent('Second')
      expect(buttons[2]).toHaveTextContent('Third')
      
      // Verify order is maintained across different screen sizes
      Object.defineProperty(window, 'innerWidth', { value: 500 })
      window.dispatchEvent(new Event('resize'))
      
      const buttonsAfterResize = screen.getAllByRole('button')
      expect(buttonsAfterResize[0]).toHaveTextContent('First')
      expect(buttonsAfterResize[1]).toHaveTextContent('Second')
      expect(buttonsAfterResize[2]).toHaveTextContent('Third')
    })
  })
})