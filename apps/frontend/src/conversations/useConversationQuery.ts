import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { conversationsApi } from '@/api/conversations';
import type { Conversation } from '@/api/types';
import { recentConversationsStore } from './recent-conversations-store';

export function useConversationQuery(conversationId: string | null) {
  const query = useQuery<Conversation>({
    queryKey: ['conversation', conversationId],
    queryFn: () => {
      if (!conversationId) {
        throw new Error('conversationId is required');
      }
      return conversationsApi.getById(conversationId);
    },
    enabled: Boolean(conversationId),
  });

  // Keep recent conversations store updated
  React.useEffect(() => {
    if (query.data && conversationId) {
      const firstUserMsg = query.data.messages.find((m) => m.role === 'user')?.content;
      const title = firstUserMsg
        ? firstUserMsg.slice(0, 40) + (firstUserMsg.length > 40 ? '...' : '')
        : `Conversación ${conversationId.slice(-6)}`;

      recentConversationsStore.addOrUpdate({
        id: conversationId,
        title,
        documentIds: query.data.documentIds,
        updatedAt: new Date().toISOString(),
      });
    }
  }, [query.data, conversationId]);

  return query;
}
