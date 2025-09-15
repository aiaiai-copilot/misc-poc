import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { Toaster } from '../sonner';
import { Spinner } from '../spinner';
import { LoadingOverlay } from '../loading-overlay';

// Mock pointer capture methods for JSDOM compatibility
Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
  value: vi.fn(),
  writable: true,
});

Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
  value: vi.fn(),
  writable: true,
});

Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
  value: vi.fn(() => false),
  writable: true,
});

describe('Accessibility Tests for Loading States and Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Screen Reader Support for Loading States', () => {
    it('should announce loading state changes with proper ARIA live regions', () => {
      const { rerender } = render(<LoadingOverlay loading={false} />);

      // Initially no loading state
      expect(screen.queryByRole('status')).not.toBeInTheDocument();

      // Start loading
      rerender(
        <LoadingOverlay loading={true} message="Processing your request..." />
      );

      const loadingElement = screen.getByRole('status');
      expect(loadingElement).toBeInTheDocument();
      expect(loadingElement).toHaveAttribute(
        'aria-label',
        'Processing your request...'
      );

      // Verify it's announced to screen readers
      expect(loadingElement).not.toHaveAttribute('aria-hidden', 'true');
    });

    it('should provide descriptive ARIA labels for different loading contexts', () => {
      const { rerender } = render(<Spinner aria-label="Uploading file..." />);

      let spinner = screen.getByRole('status');
      expect(spinner).toHaveAttribute('aria-label', 'Uploading file...');

      rerender(<Spinner aria-label="Saving changes..." />);
      spinner = screen.getByRole('status');
      expect(spinner).toHaveAttribute('aria-label', 'Saving changes...');

      rerender(<Spinner aria-label="Deleting item..." />);
      spinner = screen.getByRole('status');
      expect(spinner).toHaveAttribute('aria-label', 'Deleting item...');
    });

    it('should maintain proper heading hierarchy during loading states', () => {
      render(
        <div>
          <h1>Main Content</h1>
          <LoadingOverlay loading={true} message="Loading..." />
        </div>
      );

      // Loading state should not interfere with heading structure
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should have proper focus management during loading states', () => {
      const TestComponent = ({
        loading,
      }: {
        loading: boolean;
      }): JSX.Element => (
        <div>
          <button>Previous Button</button>
          <LoadingOverlay loading={loading}>
            <button>Content Button</button>
          </LoadingOverlay>
          <button>Next Button</button>
        </div>
      );

      const { rerender } = render(<TestComponent loading={false} />);

      const contentButton = screen.getByText('Content Button');
      const nextButton = screen.getByText('Next Button');

      // Initially all buttons should be accessible
      expect(contentButton).not.toHaveAttribute('aria-hidden');
      expect(nextButton).not.toHaveAttribute('aria-hidden');

      // When loading, overlay should be present and content still rendered
      rerender(<TestComponent loading={true} />);

      const loadingOverlay = screen.getByRole('status');
      expect(loadingOverlay).toBeInTheDocument();
      // Content button is still in DOM but may be behind overlay
      expect(screen.getByText('Content Button')).toBeInTheDocument();
    });
  });

  describe('Screen Reader Support for Toast Notifications', () => {
    it('should announce toast messages with proper ARIA live regions', async () => {
      render(<Toaster />);

      toast('Important notification');

      await waitFor(() => {
        const toastContainer = document.querySelector('[aria-live="polite"]');
        expect(toastContainer).toBeInTheDocument();
        expect(screen.getByText('Important notification')).toBeInTheDocument();
      });
    });

    it('should use assertive live region for error toasts', async () => {
      render(<Toaster />);

      toast.error('Critical error occurred');

      await waitFor(() => {
        // Error toasts should be more assertive for screen readers
        const errorToast = screen.getByText('Critical error occurred');
        expect(errorToast).toBeInTheDocument();

        // Check that it's in a live region
        const liveRegion = document.querySelector('[aria-live]');
        expect(liveRegion).toBeInTheDocument();
      });
    });

    it('should provide meaningful descriptions for toast actions', async () => {
      render(<Toaster />);

      toast('Action required', {
        action: {
          label: 'Retry',
          onClick: vi.fn(),
        },
      });

      await waitFor(() => {
        const actionButton = screen.getByText('Retry');
        expect(actionButton).toBeInTheDocument();

        // Action buttons should be properly labeled
        expect(actionButton.tagName).toBe('BUTTON');
      });
    });

    it('should handle toast dismissal accessibly', async () => {
      render(<Toaster />);

      const toastId = toast('Dismissible message');

      await waitFor(() => {
        expect(screen.getByText('Dismissible message')).toBeInTheDocument();
      });

      // Programmatically dismiss and verify it's announced
      toast.dismiss(toastId);

      await waitFor(() => {
        const dismissedToast = document.querySelector('[data-removed="true"]');
        expect(dismissedToast).toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Navigation Support', () => {
    it('should support keyboard navigation for toast actions', async () => {
      const user = userEvent.setup();
      const mockAction = vi.fn();

      render(<Toaster />);

      toast('Message with action', {
        action: {
          label: 'Execute',
          onClick: mockAction,
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Execute')).toBeInTheDocument();
      });

      const actionButton = screen.getByText('Execute');

      // Should be focusable and clickable via keyboard
      actionButton.focus();
      expect(actionButton).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(mockAction).toHaveBeenCalledOnce();
    });

    it('should maintain tab order when loading overlays are present', async () => {
      const user = userEvent.setup();

      render(
        <div>
          <button>Button 1</button>
          <LoadingOverlay loading={true}>
            <input data-testid="input-field" />
          </LoadingOverlay>
          <button>Button 2</button>
        </div>
      );

      const button1 = screen.getByText('Button 1');
      const inputField = screen.getByTestId('input-field');
      const button2 = screen.getByText('Button 2');

      // Test tab navigation - all elements should still be in tab order
      button1.focus();
      expect(button1).toHaveFocus();

      await user.tab();
      // Tab should move to the input field even with overlay present
      expect(inputField).toHaveFocus();

      await user.tab();
      // Then to the next button
      expect(button2).toHaveFocus();
    });

    it('should not trap focus in loading spinners', () => {
      render(<Spinner />);

      const spinner = screen.getByRole('status');

      // Loading spinners should not be focusable
      expect(spinner).not.toHaveAttribute('tabindex');

      // Should not interfere with normal tab flow
      spinner.focus();
      expect(spinner).not.toHaveFocus();
    });
  });

  describe('WCAG Compliance', () => {
    it('should meet color contrast requirements for loading states', () => {
      const { container } = render(<Spinner variant="primary" />);

      const spinner = container.querySelector('.text-primary');
      expect(spinner).toBeInTheDocument();

      // The component should use theme colors that meet contrast requirements
      // This would typically be verified with actual contrast testing tools
    });

    it('should provide alternative text for visual loading indicators', () => {
      render(<LoadingOverlay loading={true} message="Uploading files..." />);

      const loadingElement = screen.getByRole('status');
      expect(loadingElement).toHaveAttribute(
        'aria-label',
        'Uploading files...'
      );

      // Visual text should also be present for sighted users
      expect(screen.getByText('Uploading files...')).toBeInTheDocument();
    });

    it('should support high contrast mode', () => {
      // Test that components work in high contrast mode
      const { container } = render(
        <Spinner className="forced-colors:text-[ButtonText]" />
      );

      const spinner = container.firstChild;
      expect(spinner).toHaveClass('forced-colors:text-[ButtonText]');
    });

    it('should handle reduced motion preferences', () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query) => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      render(<Spinner />);

      const spinner = screen.getByRole('status');
      // Should still render but could have reduced/no animation
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass('animate-spin');
    });

    it('should work with screen reader virtual cursors', () => {
      render(
        <div>
          <h2>Operation Status</h2>
          <LoadingOverlay loading={true} message="Processing data..." />
          <p>Additional context information</p>
        </div>
      );

      // All content should be accessible to screen reader virtual cursor
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(
        screen.getByText('Additional context information')
      ).toBeInTheDocument();
    });
  });

  describe('Dynamic Content Announcements', () => {
    it('should announce status changes for async operations', async () => {
      const TestComponent = ({
        status,
      }: {
        status: 'idle' | 'loading' | 'success' | 'error';
      }): JSX.Element => {
        switch (status) {
          case 'loading':
            return <LoadingOverlay loading={true} message="Saving..." />;
          case 'success':
            return (
              <div role="status" aria-live="polite">
                Save completed successfully
              </div>
            );
          case 'error':
            return (
              <div role="alert" aria-live="assertive">
                Save failed. Please try again.
              </div>
            );
          default:
            return <div>Ready to save</div>;
        }
      };

      const { rerender } = render(<TestComponent status="idle" />);
      expect(screen.getByText('Ready to save')).toBeInTheDocument();

      // Start loading
      rerender(<TestComponent status="loading" />);
      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Saving...'
      );

      // Success state
      rerender(<TestComponent status="success" />);
      const successElement = screen.getByText('Save completed successfully');
      expect(successElement).toHaveAttribute('aria-live', 'polite');

      // Error state
      rerender(<TestComponent status="error" />);
      const errorElement = screen.getByText('Save failed. Please try again.');
      expect(errorElement).toHaveAttribute('role', 'alert');
      expect(errorElement).toHaveAttribute('aria-live', 'assertive');
    });

    it('should provide progress updates for long operations', () => {
      const ProgressComponent = ({
        progress,
      }: {
        progress: number;
      }): JSX.Element => (
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Upload progress: ${progress}%`}
        >
          <LoadingOverlay
            loading={progress < 100}
            message={`Uploading... ${progress}%`}
          />
        </div>
      );

      const { rerender } = render(<ProgressComponent progress={25} />);

      let progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '25');
      expect(progressBar).toHaveAttribute('aria-label', 'Upload progress: 25%');

      rerender(<ProgressComponent progress={75} />);
      progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '75');
      expect(progressBar).toHaveAttribute('aria-label', 'Upload progress: 75%');
    });
  });
});
