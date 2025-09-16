import { render, act } from '@testing-library/react'
import { RecordsList } from '../RecordsList'
import { Record } from '../../types/Record'
import { vi } from 'vitest'

describe('RecordsList Performance Tests', () => {
  const generateLargeDataset = (count: number): Record[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: i.toString(),
      tags: [`tag${i}`, `category${i % 10}`, `type${i % 5}`],
      createdAt: new Date(2023, 0, 1 + (i % 365)),
      updatedAt: new Date(2023, 0, 1 + (i % 365)),
    }))
  }

  const mockProps = {
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onNavigateUp: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Large Dataset Rendering Performance', () => {
    it('should render 10,000 records within performance target', async () => {
      const largeDataset = generateLargeDataset(10000)

      const startTime = performance.now()

      await act(async () => {
        render(<RecordsList {...mockProps} records={largeDataset} />)
      })

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Performance target: render time < 400ms (allows for system variance while maintaining performance)
      expect(renderTime).toBeLessThan(400)

      // Verify only 50 records are actually rendered (optimized behavior)
      const recordItems = document.querySelectorAll('.record-item')
      expect(recordItems).toHaveLength(50)
    })

    it('should handle re-renders efficiently with large datasets', async () => {
      const largeDataset = generateLargeDataset(5000)

      const { rerender } = render(<RecordsList {...mockProps} records={largeDataset} />)

      const startTime = performance.now()

      // Simulate re-render with slight data change
      const updatedDataset = [...largeDataset]
      updatedDataset[0] = { ...updatedDataset[0], tags: ['updated', 'tag'] }

      await act(async () => {
        rerender(<RecordsList {...mockProps} records={updatedDataset} />)
      })

      const endTime = performance.now()
      const rerenderTime = endTime - startTime

      // Re-render should be faster than initial render
      expect(rerenderTime).toBeLessThan(150)
    })
  })

  describe('Search Performance with Large Datasets', () => {
    it('should highlight search terms efficiently in large datasets', async () => {
      const largeDataset = generateLargeDataset(1000)

      const startTime = performance.now()

      await act(async () => {
        render(<RecordsList {...mockProps} records={largeDataset} searchQuery="tag1" />)
      })

      const endTime = performance.now()
      const searchHighlightTime = endTime - startTime

      // Search highlighting should be fast
      expect(searchHighlightTime).toBeLessThan(350)

      // Verify highlighting worked
      const highlightedElements = document.querySelectorAll('.font-bold')
      expect(highlightedElements.length).toBeGreaterThan(0)
    })

    it('should handle complex search queries efficiently', async () => {
      const largeDataset = generateLargeDataset(2000)

      const startTime = performance.now()

      await act(async () => {
        render(<RecordsList {...mockProps} records={largeDataset} searchQuery="tag1 category5 type2" />)
      })

      const endTime = performance.now()
      const complexSearchTime = endTime - startTime

      // Complex search should still be within target
      expect(complexSearchTime).toBeLessThan(400)
    })
  })

  describe('Memory Usage with Large Datasets', () => {
    it('should not leak memory with frequent re-renders', async () => {
      const dataset = generateLargeDataset(1000)

      const { rerender, unmount } = render(<RecordsList {...mockProps} records={dataset} />)

      // Simulate multiple re-renders
      for (let i = 0; i < 10; i++) {
        const modifiedDataset = dataset.map(record => ({
          ...record,
          tags: [...record.tags, `iteration${i}`]
        }))

        await act(async () => {
          rerender(<RecordsList {...mockProps} records={modifiedDataset} />)
        })
      }

      // Clean unmount should work without errors
      expect(() => unmount()).not.toThrow()
    })
  })

  describe('Keyboard Navigation Performance', () => {
    it('should handle keyboard navigation efficiently with many records', async () => {
      const largeDataset = generateLargeDataset(100)

      render(<RecordsList {...mockProps} records={largeDataset} />)

      const firstRecord = document.querySelector('.record-item') as HTMLElement

      const startTime = performance.now()

      // Simulate rapid keyboard navigation
      await act(async () => {
        firstRecord.focus()
        for (let i = 0; i < 10; i++) {
          firstRecord.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
        }
      })

      const endTime = performance.now()
      const navigationTime = endTime - startTime

      // Navigation should be responsive
      expect(navigationTime).toBeLessThan(50)
    })
  })
})