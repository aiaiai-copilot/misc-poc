import React, { useState } from 'react';
import { LoadingOverlay } from './ui/loading-overlay';
import { LiveAnnouncer } from './ui/live-announcer';
import { toast, accessibleToast } from '@/utils/toast';
import { Toaster } from './ui/sonner';

/**
 * Demonstration component showcasing accessibility enhancements
 * for loading states and error handling.
 */
const AccessibilityDemo: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [announceMessage, setAnnounceMessage] = useState('');

  const simulateAsyncOperation = async (
    operation: string,
    shouldFail = false
  ): Promise<void> => {
    setLoading(true);
    accessibleToast.operationStatus('started', operation);

    try {
      // Simulate async operation
      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (shouldFail) {
        throw new Error('Operation failed due to network error');
      }

      setLoading(false);
      accessibleToast.operationStatus(
        'completed',
        operation,
        'All data processed successfully'
      );
      setAnnounceMessage(`${operation} completed successfully`);
    } catch (error) {
      setLoading(false);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      accessibleToast.operationStatus('failed', operation, errorMessage);
      setAnnounceMessage(`${operation} failed: ${errorMessage}`);
    }
  };

  const simulateProgressOperation = async (): Promise<void> => {
    setLoading(true);

    for (let progress = 0; progress <= 100; progress += 20) {
      accessibleToast.progressUpdate('File Upload', progress);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    setLoading(false);
    accessibleToast.progressComplete(
      'File Upload',
      '5 files uploaded successfully'
    );
    setAnnounceMessage('File upload completed - 5 files uploaded successfully');
  };

  const showCriticalError = (): void => {
    accessibleToast.criticalError(
      'Critical system error: Database connection lost',
      {
        action: {
          label: 'Reconnect',
          onClick: () => {
            toast.success('Attempting to reconnect...');
          },
        },
      }
    );
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Toaster />

      {/* Live announcer for custom announcements */}
      <LiveAnnouncer message={announceMessage} />

      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Accessibility Demo</h1>
        <p className="text-gray-600">
          This demo showcases enhanced accessibility features for loading states
          and error handling. Use a screen reader to experience the
          announcements.
        </p>
      </div>

      <div className="relative min-h-[200px] border rounded-lg p-4">
        <LoadingOverlay
          loading={loading}
          message={loading ? 'Processing your request...' : undefined}
          announceChanges={true}
        >
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Content Area</h2>
            <p>
              This content is overlaid when loading operations are in progress.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded">
                <h3 className="font-medium">Sample Content</h3>
                <p className="text-sm text-gray-600">
                  This demonstrates how content remains accessible during
                  loading.
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded">
                <h3 className="font-medium">Interactive Elements</h3>
                <button className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm">
                  Sample Button
                </button>
              </div>
            </div>
          </div>
        </LoadingOverlay>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Test Operations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => simulateAsyncOperation('Data Processing')}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            aria-describedby="operation-help"
          >
            Simulate Success Operation
          </button>

          <button
            onClick={() => simulateAsyncOperation('Data Validation', true)}
            disabled={loading}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
            aria-describedby="operation-help"
          >
            Simulate Failed Operation
          </button>

          <button
            onClick={simulateProgressOperation}
            disabled={loading}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            aria-describedby="operation-help"
          >
            Simulate Progress Operation
          </button>

          <button
            onClick={showCriticalError}
            className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
            aria-describedby="operation-help"
          >
            Show Critical Error
          </button>
        </div>

        <p id="operation-help" className="text-sm text-gray-600">
          These buttons demonstrate different types of operations with
          accessible loading states and error handling. Screen readers will
          announce status changes and provide appropriate feedback.
        </p>
      </div>

      <div className="space-y-2 p-4 bg-blue-50 rounded">
        <h3 className="font-medium text-blue-900">Accessibility Features</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Screen reader announcements for loading state changes</li>
          <li>• Proper ARIA labels and roles for loading indicators</li>
          <li>• Keyboard navigation support for interactive elements</li>
          <li>• Live region announcements for operation status</li>
          <li>• Progress updates for long-running operations</li>
          <li>• Assertive announcements for critical errors</li>
          <li>• Focus management during loading states</li>
        </ul>
      </div>
    </div>
  );
};

export default AccessibilityDemo;
