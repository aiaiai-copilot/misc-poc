import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock sonner module with factory function
vi.mock('sonner', () => {
  const mockToast = vi.fn();
  mockToast.success = vi.fn();
  mockToast.error = vi.fn();
  mockToast.info = vi.fn();
  mockToast.warning = vi.fn();
  mockToast.loading = vi.fn();
  mockToast.dismiss = vi.fn();

  return {
    toast: mockToast
  };
});

// Import after mocking
import { toast, getErrorMessage, resultToast } from '../toast';
import { toast as sonnerToast } from 'sonner';

const mockSonnerToast = sonnerToast as any;

describe('Toast Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic toast functions', () => {
    it('should call sonner success toast', () => {
      toast.success('Success message');
      expect(mockSonnerToast.success).toHaveBeenCalledWith('Success message', undefined);
    });

    it('should call sonner error toast', () => {
      toast.error('Error message');
      expect(mockSonnerToast.error).toHaveBeenCalledWith('Error message', undefined);
    });

    it('should call sonner info toast', () => {
      toast.info('Info message');
      expect(mockSonnerToast.info).toHaveBeenCalledWith('Info message', undefined);
    });

    it('should call sonner warning toast', () => {
      toast.warning('Warning message');
      expect(mockSonnerToast.warning).toHaveBeenCalledWith('Warning message', undefined);
    });

    it('should call sonner loading toast', () => {
      toast.loading('Loading message');
      expect(mockSonnerToast.loading).toHaveBeenCalledWith('Loading message', undefined);
    });

    it('should call sonner basic toast', () => {
      toast.message('Basic message');
      expect(mockSonnerToast).toHaveBeenCalledWith('Basic message', undefined);
    });

    it('should call sonner dismiss', () => {
      toast.dismiss('toast-id');
      expect(mockSonnerToast.dismiss).toHaveBeenCalledWith('toast-id');
    });
  });

  describe('toast with options', () => {
    it('should pass through toast options', () => {
      const options = {
        duration: 5000,
        action: {
          label: 'Action',
          onClick: vi.fn()
        }
      };

      toast.success('Message', options);
      expect(mockSonnerToast.success).toHaveBeenCalledWith('Message', options);
    });

    it('should handle action clicks', () => {
      const mockAction = vi.fn();
      const options = {
        action: {
          label: 'Click me',
          onClick: mockAction
        }
      };

      toast.error('Error with action', options);
      expect(mockSonnerToast.error).toHaveBeenCalledWith('Error with action', options);

      // Simulate action click
      const callArgs = mockSonnerToast.error.mock.calls[0];
      const actionCallback = callArgs[1]?.action?.onClick;
      actionCallback?.();
      expect(mockAction).toHaveBeenCalled();
    });
  });

  describe('operation toasts', () => {
    it('should show operation success toast', () => {
      toast.operations.operationSuccess('Import data');
      expect(mockSonnerToast.success).toHaveBeenCalledWith(
        'Import data completed successfully',
        {
          duration: 4000,
          action: undefined
        }
      );
    });

    it('should show operation success with undo action', () => {
      const mockUndo = vi.fn();
      toast.operations.operationSuccess('Delete record', { onUndo: mockUndo });

      expect(mockSonnerToast.success).toHaveBeenCalledWith(
        'Delete record completed successfully',
        {
          duration: 4000,
          action: {
            label: 'Undo',
            onClick: mockUndo
          }
        }
      );
    });

    it('should show operation error toast', () => {
      toast.operations.operationError('Import data', 'Invalid format');
      expect(mockSonnerToast.error).toHaveBeenCalledWith(
        'Failed to import data: Invalid format',
        {
          duration: 6000,
          action: undefined
        }
      );
    });

    it('should show operation error with retry action', () => {
      const mockRetry = vi.fn();
      toast.operations.operationError('Save record', 'Network error', mockRetry);

      expect(mockSonnerToast.error).toHaveBeenCalledWith(
        'Failed to save record: Network error',
        {
          duration: 6000,
          action: {
            label: 'Retry',
            onClick: mockRetry
          }
        }
      );
    });

    it('should show operation loading toast', () => {
      toast.operations.operationLoading('Saving record');
      expect(mockSonnerToast.loading).toHaveBeenCalledWith('Saving record...', undefined);
    });

    it('should update loading toast to success', () => {
      toast.operations.updateToSuccess('loading-id', 'Save record');
      expect(mockSonnerToast.success).toHaveBeenCalledWith(
        'Save record completed successfully',
        {
          id: 'loading-id',
          duration: 4000,
          action: undefined
        }
      );
    });

    it('should update loading toast to error', () => {
      const mockRetry = vi.fn();
      toast.operations.updateToError('loading-id', 'Save record', 'Validation failed', mockRetry);

      expect(mockSonnerToast.error).toHaveBeenCalledWith(
        'Failed to save record: Validation failed',
        {
          id: 'loading-id',
          duration: 6000,
          action: {
            label: 'Retry',
            onClick: mockRetry
          }
        }
      );
    });
  });

  describe('getErrorMessage utility', () => {
    it('should extract message from Error object', () => {
      const error = new Error('Test error message');
      expect(getErrorMessage(error)).toBe('Test error message');
    });

    it('should return string error as-is', () => {
      expect(getErrorMessage('String error')).toBe('String error');
    });

    it('should extract message from object with message property', () => {
      const error = { message: 'Object error message' };
      expect(getErrorMessage(error)).toBe('Object error message');
    });

    it('should return default message for unknown error types', () => {
      expect(getErrorMessage(null)).toBe('An unexpected error occurred');
      expect(getErrorMessage(undefined)).toBe('An unexpected error occurred');
      expect(getErrorMessage(123)).toBe('An unexpected error occurred');
      expect(getErrorMessage({})).toBe('An unexpected error occurred');
    });
  });

  describe('resultToast utilities', () => {
    it('should show success toast for Result.success', () => {
      const result = { data: 'success' };
      resultToast.success(result, 'Create record');

      expect(mockSonnerToast.success).toHaveBeenCalledWith(
        'Create record completed successfully',
        {
          duration: 4000,
          action: undefined
        }
      );
    });

    it('should show success toast with undo action', () => {
      const mockUndo = vi.fn();
      const result = { data: 'success' };
      resultToast.success(result, 'Delete record', { onUndo: mockUndo });

      expect(mockSonnerToast.success).toHaveBeenCalledWith(
        'Delete record completed successfully',
        {
          duration: 4000,
          action: {
            label: 'Undo',
            onClick: mockUndo
          }
        }
      );
    });

    it('should show error toast for Result.error', () => {
      const error = { message: 'Validation failed', code: 'INVALID_INPUT' };
      resultToast.error(error, 'Create record');

      expect(mockSonnerToast.error).toHaveBeenCalledWith(
        'Failed to create record: Validation failed',
        {
          duration: 6000,
          action: undefined
        }
      );
    });

    it('should show error toast with retry action', () => {
      const mockRetry = vi.fn();
      const error = { message: 'Network timeout' };
      resultToast.error(error, 'Save data', mockRetry);

      expect(mockSonnerToast.error).toHaveBeenCalledWith(
        'Failed to save data: Network timeout',
        {
          duration: 6000,
          action: {
            label: 'Retry',
            onClick: mockRetry
          }
        }
      );
    });

    it('should handle error without message', () => {
      const error = { code: 'UNKNOWN_ERROR' };
      resultToast.error(error, 'Process data');

      expect(mockSonnerToast.error).toHaveBeenCalledWith(
        'Failed to process data: Unknown error',
        {
          duration: 6000,
          action: undefined
        }
      );
    });
  });

  describe('auto-dismiss behavior', () => {
    it('should use default duration for success toasts', () => {
      toast.operations.operationSuccess('Test operation');
      const callArgs = mockSonnerToast.success.mock.calls[0];
      expect(callArgs[1]?.duration).toBe(4000);
    });

    it('should use longer duration for error toasts', () => {
      toast.operations.operationError('Test operation', 'Test error');
      const callArgs = mockSonnerToast.error.mock.calls[0];
      expect(callArgs[1]?.duration).toBe(6000);
    });

    it('should allow custom duration override', () => {
      toast.success('Custom duration', { duration: 2000 });
      const callArgs = mockSonnerToast.success.mock.calls[0];
      expect(callArgs[1]?.duration).toBe(2000);
    });

    it('should not set duration for loading toasts by default', () => {
      toast.loading('Loading...');
      const callArgs = mockSonnerToast.loading.mock.calls[0];
      expect(callArgs[1]).toBeUndefined();
    });
  });
});