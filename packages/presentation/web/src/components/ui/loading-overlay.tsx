import React from 'react';
import { cn } from '@/lib/utils';
import { Spinner, SpinnerProps } from './spinner';
import { LiveAnnouncer } from './live-announcer';

export interface LoadingOverlayProps {
  loading: boolean;
  message?: string;
  backdrop?: boolean;
  fullScreen?: boolean;
  className?: string;
  children?: React.ReactNode;
  spinnerSize?: SpinnerProps['size'];
  announceChanges?: boolean;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  loading,
  message,
  backdrop = true,
  fullScreen = false,
  className,
  children,
  spinnerSize = 'lg',
  announceChanges = false,
}) => {
  if (!loading) {
    return children ? <>{children}</> : null;
  }

  const announceMessage = message || 'Loading...';

  const overlayContent = (
    <div
      role="status"
      aria-label={announceMessage}
      aria-describedby={message ? 'loading-message' : undefined}
      className={cn(
        'flex flex-col items-center justify-center gap-3 z-50 pointer-events-auto',
        fullScreen ? 'fixed inset-0' : 'absolute inset-0',
        backdrop && 'bg-black/20 backdrop-blur-sm',
        className
      )}
    >
      <Spinner size={spinnerSize} hideRole />
      {message && (
        <div
          id="loading-message"
          className="text-sm text-muted-foreground max-w-xs text-center"
        >
          {message}
        </div>
      )}
      {announceChanges && <LiveAnnouncer message={announceMessage} />}
    </div>
  );

  if (children) {
    return (
      <div className="relative">
        {children}
        {overlayContent}
      </div>
    );
  }

  return overlayContent;
};

export { LoadingOverlay };
