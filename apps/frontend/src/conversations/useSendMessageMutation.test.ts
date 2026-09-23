import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { conversationsApi } from '@/api/conversations';
import type { Message } from '@/api/types';
import {
  ConversationRefetchFailedError,
  useSendMessageMutation,
} from './useSendMessageMutation';

describe('useSendMessageMutation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.restoreAllMocks();
  });

  function wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }

  const sampleAssistantMsg: Message = {
    role: 'assistant',
    content: 'Answer content',
    citations: [],
    createdAt: new Date().toISOString(),
  };

  it('case 1: ask mode with success calls sendMessage and refetches conversation', async () => {
    const sendSpy = vi
      .spyOn(conversationsApi, 'sendMessage')
      .mockResolvedValueOnce(sampleAssistantMsg);

    const refetchSpy = vi.spyOn(queryClient, 'refetchQueries').mockResolvedValue();

    const { result } = renderHook(() => useSendMessageMutation('conv-1'), { wrapper });

    await result.current.mutateAsync({ question: 'Hello?' });

    expect(sendSpy).toHaveBeenCalledWith('conv-1', 'Hello?');
    expect(refetchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['conversation', 'conv-1'] }),
    );
  });

  it('case 2: ask mode fails if POST /messages fails without refetching', async () => {
    vi.spyOn(conversationsApi, 'sendMessage').mockRejectedValueOnce(
      new Error('API error 500'),
    );

    const refetchSpy = vi.spyOn(queryClient, 'refetchQueries');

    const { result } = renderHook(() => useSendMessageMutation('conv-1'), { wrapper });

    await expect(result.current.mutateAsync({ question: 'Fail test' })).rejects.toThrow(
      'API error 500',
    );

    expect(refetchSpy).not.toHaveBeenCalled();
  });

  it('case 3: ask mode throws ConversationRefetchFailedError if refetch fails after successful message send', async () => {
    vi.spyOn(conversationsApi, 'sendMessage').mockResolvedValueOnce(sampleAssistantMsg);

    vi.spyOn(queryClient, 'refetchQueries').mockRejectedValueOnce(
      new Error('Network error during refetch'),
    );

    const { result } = renderHook(() => useSendMessageMutation('conv-1'), { wrapper });

    await expect(result.current.mutateAsync({ question: 'Hello?' })).rejects.toThrow(
      ConversationRefetchFailedError,
    );
  });

  it('case 4: refreshOnly mode does not call sendMessage, only refetches', async () => {
    const sendSpy = vi.spyOn(conversationsApi, 'sendMessage');
    const refetchSpy = vi.spyOn(queryClient, 'refetchQueries').mockResolvedValue();

    const { result } = renderHook(() => useSendMessageMutation('conv-1'), { wrapper });

    await result.current.mutateAsync({ question: 'Hello?', retryMode: 'refreshOnly' });

    expect(sendSpy).not.toHaveBeenCalled();
    expect(refetchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['conversation', 'conv-1'] }),
    );
  });

  it('case 5: refreshOnly mode throws ConversationRefetchFailedError if refetch fails again', async () => {
    vi.spyOn(queryClient, 'refetchQueries').mockRejectedValueOnce(
      new Error('Refetch failed again'),
    );

    const { result } = renderHook(() => useSendMessageMutation('conv-1'), { wrapper });

    await expect(
      result.current.mutateAsync({ question: 'Hello?', retryMode: 'refreshOnly' }),
    ).rejects.toThrow(ConversationRefetchFailedError);
  });
});
