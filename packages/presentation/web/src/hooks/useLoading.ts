import { useState, useCallback, useMemo } from 'react';

interface LoadingState {
  [key: string]: boolean | { isLoading: boolean; message?: string };
}

interface UseLoadingReturn {
  isLoading: boolean;
  isLoadingKey: (key: string) => boolean;
  loadingStates: LoadingState;
  currentMessage?: string;
  startLoading: (key?: string, message?: string) => void;
  stopLoading: (key?: string) => void;
  withLoading: <T>(
    operation: () => Promise<T>,
    key?: string,
    message?: string
  ) => Promise<T>;
}

/**
 * Hook for managing loading states with support for multiple concurrent operations
 * Provides both simple boolean state and keyed loading states for complex UIs
 */
export const useLoading = (): UseLoadingReturn => {
  const [loadingStates, setLoadingStates] = useState<LoadingState>({});

  // Check if any operation is loading
  const isLoading = useMemo(() => {
    return Object.values(loadingStates).some(state =>
      typeof state === 'boolean' ? state : state.isLoading
    );
  }, [loadingStates]);

  // Check specific operation by key
  const isLoadingKey = useCallback((key: string): boolean => {
    const state = loadingStates[key];
    if (typeof state === 'boolean') return state;
    if (typeof state === 'object') return state.isLoading;
    return false;
  }, [loadingStates]);

  // Get current loading message (priority to most recent or first with message)
  const currentMessage = useMemo(() => {
    for (const state of Object.values(loadingStates)) {
      if (typeof state === 'object' && state.isLoading && state.message) {
        return state.message;
      }
    }
    return undefined;
  }, [loadingStates]);

  const startLoading = useCallback((key?: string, message?: string) => {
    setLoadingStates(prev => {
      if (!key) {
        // Simple loading state
        return { ...prev, __default: message ? { isLoading: true, message } : true };
      }

      return {
        ...prev,
        [key]: message ? { isLoading: true, message } : true
      };
    });
  }, []);

  const stopLoading = useCallback((key?: string) => {
    if (!key) {
      // Clear all loading states
      setLoadingStates({});
      return;
    }

    setLoadingStates(prev => {
      const newState = { ...prev };
      delete newState[key];
      return newState;
    });
  }, []);

  const withLoading = useCallback(async <T>(
    operation: () => Promise<T>,
    key?: string,
    message?: string
  ): Promise<T> => {
    try {
      startLoading(key, message);
      const result = await operation();
      return result;
    } finally {
      stopLoading(key);
    }
  }, [startLoading, stopLoading]);

  return {
    isLoading,
    isLoadingKey,
    loadingStates,
    currentMessage,
    startLoading,
    stopLoading,
    withLoading
  };
};