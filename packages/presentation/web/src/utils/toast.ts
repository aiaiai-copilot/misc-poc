import { toast as sonnerToast } from 'sonner';

export interface ToastOptions {
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  cancel?: {
    label: string;
    onClick: () => void; // Made required to match Sonner's Action type
  };
  id?: string | number;
  important?: boolean; // Makes the toast use assertive live region
}

/**
 * Utility functions for displaying toast notifications
 * following consistent patterns across the application
 */
export const toast = {
  /**
   * Display a success toast notification
   */
  success: (message: string, options?: ToastOptions): string | number => {
    return sonnerToast.success(message, options);
  },

  /**
   * Display an error toast notification
   */
  error: (message: string, options?: ToastOptions): string | number => {
    return sonnerToast.error(message, options);
  },

  /**
   * Display an info toast notification
   */
  info: (message: string, options?: ToastOptions): string | number => {
    return sonnerToast.info(message, options);
  },

  /**
   * Display a warning toast notification
   */
  warning: (message: string, options?: ToastOptions): string | number => {
    return sonnerToast.warning(message, options);
  },

  /**
   * Display a loading toast notification
   */
  loading: (
    message: string,
    options?: Omit<ToastOptions, 'action'>
  ): string | number => {
    return sonnerToast.loading(message, options);
  },

  /**
   * Display a basic toast notification
   */
  message: (message: string, options?: ToastOptions): string | number => {
    return sonnerToast(message, options);
  },

  /**
   * Dismiss a specific toast by ID
   */
  dismiss: (id?: string | number): void => {
    sonnerToast.dismiss(id);
  },

  /**
   * Common toast patterns for application operations
   */
  operations: {
    /**
     * Show operation success with optional retry action
     */
    operationSuccess: (
      operation: string,
      options?: { onUndo?: () => void }
    ): string | number => {
      return toast.success(`${operation} completed successfully`, {
        duration: 4000,
        action: options?.onUndo
          ? {
              label: 'Undo',
              onClick: options.onUndo,
            }
          : undefined,
      });
    },

    /**
     * Show operation error with retry action
     */
    operationError: (
      operation: string,
      error: string,
      onRetry?: () => void
    ): string | number => {
      return toast.error(`Failed to ${operation.toLowerCase()}: ${error}`, {
        duration: 6000,
        action: onRetry
          ? {
              label: 'Retry',
              onClick: onRetry,
            }
          : undefined,
      });
    },

    /**
     * Show operation loading state
     */
    operationLoading: (operation: string): string | number => {
      return toast.loading(`${operation}...`);
    },

    /**
     * Update a loading toast to success
     */
    updateToSuccess: (
      id: string | number,
      operation: string,
      options?: { onUndo?: () => void }
    ): string | number => {
      return sonnerToast.success(`${operation} completed successfully`, {
        id,
        duration: 4000,
        action: options?.onUndo
          ? {
              label: 'Undo',
              onClick: options.onUndo,
            }
          : undefined,
      });
    },

    /**
     * Update a loading toast to error
     */
    updateToError: (
      id: string | number,
      operation: string,
      error: string,
      onRetry?: () => void
    ): string | number => {
      return sonnerToast.error(
        `Failed to ${operation.toLowerCase()}: ${error}`,
        {
          id,
          duration: 6000,
          action: onRetry
            ? {
                label: 'Retry',
                onClick: onRetry,
              }
            : undefined,
        }
      );
    },
  },
};

/**
 * Helper to get user-friendly error messages from various error types
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'An unexpected error occurred';
};

/**
 * Toast patterns for Result type integration
 */
export const resultToast = {
  /**
   * Handle Result.success case with toast
   */
  success: <T>(
    result: T,
    operation: string,
    options?: { onUndo?: () => void }
  ): string | number => {
    return toast.operations.operationSuccess(operation, options);
  },

  /**
   * Handle Result.error case with toast
   */
  error: (
    error: { message?: string; code?: string },
    operation: string,
    onRetry?: () => void
  ): string | number => {
    const message = error.message || 'Unknown error';
    return toast.operations.operationError(operation, message, onRetry);
  },
};

/**
 * Accessibility-enhanced toast patterns
 */
export const accessibleToast = {
  /**
   * Display critical error that requires immediate attention
   */
  criticalError: (message: string, options?: ToastOptions): string | number => {
    return toast.error(message, {
      ...options,
      important: true,
      duration: 8000, // Longer duration for critical errors
      action: options?.action || undefined,
    });
  },

  /**
   * Display operation status with proper announcements
   */
  operationStatus: (
    status: 'started' | 'completed' | 'failed',
    operation: string,
    details?: string
  ): string | number => {
    switch (status) {
      case 'started':
        return toast.loading(`${operation} in progress...`);
      case 'completed':
        return toast.success(
          `${operation} completed${details ? `: ${details}` : ''}`,
          {
            duration: 4000,
          }
        );
      case 'failed':
        return toast.error(
          `${operation} failed${details ? `: ${details}` : ''}`,
          {
            important: true,
            duration: 6000,
          }
        );
      default:
        return toast.message(`${operation} status: ${status}`);
    }
  },

  /**
   * Display progress updates for long-running operations
   */
  progressUpdate: (
    operation: string,
    progress: number,
    total?: number
  ): string | number => {
    const progressText = total ? `${progress}/${total}` : `${progress}%`;
    return toast.loading(`${operation}: ${progressText}`, {
      id: `progress-${operation}`, // Use consistent ID for updates
    });
  },

  /**
   * Announce completion of progress-tracked operation
   */
  progressComplete: (operation: string, result?: string): string | number => {
    const message = `${operation} completed${result ? `: ${result}` : ''}`;
    return sonnerToast.success(message, {
      id: `progress-${operation}`, // Update the progress toast
      duration: 4000,
    });
  },
};
