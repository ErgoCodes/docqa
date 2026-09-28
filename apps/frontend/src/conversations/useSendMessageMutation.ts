import { useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationsApi } from '@/api/conversations';
import type { Message } from '@/api/types';

export class ConversationRefetchFailedError extends Error {
  constructor(message = 'Failed to reload conversation after response was generated') {
    super(message);
    this.name = 'ConversationRefetchFailedError';
  }
}

export interface SendMessageVariables {
  question: string;
  retryMode?: 'ask' | 'refreshOnly';
}

export function useSendMessageMutation(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation<Message | null, Error, SendMessageVariables>({
    mutationKey: ['sendMessage', conversationId],
    mutationFn: async ({ question, retryMode = 'ask' }) => {
      let messageResult: Message | null = null;

      if (retryMode === 'ask') {
        messageResult = await conversationsApi.sendMessage(conversationId, question);
      }

      try {
        await queryClient.refetchQueries({
          queryKey: ['conversation', conversationId],
          type: 'active',
          exact: true,
        });
      } catch {
        throw new ConversationRefetchFailedError();
      }

      return messageResult;
    },
    gcTime: 1000 * 60 * 10,
  });
}
