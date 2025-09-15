import React, { useEffect, useRef } from 'react';

export interface LiveAnnouncerProps {
  message: string;
  priority?: 'polite' | 'assertive';
  onAnnounce?: () => void;
}

/**
 * LiveAnnouncer component provides screen reader announcements for dynamic content changes.
 * This is especially useful for async operations and status updates.
 */
const LiveAnnouncer: React.FC<LiveAnnouncerProps> = ({
  message,
  priority = 'polite',
  onAnnounce,
}) => {
  const previousMessage = useRef<string>('');

  useEffect(() => {
    // Only announce if the message has actually changed
    if (message && message !== previousMessage.current) {
      previousMessage.current = message;
      onAnnounce?.();
    }
  }, [message, onAnnounce]);

  // Don't render anything if there's no message
  if (!message) {
    return null;
  }

  return (
    <div
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
      role={priority === 'assertive' ? 'alert' : undefined}
    >
      {message}
    </div>
  );
};

export { LiveAnnouncer };
