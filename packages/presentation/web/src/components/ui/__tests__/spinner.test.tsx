import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Spinner } from '../spinner';

describe('Spinner Component', () => {
  it('should render with default props', () => {
    render(<Spinner />);

    const spinner = screen.getByRole('status');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveAttribute('aria-label', 'Loading...');
  });

  it('should display custom aria-label', () => {
    render(<Spinner aria-label="Saving data..." />);

    const spinner = screen.getByRole('status');
    expect(spinner).toHaveAttribute('aria-label', 'Saving data...');
  });

  it('should accept custom className', () => {
    render(<Spinner className="custom-spinner" />);

    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('custom-spinner');
  });

  it('should support different sizes', () => {
    const { rerender } = render(<Spinner size="sm" />);
    let spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('h-4', 'w-4');

    rerender(<Spinner size="md" />);
    spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('h-6', 'w-6');

    rerender(<Spinner size="lg" />);
    spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('h-8', 'w-8');
  });

  it('should have proper accessibility attributes', () => {
    render(<Spinner />);

    const spinner = screen.getByRole('status');
    expect(spinner).toHaveAttribute('role', 'status');
    expect(spinner).toHaveAttribute('aria-label');
  });

  it('should have spinning animation class', () => {
    render(<Spinner />);

    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('animate-spin');
  });

  it('should be visible to screen readers', () => {
    render(<Spinner />);

    const spinner = screen.getByRole('status');
    expect(spinner).not.toHaveAttribute('aria-hidden', 'true');
  });

  it('should accept custom color variants', () => {
    const { rerender } = render(<Spinner variant="primary" />);
    let spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('text-primary');

    rerender(<Spinner variant="secondary" />);
    spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('text-muted-foreground');

    rerender(<Spinner variant="destructive" />);
    spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('text-destructive');
  });

  it('should render inline spinner when inline prop is true', () => {
    render(<Spinner inline />);

    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('inline-block');
  });

  it('should pass through additional props', () => {
    render(<Spinner data-testid="loading-spinner" />);

    const spinner = screen.getByTestId('loading-spinner');
    expect(spinner).toBeInTheDocument();
  });

  it('should have proper SVG structure for accessibility', () => {
    const { container } = render(<Spinner />);

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).not.toHaveAttribute('aria-hidden', 'true');
  });
});