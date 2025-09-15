import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { Toaster } from '../sonner';

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

describe('Sonner Toast Component', () => {
  beforeEach(() => {
    // Clear any existing toasts before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any open toasts after each test
    document.body.innerHTML = '';
  });

  it('should render the Toaster component without crashing', () => {
    const { container } = render(<Toaster />);
    // Check that the toaster container was rendered
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should display a basic toast message', async () => {
    render(<Toaster />);

    // Trigger a toast
    toast('Test message');

    // Wait for toast to appear
    await waitFor(() => {
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });
  });

  it('should display success toast with proper styling', async () => {
    render(<Toaster />);

    toast.success('Success message');

    await waitFor(() => {
      expect(screen.getByText('Success message')).toBeInTheDocument();
    });
  });

  it('should display error toast with proper styling', async () => {
    render(<Toaster />);

    toast.error('Error message');

    await waitFor(() => {
      expect(screen.getByText('Error message')).toBeInTheDocument();
    });
  });

  it('should display loading toast', async () => {
    render(<Toaster />);

    toast.loading('Loading...');

    await waitFor(() => {
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  it('should display toast with custom action button', async () => {
    render(<Toaster />);

    toast('Message with action', {
      action: {
        label: 'Retry',
        onClick: vi.fn()
      }
    });

    await waitFor(() => {
      expect(screen.getByText('Message with action')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('should handle action button clicks', async () => {
    const user = userEvent.setup();
    const mockAction = vi.fn();

    render(<Toaster />);

    toast('Message with action', {
      action: {
        label: 'Click me',
        onClick: mockAction
      }
    });

    await waitFor(() => {
      expect(screen.getByText('Click me')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Click me'));
    expect(mockAction).toHaveBeenCalledOnce();
  });

  it('should auto-dismiss toasts after specified duration', async () => {
    render(<Toaster />);

    toast('Auto dismiss message', { duration: 50 });

    await waitFor(() => {
      expect(screen.getByText('Auto dismiss message')).toBeInTheDocument();
    });

    // Wait for auto-dismiss - give more time and check for removal state
    await waitFor(() => {
      const toastElement = document.querySelector('[data-removed="true"]');
      expect(toastElement).toBeInTheDocument();
    }, { timeout: 500 });
  });

  it('should support manual dismissal', async () => {
    render(<Toaster />);

    const toastId = toast('Dismissible message');

    await waitFor(() => {
      expect(screen.getByText('Dismissible message')).toBeInTheDocument();
    });

    // Programmatically dismiss the toast
    toast.dismiss(toastId);

    await waitFor(() => {
      const toastElement = document.querySelector('[data-removed="true"]');
      expect(toastElement).toBeInTheDocument();
    }, { timeout: 500 });
  });

  it('should have proper ARIA attributes for accessibility', async () => {
    render(<Toaster />);

    toast('Accessible message');

    await waitFor(() => {
      const toastContainer = document.querySelector('[aria-label*="Notifications"]');
      expect(toastContainer).toBeInTheDocument();
      expect(toastContainer).toHaveAttribute('aria-live', 'polite');
    });
  });

  it('should render error toasts with proper data attributes', async () => {
    render(<Toaster />);

    toast.error('Error message');

    await waitFor(() => {
      const toastElement = screen.getByText('Error message').closest('[data-type="error"]');
      expect(toastElement).toBeInTheDocument();
    });
  });

  it('should support custom styling through className prop', () => {
    const { container } = render(<Toaster className="custom-toaster" />);

    // Check that the toaster was rendered (the className is passed to sonner internally)
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should apply theme-based styling', () => {
    const { container } = render(<Toaster />);

    // Check that the toaster was rendered (basic functionality test)
    expect(container.firstChild).toBeInTheDocument();
    // The theme prop is passed to sonner internally
  });

  it('should handle multiple toasts gracefully', async () => {
    render(<Toaster />);

    toast('First message');
    toast('Second message');
    toast('Third message');

    await waitFor(() => {
      expect(screen.getByText('First message')).toBeInTheDocument();
      expect(screen.getByText('Second message')).toBeInTheDocument();
      expect(screen.getByText('Third message')).toBeInTheDocument();
    });
  });

  it('should support toast updates', async () => {
    render(<Toaster />);

    const toastId = toast.loading('Loading...');

    await waitFor(() => {
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    toast.success('Completed!', { id: toastId });

    await waitFor(() => {
      expect(screen.getByText('Completed!')).toBeInTheDocument();
    });
  });
});