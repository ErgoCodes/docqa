import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useGlobalPendingQuestionGuard } from './use-global-pending-guard';

describe('useGlobalPendingQuestionGuard', () => {
  let queryClient: QueryClient;
  let mutationCache: MutationCache;

  beforeEach(() => {
    mutationCache = new MutationCache();
    queryClient = new QueryClient({ mutationCache });
  });

  function wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }

  it('(i) does not prevent unload when there are no active sendMessage mutations', () => {
    renderHook(() => useGlobalPendingQuestionGuard(), { wrapper });

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it('(ii) prevents unload when a sendMessage mutation for conversation A is in flight', () => {
    const mutation = mutationCache.build(queryClient, {
      mutationKey: ['sendMessage', 'conv-A'],
      mutationFn: async () => new Promise(() => {}),
    });

    void mutation.execute({ question: 'Test question' });

    renderHook(() => useGlobalPendingQuestionGuard(), { wrapper });

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('(iii) mounting the hook AFTER the mutation is already in-flight still activates the guard', () => {
    // Start mutation first
    const mutation = mutationCache.build(queryClient, {
      mutationKey: ['sendMessage', 'conv-A'],
      mutationFn: async () => new Promise(() => {}),
    });
    void mutation.execute({ question: 'Already running' });

    // Mount hook now (e.g. user navigated to another route)
    renderHook(() => useGlobalPendingQuestionGuard(), { wrapper });

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('(iv) activates for any conversation ID (predicate matches key[0] === "sendMessage")', () => {
    const mutation = mutationCache.build(queryClient, {
      mutationKey: ['sendMessage', 'conv-different-ID'],
      mutationFn: async () => new Promise(() => {}),
    });
    void mutation.execute({ question: 'Other conv' });

    renderHook(() => useGlobalPendingQuestionGuard(), { wrapper });

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });
});
