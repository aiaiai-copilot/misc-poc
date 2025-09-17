import { TagFrequency } from '@/types/Record';
import { TagCloudItemDTO } from '@misc-poc/application';
import { cn } from '@/lib/utils';
import {
  useRef,
  useEffect,
  KeyboardEvent,
  forwardRef,
  useImperativeHandle,
  useState,
} from 'react';

interface TagCloudProps {
  tagFrequencies?: TagFrequency[];
  tagCloudItems?: TagCloudItemDTO[];
  onTagClick: (tag: string) => void;
  onNavigateUp?: () => void;
}

export interface TagCloudRef {
  focusFirst: () => void;
}

export const TagCloud = forwardRef<TagCloudRef, TagCloudProps>(
  ({ tagFrequencies, tagCloudItems, onTagClick, onNavigateUp }, ref) => {
    // Normalize data to common format
    const normalizedItems =
      tagCloudItems ||
      tagFrequencies?.map((tf, index) => ({
        id: `${index}`,
        normalizedValue: tf.tag,
        displayValue: tf.tag,
        usageCount: tf.count,
        weight: 0,
        fontSize: 'medium' as const,
      })) ||
      [];

    const maxCount =
      normalizedItems.length > 0
        ? Math.max(...normalizedItems.map((item) => item.usageCount))
        : 0;
    const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const [gridCols, setGridCols] = useState(8);

    // Update grid columns based on screen size
    useEffect(() => {
      const updateGridCols = (): void => {
        const width = window.innerWidth;
        if (width < 640) {
          setGridCols(2); // grid-cols-2
        } else if (width < 768) {
          setGridCols(3); // sm:grid-cols-3
        } else if (width < 1024) {
          setGridCols(4); // md:grid-cols-4
        } else if (width < 1280) {
          setGridCols(6); // lg:grid-cols-6
        } else {
          setGridCols(8); // xl:grid-cols-8
        }
      };

      updateGridCols();
      window.addEventListener('resize', updateGridCols);
      return (): void => window.removeEventListener('resize', updateGridCols);
    }, []);

    useImperativeHandle(
      ref,
      (): TagCloudRef => ({
        focusFirst: (): void => {
          if (buttonRefs.current[0]) {
            buttonRefs.current[0].focus();
          }
        },
      })
    );

    const handleKeyDown = (
      e: KeyboardEvent<HTMLButtonElement>,
      index: number
    ): void => {
      const row = Math.floor(index / gridCols);
      const col = index % gridCols;
      const totalRows = Math.ceil(normalizedItems.length / gridCols);

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (col > 0) {
            buttonRefs.current[index - 1]?.focus();
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (col < gridCols - 1 && index + 1 < normalizedItems.length) {
            buttonRefs.current[index + 1]?.focus();
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (row > 0) {
            const targetIndex = (row - 1) * gridCols + col;
            if (targetIndex < normalizedItems.length) {
              buttonRefs.current[targetIndex]?.focus();
            }
          } else if (onNavigateUp) {
            onNavigateUp();
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (row < totalRows - 1) {
            const targetIndex = (row + 1) * gridCols + col;
            if (targetIndex < normalizedItems.length) {
              buttonRefs.current[targetIndex]?.focus();
            } else {
              // If no element directly below, jump to first element in the last row
              const firstIndexInLastRow = (totalRows - 1) * gridCols;
              if (firstIndexInLastRow < normalizedItems.length) {
                buttonRefs.current[firstIndexInLastRow]?.focus();
              }
            }
          }
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          onTagClick(normalizedItems[index].normalizedValue);
          break;
        case 'Escape':
          e.preventDefault();
          if (onNavigateUp) {
            onNavigateUp();
          }
          break;
      }
    };

    const getTagSize = (item: (typeof normalizedItems)[0]): string => {
      // Use TagCloudItemDTO fontSize if available
      if (tagCloudItems && item.fontSize) {
        switch (item.fontSize) {
          case 'xlarge':
            return 'text-xl font-bold';
          case 'large':
            return 'text-lg font-semibold';
          case 'medium':
            return 'text-base font-medium';
          case 'small':
            return 'text-sm';
          default:
            return 'text-sm';
        }
      }

      // Fallback to frequency-based calculation
      const ratio = maxCount > 0 ? item.usageCount / maxCount : 0;
      if (ratio >= 0.8) return 'text-lg font-bold';
      if (ratio >= 0.6) return 'text-base font-semibold';
      if (ratio >= 0.4) return 'text-sm font-medium';
      if (ratio >= 0.2) return 'text-sm';
      return 'text-xs';
    };

    if (normalizedItems.length === 0) {
      return (
        <div className="text-center py-16">
          <div className="text-muted-foreground text-lg">No records found</div>
          <div className="text-muted-foreground text-sm mt-2">
            Press Enter to create
          </div>
        </div>
      );
    }

    return (
      <div
        className="w-full max-w-4xl mx-auto border-8 border-l-16 rounded-md bg-background shadow-inner overflow-hidden"
        style={{ borderColor: '#A9A9A9' }}
        data-testid="tag-cloud"
      >
        <div className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
            {normalizedItems.slice(0, 50).map((item, index) => (
              <button
                key={item.id}
                ref={(el) => (buttonRefs.current[index] = el)}
                className={cn('tag-cloud-item text-center', getTagSize(item))}
                onClick={() => onTagClick(item.normalizedValue)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                tabIndex={-1}
                data-testid="tag-item"
              >
                {item.displayValue}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }
);
