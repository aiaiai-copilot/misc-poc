import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LiveAnnouncer } from '../live-announcer';

describe('LiveAnnouncer Component', () => {
  it('should render with polite priority by default', () => {
    render(<LiveAnnouncer message="Test announcement" />);

    const announcer = screen.getByText('Test announcement');
    expect(announcer).toBeInTheDocument();
    expect(announcer).toHaveAttribute('aria-live', 'polite');
    expect(announcer).not.toHaveAttribute('role');
  });

  it('should render with assertive priority when specified', () => {
    render(
      <LiveAnnouncer message="Critical announcement" priority="assertive" />
    );

    const announcer = screen.getByText('Critical announcement');
    expect(announcer).toHaveAttribute('aria-live', 'assertive');
    expect(announcer).toHaveAttribute('role', 'alert');
  });

  it('should be hidden from visual users but accessible to screen readers', () => {
    render(<LiveAnnouncer message="Screen reader announcement" />);

    const announcer = screen.getByText('Screen reader announcement');
    expect(announcer).toHaveClass('sr-only');
  });

  it('should have aria-atomic attribute for complete announcements', () => {
    render(<LiveAnnouncer message="Complete message" />);

    const announcer = screen.getByText('Complete message');
    expect(announcer).toHaveAttribute('aria-atomic', 'true');
  });

  it('should not render when message is empty', () => {
    const { container } = render(<LiveAnnouncer message="" />);
    expect(container.firstChild).toBeNull();
  });

  it('should call onAnnounce callback when message changes', () => {
    const onAnnounce = vi.fn();
    const { rerender } = render(
      <LiveAnnouncer message="First message" onAnnounce={onAnnounce} />
    );

    expect(onAnnounce).toHaveBeenCalledTimes(1);

    rerender(
      <LiveAnnouncer message="Second message" onAnnounce={onAnnounce} />
    );
    expect(onAnnounce).toHaveBeenCalledTimes(2);
  });

  it('should not call onAnnounce for the same message', () => {
    const onAnnounce = vi.fn();
    const { rerender } = render(
      <LiveAnnouncer message="Same message" onAnnounce={onAnnounce} />
    );

    expect(onAnnounce).toHaveBeenCalledTimes(1);

    rerender(<LiveAnnouncer message="Same message" onAnnounce={onAnnounce} />);
    expect(onAnnounce).toHaveBeenCalledTimes(1);
  });

  it('should support dynamic message updates', () => {
    const { rerender } = render(<LiveAnnouncer message="Loading..." />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    rerender(<LiveAnnouncer message="Load complete" />);
    expect(screen.getByText('Load complete')).toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });
});
