import { TagFrequency } from '@/types/Record';
import { cn } from '@/lib/utils';
import { useRef, useEffect, KeyboardEvent, forwardRef, useImperativeHandle, useState } from 'react';

interface TagCloudProps {
  tagFrequencies: TagFrequency[];
  onTagClick: (tag: string) => void;
  onNavigateUp?: () => void;
}

export interface TagCloudRef {
  focusFirst: () => void;
}

export const TagCloud = forwardRef<TagCloudRef, TagCloudProps>(({ tagFrequencies, onTagClick, onNavigateUp }, ref) => {
  const maxCount = Math.max(...tagFrequencies.map(t => t.count));
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

  useImperativeHandle(ref, (): TagCloudRef => ({
    focusFirst: (): void => {
      if (buttonRefs.current[0]) {
        buttonRefs.current[0].focus();
      }
    }
  }));

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const row = Math.floor(index / gridCols);
    const col = index % gridCols;
    const totalRows = Math.ceil(tagFrequencies.length / gridCols);

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        if (col > 0) {
          buttonRefs.current[index - 1]?.focus();
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (col < gridCols - 1 && index + 1 < tagFrequencies.length) {
          buttonRefs.current[index + 1]?.focus();
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (row > 0) {
          const targetIndex = (row - 1) * gridCols + col;
          if (targetIndex < tagFrequencies.length) {
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
          if (targetIndex < tagFrequencies.length) {
            buttonRefs.current[targetIndex]?.focus();
          } else {
            // If no element directly below, jump to first element in the last row
            const firstIndexInLastRow = (totalRows - 1) * gridCols;
            if (firstIndexInLastRow < tagFrequencies.length) {
              buttonRefs.current[firstIndexInLastRow]?.focus();
            }
          }
        }
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        onTagClick(tagFrequencies[index].tag);
        break;
      case 'Escape':
        e.preventDefault();
        if (onNavigateUp) {
          onNavigateUp();
        }
        break;
    }
  };
  
  const getTagSize = (count: number): string => {
    const ratio = count / maxCount;
    if (ratio >= 0.8) return 'text-lg font-bold';
    if (ratio >= 0.6) return 'text-base font-semibold';
    if (ratio >= 0.4) return 'text-sm font-medium';
    if (ratio >= 0.2) return 'text-sm';
    return 'text-xs';
  };

  if (tagFrequencies.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-muted-foreground text-lg">No records found</div>
        <div className="text-muted-foreground text-sm mt-2">Press Enter to create</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
        {tagFrequencies.slice(0, 50).map((item, index) => (
          <button
            key={item.tag}
            ref={el => buttonRefs.current[index] = el}
            className={cn(
              "tag-cloud-item text-center",
              getTagSize(item.count)
            )}
            onClick={() => onTagClick(item.tag)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            tabIndex={-1}
          >
            {item.tag}
          </button>
        ))}
      </div>
    </div>
  );
});