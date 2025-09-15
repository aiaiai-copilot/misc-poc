import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LoadingOverlay } from '../loading-overlay';

describe('LoadingOverlay Component', () => {
  it('should not render when loading is false', () => {
    render(<LoadingOverlay loading={false} />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('should render when loading is true', () => {
    render(<LoadingOverlay loading={true} />);

    const overlay = screen.getByRole('status');
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveAttribute('aria-label', 'Loading...');
  });

  it('should display custom message', () => {
    render(<LoadingOverlay loading={true} message="Processing data..." />);

    expect(screen.getByText('Processing data...')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Processing data...');
  });

  it('should render with backdrop by default', () => {
    const { container } = render(<LoadingOverlay loading={true} />);

    const overlay = container.firstChild;
    expect(overlay).toHaveClass('bg-black/20'); // backdrop classes
  });

  it('should render without backdrop when disabled', () => {
    const { container } = render(<LoadingOverlay loading={true} backdrop={false} />);

    const overlay = container.firstChild;
    expect(overlay).not.toHaveClass('bg-black/20');
  });

  it('should be positioned absolutely by default', () => {
    const { container } = render(<LoadingOverlay loading={true} />);

    const overlay = container.firstChild;
    expect(overlay).toHaveClass('absolute');
  });

  it('should be positioned fixed when fullScreen is true', () => {
    const { container } = render(<LoadingOverlay loading={true} fullScreen />);

    const overlay = container.firstChild;
    expect(overlay).toHaveClass('fixed', 'inset-0');
  });

  it('should accept custom className', () => {
    const { container } = render(<LoadingOverlay loading={true} className="custom-overlay" />);

    const overlay = container.firstChild;
    expect(overlay).toHaveClass('custom-overlay');
  });

  it('should have proper z-index for layering', () => {
    const { container } = render(<LoadingOverlay loading={true} />);

    const overlay = container.firstChild;
    expect(overlay).toHaveClass('z-50'); // high z-index
  });

  it('should center content properly', () => {
    const { container } = render(<LoadingOverlay loading={true} />);

    const overlay = container.firstChild;
    expect(overlay).toHaveClass('flex', 'items-center', 'justify-center');
  });

  it('should render spinner component inside', () => {
    render(<LoadingOverlay loading={true} />);

    // The spinner should be inside the overlay
    const spinner = screen.getByRole('status').querySelector('[data-loading-spinner]');
    expect(spinner).toBeInTheDocument();
  });

  it('should support different spinner sizes', () => {
    render(<LoadingOverlay loading={true} spinnerSize="lg" />);

    const overlay = screen.getByRole('status');
    expect(overlay).toBeInTheDocument();
    // The specific size testing would depend on Spinner component implementation
  });

  it('should prevent interaction when loading', () => {
    const { container } = render(<LoadingOverlay loading={true} />);

    const overlay = container.firstChild;
    // Should have pointer-events-none on content behind or pointer-events-auto on overlay
    expect(overlay).toHaveClass('pointer-events-auto');
  });

  it('should be accessible to screen readers', () => {
    render(<LoadingOverlay loading={true} message="Saving changes..." />);

    const overlay = screen.getByRole('status');
    expect(overlay).toHaveAttribute('aria-label', 'Saving changes...');
    expect(overlay).not.toHaveAttribute('aria-hidden');
  });

  it('should handle long messages gracefully', () => {
    const longMessage = 'This is a very long loading message that should be handled properly without breaking the layout or accessibility';

    render(<LoadingOverlay loading={true} message={longMessage} />);

    expect(screen.getByText(longMessage)).toBeInTheDocument();
  });

  it('should support conditional rendering with children', () => {
    const { rerender } = render(
      <LoadingOverlay loading={false}>
        <div data-testid="content">Content</div>
      </LoadingOverlay>
    );

    expect(screen.getByTestId('content')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    rerender(
      <LoadingOverlay loading={true}>
        <div data-testid="content">Content</div>
      </LoadingOverlay>
    );

    expect(screen.getByTestId('content')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should maintain proper tab order and focus management', () => {
    render(<LoadingOverlay loading={true} />);

    const overlay = screen.getByRole('status');
    // Loading overlay should not interfere with normal tab flow
    expect(overlay).not.toHaveAttribute('tabindex');
  });
});