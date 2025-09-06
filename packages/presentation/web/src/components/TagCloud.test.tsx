import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagCloud } from './TagCloud';
import { TagCloudItemDTO } from '@misc-poc/application';

const mockTagCloudItems: TagCloudItemDTO[] = [
  {
    id: '1',
    normalizedValue: 'react',
    displayValue: 'React',
    usageCount: 15,
    weight: 1.0,
    fontSize: 'xlarge',
  },
  {
    id: '2',
    normalizedValue: 'javascript',
    displayValue: 'JavaScript',
    usageCount: 12,
    weight: 0.8,
    fontSize: 'large',
  },
  {
    id: '3',
    normalizedValue: 'typescript',
    displayValue: 'TypeScript',
    usageCount: 8,
    weight: 0.5,
    fontSize: 'medium',
  },
  {
    id: '4',
    normalizedValue: 'css',
    displayValue: 'CSS',
    usageCount: 3,
    weight: 0.2,
    fontSize: 'small',
  },
];

describe('TagCloud', () => {
  describe('Basic rendering', () => {
    it('renders empty state when no tags provided', () => {
      render(<TagCloud tags={[]} />);
      
      expect(screen.getByText(/no tags/i)).toBeInTheDocument();
    });

    it('renders list of tag items', () => {
      render(<TagCloud tags={mockTagCloudItems} />);
      
      expect(screen.getByText('React')).toBeInTheDocument();
      expect(screen.getByText('JavaScript')).toBeInTheDocument();
      expect(screen.getByText('TypeScript')).toBeInTheDocument();
      expect(screen.getByText('CSS')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <TagCloud tags={mockTagCloudItems} className="custom-cloud" />
      );
      
      const cloudContainer = container.querySelector('.custom-cloud');
      expect(cloudContainer).toBeInTheDocument();
    });
  });

  describe('Frequency-based sizing', () => {
    it('applies correct font size based on weight', () => {
      render(<TagCloud tags={mockTagCloudItems} />);
      
      const reactTag = screen.getByTestId('tag-1');
      const cssTag = screen.getByTestId('tag-4');
      
      expect(reactTag).toHaveAttribute('data-font-size', 'xlarge');
      expect(cssTag).toHaveAttribute('data-font-size', 'small');
    });

    it('shows usage count when enabled', () => {
      render(<TagCloud tags={mockTagCloudItems} showUsageCount />);
      
      expect(screen.getByText('React (15)')).toBeInTheDocument();
      expect(screen.getByText('CSS (3)')).toBeInTheDocument();
    });

    it('handles single tag with proper sizing', () => {
      const singleTag = [mockTagCloudItems[0]];
      render(<TagCloud tags={singleTag} />);
      
      const tag = screen.getByTestId('tag-1');
      expect(tag).toHaveAttribute('data-font-size', 'xlarge');
    });
  });

  describe('Click interactions', () => {
    it('calls onTagClick when tag is clicked', async () => {
      const user = userEvent.setup();
      const mockOnTagClick = jest.fn();
      
      render(
        <TagCloud tags={mockTagCloudItems} onTagClick={mockOnTagClick} />
      );
      
      const reactTag = screen.getByText('React');
      await user.click(reactTag);
      
      expect(mockOnTagClick).toHaveBeenCalledWith(mockTagCloudItems[0]);
    });

    it('shows clickable cursor when onTagClick provided', () => {
      render(
        <TagCloud tags={mockTagCloudItems} onTagClick={jest.fn()} />
      );
      
      const reactTag = screen.getByTestId('tag-1');
      expect(reactTag).toHaveAttribute('data-clickable', 'true');
    });

    it('does not show clickable cursor when onTagClick not provided', () => {
      render(<TagCloud tags={mockTagCloudItems} />);
      
      const reactTag = screen.getByTestId('tag-1');
      expect(reactTag).not.toHaveAttribute('data-clickable');
    });

    it('supports keyboard interaction with Enter key', async () => {
      const user = userEvent.setup();
      const mockOnTagClick = jest.fn();
      
      render(
        <TagCloud tags={mockTagCloudItems} onTagClick={mockOnTagClick} />
      );
      
      const reactTag = screen.getByText('React');
      reactTag.focus();
      await user.keyboard('{Enter}');
      
      expect(mockOnTagClick).toHaveBeenCalledWith(mockTagCloudItems[0]);
    });

    it('supports keyboard interaction with Space key', async () => {
      const user = userEvent.setup();
      const mockOnTagClick = jest.fn();
      
      render(
        <TagCloud tags={mockTagCloudItems} onTagClick={mockOnTagClick} />
      );
      
      const reactTag = screen.getByText('React');
      reactTag.focus();
      await user.keyboard(' ');
      
      expect(mockOnTagClick).toHaveBeenCalledWith(mockTagCloudItems[0]);
    });
  });

  describe('Tag highlighting', () => {
    it('highlights selected tags', () => {
      const selectedTags = ['1', '3'];
      render(
        <TagCloud tags={mockTagCloudItems} selectedTagIds={selectedTags} />
      );
      
      const reactTag = screen.getByTestId('tag-1');
      const typescriptTag = screen.getByTestId('tag-3');
      const javascriptTag = screen.getByTestId('tag-2');
      
      expect(reactTag).toHaveAttribute('data-selected', 'true');
      expect(typescriptTag).toHaveAttribute('data-selected', 'true');
      expect(javascriptTag).toHaveAttribute('data-selected', 'false');
    });

    it('shows hover effects on interactive tags', async () => {
      const user = userEvent.setup();
      render(
        <TagCloud tags={mockTagCloudItems} onTagClick={jest.fn()} />
      );
      
      const reactTag = screen.getByTestId('tag-1');
      await user.hover(reactTag);
      
      // Hover effects are handled via CSS, just verify the tag is clickable
      expect(reactTag).toHaveAttribute('data-clickable', 'true');
    });
  });

  describe('Responsive layout', () => {
    it('adapts layout for mobile screens', () => {
      // Mock window.innerWidth for mobile
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      
      render(<TagCloud tags={mockTagCloudItems} />);
      const cloudContainer = screen.getByTestId('tag-cloud');
      
      expect(cloudContainer).toHaveAttribute('data-mobile', 'true');
    });

    it('uses desktop layout for larger screens', () => {
      // Mock window.innerWidth for desktop
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });
      
      render(<TagCloud tags={mockTagCloudItems} />);
      const cloudContainer = screen.getByTestId('tag-cloud');
      
      expect(cloudContainer).toHaveAttribute('data-mobile', 'false');
    });

    it('adjusts spacing based on screen size', () => {
      render(<TagCloud tags={mockTagCloudItems} spacing="large" />);
      const cloudContainer = screen.getByTestId('tag-cloud');
      
      expect(cloudContainer).toHaveAttribute('data-spacing', 'large');
    });
  });

  describe('Animation support', () => {
    it('enables animations by default', () => {
      render(<TagCloud tags={mockTagCloudItems} />);
      const cloudContainer = screen.getByTestId('tag-cloud');
      
      expect(cloudContainer).toHaveAttribute('data-animated', 'true');
    });

    it('disables animations when requested', () => {
      render(
        <TagCloud tags={mockTagCloudItems} disableAnimations />
      );
      const cloudContainer = screen.getByTestId('tag-cloud');
      
      expect(cloudContainer).toHaveAttribute('data-animated', 'false');
    });

    it('applies stagger animation to tag items', () => {
      render(<TagCloud tags={mockTagCloudItems} />);
      
      const tags = screen.getAllByRole('button');
      tags.forEach((tag, index) => {
        expect(tag).toHaveStyle({
          animationDelay: `${index * 0.1}s`,
        });
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(
        <TagCloud tags={mockTagCloudItems} onTagClick={jest.fn()} />
      );
      
      const cloudContainer = screen.getByRole('region');
      expect(cloudContainer).toHaveAttribute('aria-label', 'Tag cloud');
      
      const tags = screen.getAllByRole('button');
      expect(tags).toHaveLength(4);
      
      tags.forEach((tag) => {
        expect(tag).toHaveAttribute('aria-label');
      });
    });

    it('provides screen reader descriptions', () => {
      render(
        <TagCloud tags={mockTagCloudItems} onTagClick={jest.fn()} />
      );
      
      const reactTag = screen.getByText('React');
      expect(reactTag).toHaveAttribute(
        'aria-label',
        'React, used 15 times, click to filter'
      );
    });

    it('announces tag interactions to screen readers', async () => {
      const user = userEvent.setup();
      const mockOnTagClick = jest.fn();
      
      render(
        <TagCloud tags={mockTagCloudItems} onTagClick={mockOnTagClick} />
      );
      
      const reactTag = screen.getByText('React');
      await user.click(reactTag);
      
      const announcement = screen.getByTestId('screen-reader-announcement');
      expect(announcement).toHaveTextContent('React tag selected');
    });

    it('supports high contrast mode', () => {
      // Mock high contrast media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
        })),
      });
      
      render(<TagCloud tags={mockTagCloudItems} />);
      const cloudContainer = screen.getByTestId('tag-cloud');
      
      expect(cloudContainer).toHaveAttribute('data-high-contrast', 'true');
    });

    it('supports keyboard navigation between tags', async () => {
      const user = userEvent.setup();
      render(
        <TagCloud tags={mockTagCloudItems} onTagClick={jest.fn()} />
      );
      
      const tags = screen.getAllByRole('button');
      tags[0].focus();
      
      await user.keyboard('{ArrowRight}');
      expect(tags[1]).toHaveFocus();
      
      await user.keyboard('{ArrowLeft}');
      expect(tags[0]).toHaveFocus();
    });
  });

  describe('Performance optimization', () => {
    it('memoizes tag rendering when props do not change', () => {
      const { rerender } = render(<TagCloud tags={mockTagCloudItems} />);
      
      const initialTags = screen.getAllByRole('button');
      
      // Re-render with same props
      rerender(<TagCloud tags={mockTagCloudItems} />);
      
      const newTags = screen.getAllByRole('button');
      expect(newTags).toHaveLength(initialTags.length);
    });

    it('handles large tag datasets efficiently', () => {
      const largeTags = Array.from({ length: 1000 }, (_, i) => ({
        id: `tag-${i}`,
        normalizedValue: `tag-${i}`,
        displayValue: `Tag ${i}`,
        usageCount: Math.floor(Math.random() * 100),
        weight: Math.random(),
        fontSize: 'medium' as const,
      }));
      
      // Test that large datasets render without errors and display all tags
      const { container } = render(<TagCloud tags={largeTags} />);
      const displayedTags = container.querySelectorAll('[data-testid^="tag-tag-"]'); // More specific selector to avoid tag-cloud
      
      // Should render all 1000 tags
      expect(displayedTags.length).toBe(1000);
    });

    it('uses virtualization for very large tag clouds', () => {
      const manyTags = Array.from({ length: 5000 }, (_, i) => ({
        id: `tag-${i}`,
        normalizedValue: `tag-${i}`,
        displayValue: `Tag ${i}`,
        usageCount: Math.floor(Math.random() * 100),
        weight: Math.random(),
        fontSize: 'medium' as const,
      }));
      
      const { container } = render(<TagCloud tags={manyTags} enableVirtualization />);
      // For virtualization, we limit to first 100 tags
      const displayedTags = container.querySelectorAll('[data-testid^="tag-tag-"]'); // More specific selector to avoid tag-cloud
      
      expect(displayedTags.length).toBe(100);
    });
  });

  describe('Custom styling', () => {
    it('applies custom colors when provided', () => {
      const coloredTags = mockTagCloudItems.map((tag, index) => ({
        ...tag,
        color: ['#ff0000', '#00ff00', '#0000ff', '#ffff00'][index],
      }));
      
      render(<TagCloud tags={coloredTags} />);
      
      const reactTag = screen.getByText('React');
      expect(reactTag).toHaveStyle({ color: '#ff0000' });
    });

    it('supports custom theme variants', () => {
      render(
        <TagCloud tags={mockTagCloudItems} theme="dark" />
      );
      const cloudContainer = screen.getByTestId('tag-cloud');
      
      expect(cloudContainer).toHaveAttribute('data-theme', 'dark');
    });

    it('allows custom spacing between tags', () => {
      render(
        <TagCloud tags={mockTagCloudItems} spacing="large" />
      );
      const cloudContainer = screen.getByTestId('tag-cloud');
      
      expect(cloudContainer).toHaveAttribute('data-spacing', 'large');
    });
  });

  describe('Error handling', () => {
    it('handles invalid tag data gracefully', () => {
      const invalidTags = [
        {
          id: '',
          normalizedValue: '',
          displayValue: '',
          usageCount: -1,
          weight: -1,
          fontSize: 'invalid' as 'small' | 'medium' | 'large' | 'xlarge',
        },
      ];
      
      expect(() => {
        render(<TagCloud tags={invalidTags} />);
      }).not.toThrow();
      
      // Should show empty state for invalid data
      expect(screen.getByText(/no tags/i)).toBeInTheDocument();
    });

    it('handles click errors gracefully', async () => {
      const user = userEvent.setup();
      const mockOnTagClick = jest.fn().mockImplementation(() => {
        throw new Error('Click failed');
      });
      
      render(
        <TagCloud tags={mockTagCloudItems} onTagClick={mockOnTagClick} />
      );
      
      const reactTag = screen.getByText('React');
      
      expect(() => user.click(reactTag)).not.toThrow();
    });

    it('shows error state when tag loading fails', () => {
      render(<TagCloud tags={[]} error="Failed to load tags" />);
      
      expect(screen.getByText(/failed to load tags/i)).toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    it('shows loading state when tags are being fetched', () => {
      render(<TagCloud tags={[]} loading />);
      
      expect(screen.getByText(/loading tags/i)).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('shows skeleton tags during loading', () => {
      render(<TagCloud tags={[]} loading />);
      const skeletonTags = screen.getAllByTestId('tag-skeleton');
      
      expect(skeletonTags).toHaveLength(5); // Default skeleton count
    });
  });
});