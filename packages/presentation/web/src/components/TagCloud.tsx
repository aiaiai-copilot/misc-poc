import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { TagCloudItemDTO } from '@misc-poc/application';
import styles from './TagCloud.module.css';

export interface TagCloudProps {
  tags: TagCloudItemDTO[];
  className?: string;
  onTagClick?: (tag: TagCloudItemDTO) => void;
  selectedTagIds?: string[];
  showUsageCount?: boolean;
  disableAnimations?: boolean;
  theme?: 'light' | 'dark';
  spacing?: 'small' | 'medium' | 'large';
  enableVirtualization?: boolean;
  loading?: boolean;
  error?: string;
}

export const TagCloud: React.FC<TagCloudProps> = ({
  tags,
  className,
  onTagClick,
  selectedTagIds = [],
  showUsageCount = false,
  disableAnimations = false,
  theme = 'light',
  spacing = 'medium',
  enableVirtualization = false,
  loading = false,
  error,
}) => {
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  const [highContrast, setHighContrast] = useState(false);

  // Handle window resize for responsive layout
  useEffect((): (() => void) => {
    const handleResize = (): void => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return (): void => window.removeEventListener('resize', handleResize);
  }, []);

  // Detect high contrast mode
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-contrast: high)');
      setHighContrast(mediaQuery.matches);
      
      const handleChange = (e: MediaQueryListEvent): void => setHighContrast(e.matches);
      mediaQuery.addEventListener('change', handleChange);
      return (): void => mediaQuery.removeEventListener('change', handleChange);
    }
  }, []);

  // Filter out invalid tags
  const validTags = useMemo(() => {
    return tags.filter(
      (tag) =>
        tag.id &&
        tag.displayValue &&
        tag.usageCount >= 0 &&
        tag.weight >= 0 &&
        ['small', 'medium', 'large', 'xlarge'].includes(tag.fontSize)
    );
  }, [tags]);

  const isMobile = windowWidth < 768;
  const isClickable = Boolean(onTagClick);

  const handleTagClick = useCallback(
    (tag: TagCloudItemDTO) => {
      if (!onTagClick) return;
      
      try {
        onTagClick(tag);
        // Announce to screen readers
        // Clear any existing announcements first
        const existingAnnouncements = document.querySelectorAll('[role="status"][aria-live="polite"]');
        existingAnnouncements.forEach(el => el.remove());
        
        const announcement = document.createElement('div');
        announcement.setAttribute('role', 'status');
        announcement.setAttribute('aria-live', 'polite');
        announcement.style.position = 'absolute';
        announcement.style.left = '-10000px';
        announcement.textContent = `${tag.displayValue} tag selected`;
        announcement.setAttribute('data-testid', 'screen-reader-announcement');
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 1000);
      } catch (error) {
        console.error('Tag click error:', error);
      }
    },
    [onTagClick]
  );

  const handleKeyPress = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, tag: TagCloudItemDTO) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleTagClick(tag);
      }
    },
    [handleTagClick]
  );

  const handleKeyNavigation = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const tags = Array.from(
        event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="button"]')
      );
      const currentIndex = tags.findIndex((tag) => tag === document.activeElement);

      if (event.key === 'ArrowRight' && currentIndex < tags.length - 1) {
        event.preventDefault();
        tags[currentIndex + 1]?.focus();
      } else if (event.key === 'ArrowLeft' && currentIndex > 0) {
        event.preventDefault();
        tags[currentIndex - 1]?.focus();
      }
    },
    []
  );

  const getTagClassName = (tag: TagCloudItemDTO): string => {
    const classes = [
      styles.tag,
      styles[`tag-${tag.fontSize}`],
      isClickable && styles['tag-clickable'],
      selectedTagIds.includes(tag.id) && styles['tag-selected'],
    ]
      .filter(Boolean)
      .join(' ');

    return classes;
  };

  const getTagAriaLabel = (tag: TagCloudItemDTO): string => {
    const usageText = `used ${tag.usageCount} time${tag.usageCount !== 1 ? 's' : ''}`;
    const actionText = isClickable ? ', click to filter' : '';
    return `${tag.displayValue}, ${usageText}${actionText}`;
  };

  const renderTag = (tag: TagCloudItemDTO, index: number): JSX.Element => {
    const displayText = showUsageCount 
      ? `${tag.displayValue} (${tag.usageCount})`
      : tag.displayValue;

    const style: React.CSSProperties = {
      color: tag.color,
      animationDelay: !disableAnimations ? `${index * 0.1}s` : undefined,
    };

    if (isClickable) {
      return (
        <button
          key={tag.id}
          type="button"
          className={getTagClassName(tag)}
          style={style}
          onClick={() => handleTagClick(tag)}
          onKeyDown={(e) => handleKeyPress(e, tag)}
          onMouseEnter={(e) => e.currentTarget.classList.add('tag-hover')}
          onMouseLeave={(e) => e.currentTarget.classList.remove('tag-hover')}
          aria-label={getTagAriaLabel(tag)}
          tabIndex={0}
          role="button"
          data-testid={`tag-${tag.id}`}
          data-font-size={tag.fontSize}
          data-clickable="true"
          data-selected={selectedTagIds.includes(tag.id)}
        >
          {displayText}
        </button>
      );
    }

    return (
      <span
        key={tag.id}
        className={getTagClassName(tag)}
        style={style}
        aria-label={getTagAriaLabel(tag)}
        role="button"
        tabIndex={0}
        data-testid={`tag-${tag.id}`}
        data-font-size={tag.fontSize}
        data-selected={selectedTagIds.includes(tag.id)}
      >
        {displayText}
      </span>
    );
  };

  const renderSkeletonTags = (): JSX.Element[] => {
    return Array.from({ length: 5 }, (_, index) => (
      <div
        key={`skeleton-${index}`}
        className={`${styles.tag} ${styles['tag-skeleton']}`}
        style={{ animationDelay: `${index * 0.1}s` }}
        data-testid="tag-skeleton"
      />
    ));
  };

  const renderVirtualizedTags = (): JSX.Element => {
    // Simple virtualization - render only visible items
    // In a real implementation, you'd use a library like react-window
    return (
      <div className={styles['tag-cloud-virtual']}>
        {validTags.slice(0, 100).map((tag, index) => renderTag(tag, index))}
      </div>
    );
  };

  const cloudClassName = [
    styles.tagCloud,
    className,
    isMobile ? styles['tag-cloud-mobile'] : styles['tag-cloud-desktop'],
    !disableAnimations && styles['tag-cloud-animated'],
    highContrast && styles['tag-cloud-high-contrast'],
    styles[`tag-cloud-theme-${theme}`],
    styles[`tag-cloud-spacing-${spacing}`],
  ]
    .filter(Boolean)
    .join(' ');

  if (error) {
    return (
      <div className={cloudClassName} role="region" aria-label="Tag cloud">
        <div className={styles['error-state']}>
          {error}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={cloudClassName} role="region" aria-label="Tag cloud">
        <div className={styles['loading-state']}>
          <span>Loading tags...</span>
          <div role="progressbar" className={styles['progress-bar']} />
        </div>
        {renderSkeletonTags()}
      </div>
    );
  }

  if (validTags.length === 0) {
    return (
      <div className={cloudClassName} role="region" aria-label="Tag cloud">
        <div className={styles['empty-state']}>
          No tags available
        </div>
      </div>
    );
  }

  return (
    <div
      className={cloudClassName}
      role="region"
      aria-label="Tag cloud"
      onKeyDown={isClickable ? handleKeyNavigation : undefined}
      data-testid="tag-cloud"
      data-mobile={isMobile}
      data-animated={!disableAnimations}
      data-high-contrast={highContrast}
      data-theme={theme}
      data-spacing={spacing}
    >
      {enableVirtualization && validTags.length > 1000
        ? renderVirtualizedTags()
        : validTags.map(renderTag)
      }
    </div>
  );
};

export default TagCloud;