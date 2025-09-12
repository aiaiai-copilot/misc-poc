import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TagCloud } from '../TagCloud'
import { RecordsList } from '../RecordsList'
import { SearchModeDetector, DisplayMode } from '../../../../../application/src/services/search-mode-detector'
import { SearchResultDTO } from '../../../../../application/src/dtos/search-result-dto'
import { TagCloudItemDTO } from '../../../../../application/src/dtos/tag-cloud-item-dto'
import { vi } from 'vitest'

// Mock window.innerWidth for responsive grid testing
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1024,
})

describe('TagCloud SearchModeDetector Integration', () => {
  const mockSearchRecords = (count: number): SearchResultDTO => ({
    records: Array.from({ length: Math.min(count, 10) }, (_, i) => ({
      id: `record-${i}`,
      content: `Content ${i}`,
      tagIds: [`tag-${i}`],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    total: count,
    hasMore: count > 10,
  })

  const mockTagCloudItems: TagCloudItemDTO[] = [
    {
      id: '1',
      normalizedValue: 'javascript',
      displayValue: 'JavaScript',
      usageCount: 25,
      weight: 1.0,
      fontSize: 'xlarge',
    },
    {
      id: '2', 
      normalizedValue: 'react',
      displayValue: 'React',
      usageCount: 20,
      weight: 0.8,
      fontSize: 'large',
    },
    {
      id: '3',
      normalizedValue: 'typescript',
      displayValue: 'TypeScript', 
      usageCount: 15,
      weight: 0.6,
      fontSize: 'large',
    },
  ]

  describe('Mode Switching Logic', () => {
    it('should detect CLOUD mode for large result sets (> 20 results)', () => {
      const detector = new SearchModeDetector()
      const searchResult = mockSearchRecords(25)
      
      const mode = detector.detectMode(searchResult)
      
      expect(mode).toBe(DisplayMode.CLOUD)
    })

    it('should detect LIST mode for small result sets (<= 20 results)', () => {
      const detector = new SearchModeDetector()
      const searchResult = mockSearchRecords(15)
      
      const mode = detector.detectMode(searchResult)
      
      expect(mode).toBe(DisplayMode.LIST)
    })

    it('should switch to CLOUD mode exactly at threshold boundary (21 results)', () => {
      const detector = new SearchModeDetector()
      const searchResult = mockSearchRecords(21)
      
      const mode = detector.detectMode(searchResult)
      
      expect(mode).toBe(DisplayMode.CLOUD)
    })

    it('should stay in LIST mode at threshold boundary (20 results)', () => {
      const detector = new SearchModeDetector()
      const searchResult = mockSearchRecords(20)
      
      const mode = detector.detectMode(searchResult)
      
      expect(mode).toBe(DisplayMode.LIST)
    })

    it('should support custom thresholds for mode switching', () => {
      const detector = new SearchModeDetector({
        listToCloudThreshold: 10,
        cloudToListThreshold: 5,
      })
      
      // Should switch to cloud at 11 results with custom threshold
      const searchResult = mockSearchRecords(11)
      const mode = detector.detectMode(searchResult)
      
      expect(mode).toBe(DisplayMode.CLOUD)
    })
  })

  describe('Component Integration with Mode Detection', () => {
    it('should render TagCloud when mode is CLOUD', () => {
      const detector = new SearchModeDetector()
      const searchResult = mockSearchRecords(25)
      const mode = detector.detectMode(searchResult)
      
      // Simulate the integration pattern from IntegratedIndex
      const shouldShowTagCloud = mode === DisplayMode.CLOUD
      
      if (shouldShowTagCloud) {
        render(
          <TagCloud 
            tagCloudItems={mockTagCloudItems}
            onTagClick={vi.fn()}
          />
        )
        
        expect(screen.getByText('JavaScript')).toBeInTheDocument()
        expect(screen.getByText('React')).toBeInTheDocument()
        expect(screen.getByText('TypeScript')).toBeInTheDocument()
      }
      
      expect(shouldShowTagCloud).toBe(true)
    })

    it('should not render TagCloud when mode is LIST', () => {
      const detector = new SearchModeDetector()
      const searchResult = mockSearchRecords(15)
      const mode = detector.detectMode(searchResult)
      
      // Simulate the integration pattern from IntegratedIndex
      const shouldShowTagCloud = mode === DisplayMode.CLOUD
      const shouldShowRecordsList = mode === DisplayMode.LIST
      
      expect(shouldShowTagCloud).toBe(false)
      expect(shouldShowRecordsList).toBe(true)
    })

    it('should handle mode switching with search query changes', async () => {
      const user = userEvent.setup()
      const detector = new SearchModeDetector()
      
      // Start with many results -> CLOUD mode
      let searchResult = mockSearchRecords(30)
      let mode = detector.detectMode(searchResult)
      expect(mode).toBe(DisplayMode.CLOUD)
      
      // User refines search, fewer results -> should switch to LIST mode  
      searchResult = mockSearchRecords(8)
      mode = detector.detectMode(searchResult)
      expect(mode).toBe(DisplayMode.LIST)
      
      // User clears search, many results again -> back to CLOUD mode
      searchResult = mockSearchRecords(25)
      mode = detector.detectMode(searchResult)
      expect(mode).toBe(DisplayMode.CLOUD)
    })

    it('should integrate TagCloud with search refinement workflow', async () => {
      const user = userEvent.setup()
      const mockOnTagClick = vi.fn()
      
      // Simulate tag click workflow that would refine search
      render(
        <TagCloud 
          tagCloudItems={mockTagCloudItems}
          onTagClick={mockOnTagClick}
        />
      )
      
      const jsTag = screen.getByText('JavaScript')
      await user.click(jsTag)
      
      // Tag click should trigger search refinement
      expect(mockOnTagClick).toHaveBeenCalledWith('javascript')
      
      // In real integration, this would:
      // 1. Add 'javascript' to search query  
      // 2. Trigger new search with SearchRecords use case
      // 3. Get new search results
      // 4. SearchModeDetector would evaluate new results
      // 5. UI would switch modes based on new result count
    })
  })

  describe('Consistent Mode Detection', () => {
    it('should consistently apply threshold logic for mode switching', () => {
      const detector = new SearchModeDetector({
        listToCloudThreshold: 20, // Switch to cloud at >20
        cloudToListThreshold: 10,  // Not used in current implementation
      })
      
      // Start in LIST mode with 15 results
      let searchResult = mockSearchRecords(15)
      let mode = detector.detectMode(searchResult)
      expect(mode).toBe(DisplayMode.LIST)
      
      // Increase to 25 results -> switch to CLOUD
      searchResult = mockSearchRecords(25)
      mode = detector.detectMode(searchResult)
      expect(mode).toBe(DisplayMode.CLOUD)
      
      // Decrease to 15 results -> back to LIST (current implementation behavior)
      searchResult = mockSearchRecords(15)
      mode = detector.detectMode(searchResult)
      expect(mode).toBe(DisplayMode.LIST)
      
      // Very low results stay in LIST mode
      searchResult = mockSearchRecords(8)
      mode = detector.detectMode(searchResult)
      expect(mode).toBe(DisplayMode.LIST)
    })

    it('should handle edge cases in threshold detection', () => {
      const detector = new SearchModeDetector()
      
      // Empty results should be LIST mode
      let searchResult = mockSearchRecords(0)
      let mode = detector.detectMode(searchResult)
      expect(mode).toBe(DisplayMode.LIST)
      
      // Single result should be LIST mode
      searchResult = mockSearchRecords(1)
      mode = detector.detectMode(searchResult)
      expect(mode).toBe(DisplayMode.LIST)
      
      // Very large result sets should be CLOUD mode
      searchResult = mockSearchRecords(1000)
      mode = detector.detectMode(searchResult)
      expect(mode).toBe(DisplayMode.CLOUD)
    })
  })
})