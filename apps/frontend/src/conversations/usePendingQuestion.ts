import { useMutationState } from '@tanstack/react-query';
import {
  ConversationRefetchFailedError,
  type SendMessageVariables,
} from './useSendMessageMutation';

export interface PendingQuestionState {
  status: 'pending' | 'error';
  question: string;
  error: Error | null;
  isRefetchError: boolean;
}

export function usePendingQuestion(conversationId: string | null): PendingQuestionState | null {
  const mutations = useMutationState({
    filters: {
      predicate: (mutation) =>
        mutation.options.mutationKey?.[0] === 'sendMessage' &&
        mutation.options.mutationKey?.[1] === conversationId,
    },
    select: (mutation) => ({
      status: mutation.state.status,
      variables: mutation.state.variables as SendMessageVariables | undefined,
      error: mutation.state.error,
    }),
  });

  if (!conversationId || mutations.length === 0) {
    return null;
  }

  // Find latest pending first
  const pendingMutation = [...mutations].reverse().find((m) => m.status === 'pending');
  if (pendingMutation?.variables?.question) {
    return {
      status: 'pending',
      question: pendingMutation.variables.question,
      error: null,
      isRefetchError: false,
    };
  }

  // If none is pending, check if latest is error
  const latestMutation = mutations[mutations.length - 1];
  if (latestMutation?.status === 'error' && latestMutation.variables?.question) {
    return {
      status: 'error',
      question: latestMutation.variables.question,
      error: latestMutation.error ?? new Error('Error al enviar la pregunta'),
      isRefetchError: latestMutation.error instanceof ConversationRefetchFailedError,
    };
  }

  return null;
}
