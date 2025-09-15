import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Spinner } from '../ui/spinner';
import { LoadingOverlay } from '../ui/loading-overlay';
import { Skeleton } from '../ui/skeleton';
import { useLoading } from '../../hooks/useLoading';

// Demo component showcasing all loading components
const LoadingComponentsDemo: React.FC = () => {
  const { isLoading, isLoadingKey, startLoading, stopLoading, withLoading } =
    useLoading();
  const [showOverlay, setShowOverlay] = React.useState(false);

  const handleAsyncOperation = async (): Promise<void> => {
    await withLoading(
      () => new Promise((resolve) => setTimeout(resolve, 1000)),
      'demo',
      'Processing demo data...'
    );
  };

  return (
    <div className="space-y-6 p-4">
      <h1>Loading Components Demo</h1>

      {/* Spinner variants */}
      <section>
        <h2>Spinners</h2>
        <div className="flex gap-4 items-center">
          <Spinner size="sm" />
          <Spinner size="md" />
          <Spinner size="lg" />
          <Spinner variant="destructive" size="md" />
        </div>
      </section>

      {/* Loading states */}
      <section>
        <h2>Loading States</h2>
        <div className="space-y-2">
          <button onClick={() => startLoading('save', 'Saving...')}>
            Start Loading
          </button>
          <button onClick={() => stopLoading('save')}>Stop Loading</button>
          <p>Is Loading: {isLoading.toString()}</p>
          <p>Save Loading: {isLoadingKey('save').toString()}</p>
        </div>
      </section>

      {/* Loading overlay */}
      <section className="relative">
        <h2>Loading Overlay</h2>
        <div className="border p-4 min-h-24">
          <p>Content behind overlay</p>
          <button onClick={() => setShowOverlay(!showOverlay)}>
            Toggle Overlay
          </button>
        </div>
        <LoadingOverlay
          loading={showOverlay}
          message="Loading overlay demo..."
        />
      </section>

      {/* Skeleton placeholders */}
      <section>
        <h2>Skeleton Placeholders</h2>
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-20 w-full" />
        </div>
      </section>

      {/* Async operation demo */}
      <section>
        <h2>Async Operation</h2>
        <button onClick={handleAsyncOperation} disabled={isLoadingKey('demo')}>
          {isLoadingKey('demo') ? 'Processing...' : 'Start Async Operation'}
        </button>
      </section>
    </div>
  );
};

describe('Loading Components Integration Demo', () => {
  it('should render all loading component types', () => {
    render(<LoadingComponentsDemo />);

    expect(screen.getByText('Loading Components Demo')).toBeInTheDocument();
    expect(screen.getByText('Spinners')).toBeInTheDocument();
    expect(screen.getByText('Loading States')).toBeInTheDocument();
    expect(screen.getByText('Loading Overlay')).toBeInTheDocument();
    expect(screen.getByText('Skeleton Placeholders')).toBeInTheDocument();
  });

  it('should show multiple spinner variants', () => {
    render(<LoadingComponentsDemo />);

    const spinners = screen.getAllByRole('status');
    expect(spinners.length).toBeGreaterThan(3); // Multiple spinners + skeletons
  });

  it('should manage loading states', async () => {
    const user = userEvent.setup();
    render(<LoadingComponentsDemo />);

    expect(screen.getByText('Is Loading: false')).toBeInTheDocument();

    await user.click(screen.getByText('Start Loading'));

    expect(screen.getByText('Is Loading: true')).toBeInTheDocument();
    expect(screen.getByText('Save Loading: true')).toBeInTheDocument();

    await user.click(screen.getByText('Stop Loading'));

    expect(screen.getByText('Is Loading: false')).toBeInTheDocument();
    expect(screen.getByText('Save Loading: false')).toBeInTheDocument();
  });

  it('should toggle loading overlay', async () => {
    const user = userEvent.setup();
    render(<LoadingComponentsDemo />);

    expect(
      screen.queryByText('Loading overlay demo...')
    ).not.toBeInTheDocument();

    await user.click(screen.getByText('Toggle Overlay'));

    expect(screen.getByText('Loading overlay demo...')).toBeInTheDocument();
  });

  it('should handle async operations with loading state', async () => {
    const user = userEvent.setup();
    render(<LoadingComponentsDemo />);

    const button = screen.getByText('Start Async Operation');
    expect(button).toBeInTheDocument();

    await user.click(button);

    expect(screen.getByText('Processing...')).toBeInTheDocument();

    await waitFor(
      () => {
        expect(screen.getByText('Start Async Operation')).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it('should render skeleton placeholders with proper accessibility', () => {
    render(<LoadingComponentsDemo />);

    const skeletons = screen.getAllByLabelText('Loading content...');
    expect(skeletons.length).toBe(3);
  });
});
