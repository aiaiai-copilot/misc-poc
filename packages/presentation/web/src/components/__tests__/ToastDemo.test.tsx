import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { toast } from '../ui/sonner';
import { toast as utilToast } from '../../utils/toast';
import { Toaster } from '../ui/sonner';

// Mock pointer capture methods for JSDOM compatibility
Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
  value: () => {},
  writable: true,
});

Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
  value: () => {},
  writable: true,
});

// Simple demo component to test toast integration
const ToastDemo: React.FC = () => {
  return (
    <div>
      <Toaster />
      <button onClick={() => toast.success('Basic success!')}>
        Basic Success
      </button>
      <button onClick={() => utilToast.success('Util success!')}>
        Util Success
      </button>
      <button onClick={() => utilToast.operations.operationSuccess('Test operation')}>
        Operation Success
      </button>
      <button onClick={() => utilToast.operations.operationError('Test operation', 'Something failed')}>
        Operation Error
      </button>
    </div>
  );
};

describe('Toast Integration Demo', () => {
  it('should render toast demo component', () => {
    render(<ToastDemo />);

    expect(screen.getByText('Basic Success')).toBeInTheDocument();
    expect(screen.getByText('Util Success')).toBeInTheDocument();
    expect(screen.getByText('Operation Success')).toBeInTheDocument();
    expect(screen.getByText('Operation Error')).toBeInTheDocument();
  });

  it('should show toast when button is clicked', async () => {
    const user = userEvent.setup();
    render(<ToastDemo />);

    await user.click(screen.getByText('Basic Success'));

    await waitFor(() => {
      expect(screen.getByText('Basic success!')).toBeInTheDocument();
    });
  });

  it('should show utility toast when button is clicked', async () => {
    const user = userEvent.setup();
    render(<ToastDemo />);

    await user.click(screen.getByText('Util Success'));

    await waitFor(() => {
      expect(screen.getByText('Util success!')).toBeInTheDocument();
    });
  });

  it('should show operation success toast', async () => {
    const user = userEvent.setup();
    render(<ToastDemo />);

    await user.click(screen.getByText('Operation Success'));

    await waitFor(() => {
      expect(screen.getByText('Test operation completed successfully')).toBeInTheDocument();
    });
  });

  it('should show operation error toast', async () => {
    const user = userEvent.setup();
    render(<ToastDemo />);

    await user.click(screen.getByText('Operation Error'));

    await waitFor(() => {
      expect(screen.getByText('Failed to test operation: Something failed')).toBeInTheDocument();
    });
  });
});