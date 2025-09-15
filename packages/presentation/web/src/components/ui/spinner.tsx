import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const spinnerVariants = cva(
  'animate-spin rounded-full border-2 border-solid border-current border-r-transparent',
  {
    variants: {
      size: {
        sm: 'h-4 w-4',
        md: 'h-6 w-6',
        lg: 'h-8 w-8',
        xl: 'h-12 w-12'
      },
      variant: {
        primary: 'text-primary',
        secondary: 'text-muted-foreground',
        destructive: 'text-destructive',
        default: 'text-current'
      }
    },
    defaultVariants: {
      size: 'md',
      variant: 'default'
    }
  }
);

export interface SpinnerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof spinnerVariants> {
  'aria-label'?: string;
  inline?: boolean;
  hideRole?: boolean;
}

const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
  ({ className, size, variant, inline, hideRole, 'aria-label': ariaLabel, ...props }, ref) => {
    return (
      <div
        ref={ref}
        {...(!hideRole && { role: 'status', 'aria-label': ariaLabel || 'Loading...' })}
        className={cn(
          spinnerVariants({ size, variant }),
          inline && 'inline-block',
          className
        )}
        {...props}
      >
        <svg
          className="h-full w-full"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          data-loading-spinner
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="60 40"
            className="animate-spin origin-center"
          />
        </svg>
      </div>
    );
  }
);

Spinner.displayName = 'Spinner';

export { Spinner };