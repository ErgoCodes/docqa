import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { usePendingQuestion } from './usePendingQuestion';
import { ConversationRefetchFailedError } from './useSendMessageMutation';

describe('usePendingQuestion', () => {
  let queryClient: QueryClient;
  let mutationCache: MutationCache;

  beforeEach(() => {
    mutationCache = new MutationCache();
    queryClient = new QueryClient({ mutationCache });
  });

  function wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }

  it('returns null when no mutations exist for the conversation', () => {
    const { result } = renderHook(() => usePendingQuestion('conv-1'), { wrapper });
    expect(result.current).toBeNull();
  });

  it('returns pending state when a sendMessage mutation is pending', () => {
    const mutation = mutationCache.build(queryClient, {
      mutationKey: ['sendMessage', 'conv-1'],
      mutationFn: () => new Promise(() => {}), // Never resolves
    });

    void mutation.execute({ question: 'Why is the sky blue?' });

    const { result } = renderHook(() => usePendingQuestion('conv-1'), { wrapper });

    expect(result.current?.status).toBe('pending');
    expect(result.current?.question).toBe('Why is the sky blue?');
    expect(result.current?.error).toBeNull();
    expect(result.current?.isRefetchError).toBe(false);
  });

  it('returns error state and detects ConversationRefetchFailedError when mutation fails', async () => {
    const mutation = mutationCache.build(queryClient, {
      mutationKey: ['sendMessage', 'conv-1'],
      mutationFn: () => {
        throw new ConversationRefetchFailedError();
      },
    });

    try {
      await mutation.execute({ question: 'Will this fail?' });
    } catch {
      // Expected to reject
    }

    const { result } = renderHook(() => usePendingQuestion('conv-1'), { wrapper });

    expect(result.current?.status).toBe('error');
    expect(result.current?.question).toBe('Will this fail?');
    expect(result.current?.isRefetchError).toBe(true);
    expect(result.current?.error).toBeInstanceOf(ConversationRefetchFailedError);
  });
});
