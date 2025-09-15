import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import AccessibilityDemo from '../AccessibilityDemo';

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

describe('AccessibilityDemo Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should render with proper heading structure', () => {
    render(<AccessibilityDemo />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Accessibility Demo' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Content Area' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Test Operations' })
    ).toBeInTheDocument();
  });

  it('should have accessible button descriptions', () => {
    render(<AccessibilityDemo />);

    const successButton = screen.getByText('Simulate Success Operation');
    const failButton = screen.getByText('Simulate Failed Operation');
    const progressButton = screen.getByText('Simulate Progress Operation');

    expect(successButton).toHaveAttribute('aria-describedby', 'operation-help');
    expect(failButton).toHaveAttribute('aria-describedby', 'operation-help');
    expect(progressButton).toHaveAttribute(
      'aria-describedby',
      'operation-help'
    );

    const helpText = screen.getByText(
      /These buttons demonstrate different types of operations/
    );
    expect(helpText).toHaveAttribute('id', 'operation-help');
  });

  it('should show loading overlay when operation starts', async () => {
    const user = userEvent.setup();
    render(<AccessibilityDemo />);

    const successButton = screen.getByText('Simulate Success Operation');

    await user.click(successButton);

    // Should show loading overlay
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(
        screen.getAllByText('Processing your request...').length
      ).toBeGreaterThan(0);
    });

    // Buttons should be disabled during loading
    expect(successButton).toBeDisabled();
  });

  it('should announce operation completion', async () => {
    const user = userEvent.setup();
    render(<AccessibilityDemo />);

    const successButton = screen.getByText('Simulate Success Operation');

    await user.click(successButton);

    // Wait for operation to complete
    await waitFor(
      () => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Should have success toast
    await waitFor(() => {
      const successMessages = screen.getAllByText(/Data Processing completed/);
      expect(successMessages.length).toBeGreaterThan(0);
    });
  });

  it('should handle failed operations with error announcements', async () => {
    const user = userEvent.setup();
    render(<AccessibilityDemo />);

    const failButton = screen.getByText('Simulate Failed Operation');

    await user.click(failButton);

    // Wait for operation to complete
    await waitFor(
      () => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Should have error toast
    await waitFor(() => {
      const errorMessages = screen.getAllByText(/Data Validation failed/);
      expect(errorMessages.length).toBeGreaterThan(0);
    });
  });

  it('should show critical error with action button', async () => {
    const user = userEvent.setup();
    render(<AccessibilityDemo />);

    const criticalButton = screen.getByText('Show Critical Error');

    await user.click(criticalButton);

    await waitFor(() => {
      expect(screen.getByText(/Critical system error/)).toBeInTheDocument();
      expect(screen.getByText('Reconnect')).toBeInTheDocument();
    });

    // Test action button
    const reconnectButton = screen.getByText('Reconnect');
    await user.click(reconnectButton);

    await waitFor(() => {
      expect(
        screen.getByText('Attempting to reconnect...')
      ).toBeInTheDocument();
    });
  });

  it('should maintain accessibility during loading states', async () => {
    const user = userEvent.setup();
    render(<AccessibilityDemo />);

    const successButton = screen.getByText('Simulate Success Operation');

    await user.click(successButton);

    // During loading, content should still be accessible
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    // Check that content area is still accessible
    expect(screen.getByText('Content Area')).toBeInTheDocument();
    expect(
      screen.getByText(
        'This content is overlaid when loading operations are in progress.'
      )
    ).toBeInTheDocument();
  });

  it('should provide comprehensive accessibility information', () => {
    render(<AccessibilityDemo />);

    // Should list all accessibility features
    const features = [
      'Screen reader announcements for loading state changes',
      'Proper ARIA labels and roles for loading indicators',
      'Keyboard navigation support for interactive elements',
      'Live region announcements for operation status',
      'Progress updates for long-running operations',
      'Assertive announcements for critical errors',
      'Focus management during loading states',
    ];

    features.forEach((feature) => {
      expect(screen.getByText(new RegExp(feature))).toBeInTheDocument();
    });
  });

  it('should support keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<AccessibilityDemo />);

    const buttons = screen.getAllByRole('button');
    const firstButton = buttons[0];

    // Focus should work normally
    firstButton.focus();
    expect(firstButton).toHaveFocus();

    // Tab navigation should work
    await user.tab();
    expect(buttons[1]).toHaveFocus();
  });

  it('should have proper contrast and visual accessibility', () => {
    render(<AccessibilityDemo />);

    // Check that color-coded buttons have sufficient contrast
    const successButton = screen.getByText('Simulate Success Operation');
    const errorButton = screen.getByText('Simulate Failed Operation');
    const progressButton = screen.getByText('Simulate Progress Operation');
    const criticalButton = screen.getByText('Show Critical Error');

    expect(successButton).toHaveClass('bg-blue-500');
    expect(errorButton).toHaveClass('bg-red-500');
    expect(progressButton).toHaveClass('bg-green-500');
    expect(criticalButton).toHaveClass('bg-orange-500');

    // All should have white text for contrast
    [successButton, errorButton, progressButton, criticalButton].forEach(
      (button) => {
        expect(button).toHaveClass('text-white');
      }
    );
  });
});
