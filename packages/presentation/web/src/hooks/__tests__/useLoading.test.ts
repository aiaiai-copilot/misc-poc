import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useLoading } from '../useLoading';

describe('useLoading Hook', () => {
  it('should initialize with loading false', () => {
    const { result } = renderHook(() => useLoading());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.loadingStates).toEqual({});
  });

  it('should set loading to true when startLoading is called', () => {
    const { result } = renderHook(() => useLoading());

    act(() => {
      result.current.startLoading();
    });

    expect(result.current.isLoading).toBe(true);
  });

  it('should set loading to false when stopLoading is called', () => {
    const { result } = renderHook(() => useLoading());

    act(() => {
      result.current.startLoading();
    });

    expect(result.current.isLoading).toBe(true);

    act(() => {
      result.current.stopLoading();
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('should manage multiple loading states by key', () => {
    const { result } = renderHook(() => useLoading());

    act(() => {
      result.current.startLoading('save');
      result.current.startLoading('delete');
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.loadingStates).toEqual({
      save: true,
      delete: true
    });
  });

  it('should check specific loading state by key', () => {
    const { result } = renderHook(() => useLoading());

    act(() => {
      result.current.startLoading('save');
    });

    expect(result.current.isLoadingKey('save')).toBe(true);
    expect(result.current.isLoadingKey('delete')).toBe(false);
  });

  it('should stop specific loading state by key', () => {
    const { result } = renderHook(() => useLoading());

    act(() => {
      result.current.startLoading('save');
      result.current.startLoading('delete');
    });

    expect(result.current.isLoading).toBe(true);

    act(() => {
      result.current.stopLoading('save');
    });

    expect(result.current.isLoading).toBe(true); // still loading delete
    expect(result.current.isLoadingKey('save')).toBe(false);
    expect(result.current.isLoadingKey('delete')).toBe(true);
  });

  it('should clear all loading states when stopLoading is called without key', () => {
    const { result } = renderHook(() => useLoading());

    act(() => {
      result.current.startLoading('save');
      result.current.startLoading('delete');
    });

    expect(result.current.isLoading).toBe(true);

    act(() => {
      result.current.stopLoading();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.loadingStates).toEqual({});
  });

  it('should provide async wrapper function', async () => {
    const { result } = renderHook(() => useLoading());

    const mockAsyncOperation = vi.fn().mockResolvedValue('success');

    let promise: Promise<any>;
    act(() => {
      promise = result.current.withLoading(mockAsyncOperation);
    });

    expect(result.current.isLoading).toBe(true);

    const response = await promise!;

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(response).toBe('success');
    expect(mockAsyncOperation).toHaveBeenCalledOnce();
  });

  it('should provide async wrapper function with key', async () => {
    const { result } = renderHook(() => useLoading());

    const mockAsyncOperation = vi.fn().mockResolvedValue('success');

    let promise: Promise<any>;
    act(() => {
      promise = result.current.withLoading(mockAsyncOperation, 'save');
    });

    expect(result.current.isLoadingKey('save')).toBe(true);
    expect(result.current.isLoading).toBe(true);

    const response = await promise!;

    await waitFor(() => {
      expect(result.current.isLoadingKey('save')).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    expect(response).toBe('success');
    expect(mockAsyncOperation).toHaveBeenCalledOnce();
  });

  it('should handle async operation failures gracefully', async () => {
    const { result } = renderHook(() => useLoading());

    const mockAsyncOperation = vi.fn().mockRejectedValue(new Error('Operation failed'));

    let promise: Promise<any>;
    act(() => {
      promise = result.current.withLoading(mockAsyncOperation);
    });

    expect(result.current.isLoading).toBe(true);

    await expect(promise!).rejects.toThrow('Operation failed');

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should maintain loading state during concurrent operations', async () => {
    const { result } = renderHook(() => useLoading());

    const fastOperation = vi.fn().mockResolvedValue('fast');
    const slowOperation = vi.fn().mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve('slow'), 100))
    );

    // Start both operations
    let fastPromise: Promise<any>;
    let slowPromise: Promise<any>;

    act(() => {
      fastPromise = result.current.withLoading(fastOperation, 'fast');
      slowPromise = result.current.withLoading(slowOperation, 'slow');
    });

    expect(result.current.isLoadingKey('fast')).toBe(true);
    expect(result.current.isLoadingKey('slow')).toBe(true);
    expect(result.current.isLoading).toBe(true);

    // Fast operation completes first
    await fastPromise!;

    await waitFor(() => {
      expect(result.current.isLoadingKey('fast')).toBe(false);
    });

    // Slow operation still loading
    expect(result.current.isLoadingKey('slow')).toBe(true);
    expect(result.current.isLoading).toBe(true);

    // Wait for slow operation
    await slowPromise!;

    await waitFor(() => {
      expect(result.current.isLoadingKey('slow')).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should return current loading message when set', () => {
    const { result } = renderHook(() => useLoading());

    act(() => {
      result.current.startLoading('save', 'Saving data...');
    });

    expect(result.current.currentMessage).toBe('Saving data...');
  });

  it('should update message when multiple loading states have messages', () => {
    const { result } = renderHook(() => useLoading());

    act(() => {
      result.current.startLoading('save', 'Saving data...');
      result.current.startLoading('delete', 'Deleting item...');
    });

    // Should show the most recent message or combine them
    expect(result.current.currentMessage).toBeDefined();
  });

  it('should clear message when all loading states are stopped', () => {
    const { result } = renderHook(() => useLoading());

    act(() => {
      result.current.startLoading('save', 'Saving data...');
    });

    expect(result.current.currentMessage).toBe('Saving data...');

    act(() => {
      result.current.stopLoading('save');
    });

    expect(result.current.currentMessage).toBeUndefined();
  });
});