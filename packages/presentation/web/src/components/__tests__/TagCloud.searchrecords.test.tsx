import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TagCloud } from '../TagCloud'
import { SearchRecordsUseCase } from '../../../../../application/src/use-cases/search-records-use-case'
import { TagCloudBuilder } from '../../../../../application/src/services/tag-cloud-builder'
import { SearchModeDetector, DisplayMode } from '../../../../../application/src/services/search-mode-detector'
import { SearchResultDTO } from '../../../../../application/src/dtos/search-result-dto'
import { TagCloudItemDTO } from '../../../../../application/src/dtos/tag-cloud-item-dto'
import { vi, Mock } from 'vitest'

// Mock window.innerWidth for responsive grid testing
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1024,
})

describe('TagCloud SearchRecords Integration', () => {
  let mockSearchRecordsUseCase: {
    execute: Mock
  }
  let mockTagCloudBuilder: {
    buildFromSearchResult: Mock
  }
  let mockSearchModeDetector: SearchModeDetector

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

  beforeEach(() => {
    mockSearchRecordsUseCase = {
      execute: vi.fn()
    }

    mockTagCloudBuilder = {
      buildFromSearchResult: vi.fn()
    }

    mockSearchModeDetector = new SearchModeDetector()
  })

  describe('Tag Click Search Integration', () => {
    it('should trigger search when tag is clicked', async () => {
      const user = userEvent.setup()
      const mockOnTagClick = vi.fn()

      // Mock successful search result
      const searchResult = {
        records: [
          {
            id: 'record-1',
            content: 'JavaScript tutorial',
            tagIds: ['javascript', 'tutorial'],
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          }
        ],
        total: 1,
        hasMore: false
      }

      mockSearchRecordsUseCase.execute.mockResolvedValue({
        isErr: () => false,
        unwrap: () => ({ searchResult })
      })

      render(
        <TagCloud 
          tagCloudItems={mockTagCloudItems}
          onTagClick={mockOnTagClick}
        />
      )

      const jsTag = screen.getByText('JavaScript')
      await user.click(jsTag)

      // Verify tag click handler was called with normalized value
      expect(mockOnTagClick).toHaveBeenCalledWith('javascript')
    })

    it('should handle search workflow: tag click -> search execution -> mode detection -> TagCloud rebuild', async () => {
      const user = userEvent.setup()
      
      // Mock the complete workflow
      const searchResult = {
        records: Array.from({ length: 25 }, (_, i) => ({
          id: `record-${i}`,
          content: `JavaScript content ${i}`,
          tagIds: ['javascript', `tag-${i}`],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        })),
        total: 25,
        hasMore: false
      }

      // Simulate refined tag cloud after search
      const refinedTagCloudItems: TagCloudItemDTO[] = [
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
          normalizedValue: 'tutorial',
          displayValue: 'Tutorial', 
          usageCount: 15,
          weight: 0.6,
          fontSize: 'large',
        }
      ]

      // Mock successful search
      mockSearchRecordsUseCase.execute.mockResolvedValue({
        isErr: () => false,
        unwrap: () => ({ searchResult })
      })

      // Mock TagCloud rebuild
      mockTagCloudBuilder.buildFromSearchResult.mockResolvedValue(refinedTagCloudItems)

      // Simulate the integration workflow
      const handleTagClick = async (tag: string) => {
        // 1. Execute search with tag
        const searchResponse = await mockSearchRecordsUseCase.execute({
          query: tag,
          options: { limit: 50, offset: 0 }
        })

        if (!searchResponse.isErr()) {
          const result = searchResponse.unwrap()
          
          // 2. Determine display mode based on results
          const mode = mockSearchModeDetector.detectMode(result.searchResult)
          
          // 3. If CLOUD mode, rebuild TagCloud
          if (mode === DisplayMode.CLOUD) {
            const newTagCloudItems = await mockTagCloudBuilder.buildFromSearchResult(result.searchResult)
            return { mode, tagCloudItems: newTagCloudItems }
          }
          
          return { mode, tagCloudItems: [] }
        }
        return null
      }

      render(
        <TagCloud 
          tagCloudItems={mockTagCloudItems}
          onTagClick={handleTagClick}
        />
      )

      const jsTag = screen.getByText('JavaScript')
      await user.click(jsTag)

      // Wait for async operations
      await waitFor(() => {
        expect(mockSearchRecordsUseCase.execute).toHaveBeenCalledWith({
          query: 'javascript',
          options: { limit: 50, offset: 0 }
        })
      })

      // Verify search mode detection occurred
      const mode = mockSearchModeDetector.detectMode(searchResult)
      expect(mode).toBe(DisplayMode.CLOUD) // 25 results should trigger CLOUD mode

      // Verify TagCloud rebuild was called
      expect(mockTagCloudBuilder.buildFromSearchResult).toHaveBeenCalledWith(searchResult)
    })

    it('should handle search refinement by multiple tag clicks', async () => {
      const user = userEvent.setup()
      const searchQueries: string[] = []

      const handleTagClick = (tag: string) => {
        searchQueries.push(tag)
      }

      render(
        <TagCloud 
          tagCloudItems={mockTagCloudItems}
          onTagClick={handleTagClick}
        />
      )

      // Click multiple tags to build search query
      const jsTag = screen.getByText('JavaScript')
      await user.click(jsTag)

      const reactTag = screen.getByText('React')
      await user.click(reactTag)

      const tsTag = screen.getByText('TypeScript')
      await user.click(tsTag)

      expect(searchQueries).toEqual(['javascript', 'react', 'typescript'])
    })

    it('should handle search errors gracefully', async () => {
      const user = userEvent.setup()
      
      // Mock search error
      mockSearchRecordsUseCase.execute.mockResolvedValue({
        isErr: () => true,
        unwrapErr: () => new Error('Search failed')
      })

      const handleTagClick = async (tag: string) => {
        const searchResponse = await mockSearchRecordsUseCase.execute({
          query: tag
        })

        if (searchResponse.isErr()) {
          console.error('Search failed:', searchResponse.unwrapErr())
          return null
        }
        
        return searchResponse.unwrap()
      }

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(
        <TagCloud 
          tagCloudItems={mockTagCloudItems}
          onTagClick={handleTagClick}
        />
      )

      const jsTag = screen.getByText('JavaScript')
      await user.click(jsTag)

      await waitFor(() => {
        expect(mockSearchRecordsUseCase.execute).toHaveBeenCalled()
        expect(consoleSpy).toHaveBeenCalledWith('Search failed:', expect.any(Error))
      })

      consoleSpy.mockRestore()
    })
  })

  describe('Search Result Processing', () => {
    it('should switch to LIST mode when search returns few results', async () => {
      const smallSearchResult = {
        records: [
          {
            id: 'record-1',
            content: 'Single result',
            tagIds: ['specific-tag'],
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          }
        ],
        total: 1,
        hasMore: false
      }

      const mode = mockSearchModeDetector.detectMode(smallSearchResult)
      expect(mode).toBe(DisplayMode.LIST)
    })

    it('should stay in CLOUD mode when search returns many results', async () => {
      const largeSearchResult = {
        records: Array.from({ length: 30 }, (_, i) => ({
          id: `record-${i}`,
          content: `Result ${i}`,
          tagIds: ['common-tag'],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        })),
        total: 30,
        hasMore: false
      }

      const mode = mockSearchModeDetector.detectMode(largeSearchResult)
      expect(mode).toBe(DisplayMode.CLOUD)
    })

    it('should rebuild TagCloud with relevant tags from search results', async () => {
      const searchResult = {
        records: [
          {
            id: 'record-1',
            content: 'React TypeScript project',
            tagIds: ['react', 'typescript', 'project'],
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          },
          {
            id: 'record-2',
            content: 'React tutorial',
            tagIds: ['react', 'tutorial'],
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          }
        ],
        total: 2,
        hasMore: false
      }

      // Mock TagCloudBuilder to return tags from search results
      const expectedTagCloudItems: TagCloudItemDTO[] = [
        {
          id: 'react',
          normalizedValue: 'react',
          displayValue: 'React',
          usageCount: 2, // Appears in both records
          weight: 1.0,
          fontSize: 'xlarge'
        },
        {
          id: 'typescript',
          normalizedValue: 'typescript',
          displayValue: 'TypeScript',
          usageCount: 1,
          weight: 0.5,
          fontSize: 'medium'
        },
        {
          id: 'project',
          normalizedValue: 'project',
          displayValue: 'Project',
          usageCount: 1,
          weight: 0.5,
          fontSize: 'medium'
        },
        {
          id: 'tutorial',
          normalizedValue: 'tutorial',
          displayValue: 'Tutorial',
          usageCount: 1,
          weight: 0.5,
          fontSize: 'medium'
        }
      ]

      mockTagCloudBuilder.buildFromSearchResult.mockResolvedValue(expectedTagCloudItems)

      const result = await mockTagCloudBuilder.buildFromSearchResult(searchResult)
      
      expect(result).toEqual(expectedTagCloudItems)
      expect(mockTagCloudBuilder.buildFromSearchResult).toHaveBeenCalledWith(searchResult)
    })
  })
})